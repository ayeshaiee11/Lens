const crypto = require('crypto');

/**
 * Generates a prefixed unique id, e.g. "inv_3f9a2b7c1e4d4a1b".
 *
 * Previously used an in-memory counter + Date.now() — fine for a
 * long-lived process, but serverless functions cold-start constantly and
 * that counter resets to 1 on every cold start. crypto.randomUUID() is
 * built into Node (no dependency) and has no process-memory assumptions.
 */
function uid(prefix = 'id') {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;
}

module.exports = { uid };
