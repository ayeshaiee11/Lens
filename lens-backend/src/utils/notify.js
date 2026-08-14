const { db } = require('../db');
const { uid } = require('./id');

async function pushNotification(userId, text, type = 'info') {
  await db.prepare(`
    INSERT INTO notifications (id, user_id, text, time, read, type)
    VALUES (?, ?, ?, 'Just now', 0, ?)
  `).run(uid('n'), userId, text, type);
}

module.exports = { pushNotification };
