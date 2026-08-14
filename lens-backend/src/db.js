const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite'); // built into Node 22+, no native build step
const { uid } = require('./utils/id');
const { SEED_INVESTIGATIONS_RAW, SEED_SOURCES_RAW, NOTIF_SEED_TEMPLATES } = require('./seedData');

const DB_PATH = process.env.DB_PATH || './data/lens.db';
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const conn = new DatabaseSync(DB_PATH);
conn.exec('PRAGMA journal_mode = WAL;');
conn.exec('PRAGMA foreign_keys = ON;');

conn.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  google_sub TEXT,
  provider TEXT NOT NULL DEFAULT 'email',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS investigations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  base_source_count INTEGER NOT NULL DEFAULT 0,
  updated TEXT NOT NULL,
  percent INTEGER NOT NULL DEFAULT 0,
  icon TEXT NOT NULL,
  tint TEXT NOT NULL,
  bg TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'In Progress',
  visibility TEXT NOT NULL DEFAULT 'Private',
  trashed INTEGER NOT NULL DEFAULT 0,
  map_saved INTEGER NOT NULL DEFAULT 0,
  edges TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS concepts (
  id TEXT PRIMARY KEY,
  investigation_id TEXT NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  x REAL NOT NULL,
  y REAL NOT NULL,
  desc TEXT NOT NULL DEFAULT '',
  saved INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS claims (
  id TEXT PRIMARY KEY,
  investigation_id TEXT NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  saved INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  investigation_id TEXT NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  saved INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  domain TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'URL',
  added TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'Link2',
  tint TEXT NOT NULL DEFAULT '#38BDF8',
  saved INTEGER NOT NULL DEFAULT 0,
  used_in TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  time TEXT NOT NULL,
  read INTEGER NOT NULL DEFAULT 0,
  type TEXT NOT NULL DEFAULT 'info',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_investigations_user ON investigations(user_id);
CREATE INDEX IF NOT EXISTS idx_concepts_inv ON concepts(investigation_id);
CREATE INDEX IF NOT EXISTS idx_claims_inv ON claims(investigation_id);
CREATE INDEX IF NOT EXISTS idx_questions_inv ON questions(investigation_id);
CREATE INDEX IF NOT EXISTS idx_sources_user ON sources(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
`);

// Safety-net migration for databases created before google_sub existed
// (ALTER fails harmlessly with "duplicate column" if it's already there).
try { conn.exec('ALTER TABLE users ADD COLUMN google_sub TEXT;'); } catch { /* already exists */ }

// Thin wrapper so the rest of the app can use the same
// prepare().run/get/all() shape regardless of driver.
const db = {
  raw: conn,
  prepare(sql) {
    const stmt = conn.prepare(sql);
    return {
      run: (...args) => stmt.run(...args),
      get: (...args) => stmt.get(...args),
      all: (...args) => stmt.all(...args),
    };
  },
  exec(sql) {
    return conn.exec(sql);
  },
  transaction(fn) {
    return (...args) => {
      conn.exec('BEGIN');
      try {
        const result = fn(...args);
        conn.exec('COMMIT');
        return result;
      } catch (err) {
        conn.exec('ROLLBACK');
        throw err;
      }
    };
  },
};

/**
 * Runs once, right after signup. Previously populated a brand-new account
 * with demo investigations/sources/notifications (ported from the old
 * localStorage seed data). Now a deliberate no-op — new accounts start
 * completely empty. Kept as a function (rather than removing the call
 * sites in the auth routes) so re-enabling the old demo seed later is a
 * one-line change if it's ever wanted again.
 */
function seedUserContent(userId) {
  // Intentionally empty — new accounts start with zero investigations,
  // sources, or notifications.
}

module.exports = { db, seedUserContent };
