const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/maps — same derivation as the frontend's `maps` useMemo:
// one map per non-trashed investigation.
router.get('/', async (req, res, next) => {
  try {
    const invs = await db.prepare('SELECT * FROM investigations WHERE user_id = ? AND trashed = 0 ORDER BY created_at DESC').all(req.userId);

    // Note: this was previously `invs.map(...)` with a db call inside —
    // .map() doesn't wait for promises, so with an async database that
    // would return an array of pending Promises instead of resolved data.
    // Promise.all(invs.map(async (inv) => {...})) runs the same per-item
    // queries but actually awaits every one before responding.
    const maps = await Promise.all(invs.map(async (inv) => {
      const conceptRows = await db.prepare('SELECT * FROM concepts WHERE investigation_id = ? ORDER BY sort_order').all(inv.id);
      const concepts = conceptRows.map((c) => ({ id: c.id, label: c.label, x: c.x, y: c.y, desc: c.desc, saved: !!c.saved }));

      return {
        key: `map_${inv.id}`,
        invKey: inv.id,
        title: `${inv.title} \u2014 Map`,
        from: inv.title,
        visibility: inv.visibility,
        tint: inv.tint,
        concepts,
        edges: JSON.parse(inv.edges),
        saved: !!inv.map_saved,
      };
    }));

    res.json({ maps });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
