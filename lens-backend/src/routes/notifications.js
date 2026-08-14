const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

function serializeNotification(row) {
  return { id: row.id, text: row.text, time: row.time, read: !!row.read, type: row.type };
}

// GET /api/notifications
router.get('/', async (req, res, next) => {
  try {
    const rows = await db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC').all(req.userId);
    res.json({ notifications: rows.map(serializeNotification) });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', async (req, res, next) => {
  try {
    const row = await db.prepare('SELECT * FROM notifications WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
    if (!row) return res.status(404).json({ error: 'Notification not found.' });
    await db.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(row.id);
    const updated = await db.prepare('SELECT * FROM notifications WHERE id = ?').get(row.id);
    res.json({ notification: serializeNotification(updated) });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/notifications/read-all
router.patch('/read-all', async (req, res, next) => {
  try {
    await db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(req.userId);
    const rows = await db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC').all(req.userId);
    res.json({ notifications: rows.map(serializeNotification) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
