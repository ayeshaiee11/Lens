const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

function publicUser(row) {
  return { id: row.id, name: row.name, email: row.email, provider: row.provider };
}

// PATCH /api/me { name?, email? }
router.patch('/', (req, res) => {
  const { name, email } = req.body || {};
  const current = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  if (!current) return res.status(404).json({ error: 'User not found.' });

  const nextName = name?.trim() || current.name;
  const nextEmail = email?.trim() || current.email;

  if (nextEmail !== current.email) {
    const taken = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(nextEmail.toLowerCase(), req.userId);
    if (taken) return res.status(409).json({ error: 'That email is already in use.' });
  }

  db.prepare('UPDATE users SET name = ?, email = ? WHERE id = ?').run(nextName, nextEmail.toLowerCase(), req.userId);
  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  res.json({ user: publicUser(updated) });
});

module.exports = router;
