const { db } = require('../db');
const { uid } = require('./id');

function pushNotification(userId, text, type = 'info') {
  db.prepare(`
    INSERT INTO notifications (id, user_id, text, time, read, type)
    VALUES (?, ?, ?, 'Just now', 0, ?)
  `).run(uid('n'), userId, text, type);
}

module.exports = { pushNotification };
