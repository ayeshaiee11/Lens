const { createClient } = require('@libsql/client');

// Turso (libSQL) — a hosted, SQLite-compatible database reachable over the
// network. This replaces node:sqlite, which wrote to a local file and
// therefore could not survive on Vercel's serverless functions (no
// persistent disk, and each invocation may be a fresh instance).
//
// Get these two values from your Turso database (turso.tech):
//   TURSO_DATABASE_URL  -> looks like libsql://your-db-name-yourorg.turso.io
//   TURSO_AUTH_TOKEN    -> generated via `turso db tokens create <db-name>`
if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
  throw new Error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set in your environment.');
}

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    google_sub TEXT,
    provider TEXT NOT NULL DEFAULT 'email',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS investigations (
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
  )`,
  `CREATE TABLE IF NOT EXISTS concepts (
    id TEXT PRIMARY KEY,
    investigation_id TEXT NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    x REAL NOT NULL,
    y REAL NOT NULL,
    desc TEXT NOT NULL DEFAULT '',
    saved INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS claims (
    id TEXT PRIMARY KEY,
    investigation_id TEXT NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    saved INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY,
    investigation_id TEXT NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    saved INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS sources (
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
  )`,
  `CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    time TEXT NOT NULL,
    read INTEGER NOT NULL DEFAULT 0,
    type TEXT NOT NULL DEFAULT 'info',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_investigations_user ON investigations(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_concepts_inv ON concepts(investigation_id)`,
  `CREATE INDEX IF NOT EXISTS idx_claims_inv ON claims(investigation_id)`,
  `CREATE INDEX IF NOT EXISTS idx_questions_inv ON questions(investigation_id)`,
  `CREATE INDEX IF NOT EXISTS idx_sources_user ON sources(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id)`,
];

// Runs once per cold start (module-level await, cached across warm
// invocations of the same instance). Every route awaits `ready` before
// touching the database, so a request never races the schema setup.
let ready = null;
async function ensureSchema() {
  if (!ready) {
    ready = (async () => {
      for (const stmt of SCHEMA_STATEMENTS) {
        await client.execute(stmt);
      }
      try {
        await client.execute('ALTER TABLE users ADD COLUMN google_sub TEXT');
      } catch {
        // column already exists — fine
      }
    })();
  }
  return ready;
}

function rowsToObjects(result) {
  return result.rows.map((row) => {
    const obj = {};
    result.columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj;
  });
}

// Async equivalent of the old better-sqlite3-style wrapper. Every call site
// now needs `await` — that's the one mechanical change required everywhere
// this is used, since a network database can't be queried synchronously.
const db = {
  raw: client,
  prepare(sql) {
    return {
      async run(...args) {
        await ensureSchema();
        return client.execute({ sql, args });
      },
      async get(...args) {
        await ensureSchema();
        const result = await client.execute({ sql, args });
        return rowsToObjects(result)[0];
      },
      async all(...args) {
        await ensureSchema();
        const result = await client.execute({ sql, args });
        return rowsToObjects(result);
      },
    };
  },
  // Usage: await db.transaction(async (tx) => { await tx.prepare(...).run(...); ... })();
  // The callback receives a transaction-scoped `tx` object with the same
  // prepare().run/get/all() shape — use `tx`, not the outer `db`, for every
  // statement that must be part of the atomic transaction.
  transaction(fn) {
    return async (...args) => {
      await ensureSchema();
      const tx = await client.transaction('write');
      const txDb = {
        prepare(sql) {
          return {
            async run(...a) {
              return tx.execute({ sql, args: a });
            },
            async get(...a) {
              const result = await tx.execute({ sql, args: a });
              return rowsToObjects(result)[0];
            },
            async all(...a) {
              const result = await tx.execute({ sql, args: a });
              return rowsToObjects(result);
            },
          };
        },
      };
      try {
        const result = await fn(txDb, ...args);
        await tx.commit();
        return result;
      } catch (err) {
        await tx.rollback();
        throw err;
      } finally {
        tx.close();
      }
    };
  },
};

/**
 * Runs once, right after signup. Intentionally a no-op — new accounts
 * start completely empty. Kept as a function so re-enabling a demo seed
 * later is a one-line change.
 */
async function seedUserContent(userId) {
  // Intentionally empty.
}

module.exports = { db, seedUserContent, ensureSchema };
