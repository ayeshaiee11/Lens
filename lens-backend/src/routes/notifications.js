const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

function serializeNotification(row) {
  return { id: row.id, text: row.text, time: row.time, read: !!row.read, type: row.type };
}

// GET /api/notifications
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC').all(req.userId);
  res.json({ notifications: rows.map(serializeNotification) });
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', (req, res) => {
  const row = db.prepare('SELECT * FROM notifications WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!row) return res.status(404).json({ error: 'Notification not found.' });
  db.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(row.id);
  res.json({ notification: serializeNotification(db.prepare('SELECT * FROM notifications WHERE id = ?').get(row.id)) });
});

// PATCH /api/notifications/read-all
router.patch('/read-all', (req, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(req.userId);
  const rows = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC').all(req.userId);
  res.json({ notifications: rows.map(serializeNotification) });
});

module.exports = router;
