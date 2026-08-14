const express = require('express');
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const { db, seedUserContent } = require('../db');
const { uid } = require('../utils/id');
const { signToken, requireAuth } = require('../middleware/auth');

const router = express.Router();
const googleClient = process.env.GOOGLE_CLIENT_ID ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID) : null;

function publicUser(row) {
  return { id: row.id, name: row.name, email: row.email, provider: row.provider };
}

// POST /api/auth/signup { name, email, password }
router.post('/signup', async (req, res, next) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name?.trim() || !email?.trim() || !password?.trim()) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    const existing = await db.prepare('SELECT id FROM users WHERE email = ?').get(email.trim().toLowerCase());
    if (existing) return res.status(409).json({ error: 'An account with that email already exists.' });

    const id = uid('u');
    const passwordHash = bcrypt.hashSync(password, 10);
    await db.prepare(`
      INSERT INTO users (id, name, email, password_hash, provider)
      VALUES (?, ?, ?, ?, 'email')
    `).run(id, name.trim(), email.trim().toLowerCase(), passwordHash);

    await seedUserContent(id);

    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    res.status(201).json({ token: signToken(id), user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login { email, password }
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email?.trim() || !password?.trim()) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());
    if (!user || !user.password_hash || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    res.json({ token: signToken(user.id), user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/guest — creates a throwaway account, mirroring the
// frontend's "Continue as Guest" button.
router.post('/guest', async (req, res, next) => {
  try {
    const id = uid('u');
    const email = `guest_${id}@lens.app`;
    await db.prepare(`
      INSERT INTO users (id, name, email, password_hash, provider)
      VALUES (?, 'Guest', ?, NULL, 'guest')
    `).run(id, email);

    await seedUserContent(id);

    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    res.status(201).json({ token: signToken(id), user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/google { credential }
router.post('/google', async (req, res, next) => {
  try {
    if (!googleClient) {
      return res.status(501).json({ error: 'Google sign-in is not configured on this server (missing GOOGLE_CLIENT_ID).' });
    }
    const { credential } = req.body || {};
    if (!credential) return res.status(400).json({ error: 'Missing Google credential.' });

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
      payload = ticket.getPayload();
    } catch {
      return res.status(401).json({ error: 'Could not verify Google credential.' });
    }
    if (!payload?.email) return res.status(401).json({ error: 'Google account has no email on file.' });

    const email = payload.email.toLowerCase();
    let user = await db.prepare('SELECT * FROM users WHERE google_sub = ? OR email = ?').get(payload.sub, email);

    if (!user) {
      const id = uid('u');
      await db.prepare(`
        INSERT INTO users (id, name, email, password_hash, google_sub, provider)
        VALUES (?, ?, ?, NULL, ?, 'google')
      `).run(id, payload.name || email.split('@')[0], email, payload.sub);
      await seedUserContent(id);
      user = await db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    } else if (!user.google_sub) {
      await db.prepare('UPDATE users SET google_sub = ?, provider = ? WHERE id = ?')
        .run(payload.sub, user.provider === 'email' ? 'email' : 'google', user.id);
      user = await db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
    }

    res.json({ token: signToken(user.id), user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me — resolve the current token to a user.
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
