const express = require('express');
const { db } = require('../db');
const { uid } = require('../utils/id');
const { requireAuth } = require('../middleware/auth');
const { pushNotification } = require('../utils/notify');
const { circleLayout, ringEdges } = require('../seedData');
const { analyzeTopicStarter } = require('../services/analyzeSource');

const router = express.Router();
router.use(requireAuth);

const PALETTE = ['#A78BFA', '#38BDF8', '#2DD4BF', '#F59E0B', '#F472B6'];

async function serializeInvestigation(inv) {
  const conceptRows = await db.prepare('SELECT * FROM concepts WHERE investigation_id = ? ORDER BY sort_order').all(inv.id);
  const claimRows = await db.prepare('SELECT * FROM claims WHERE investigation_id = ? ORDER BY sort_order').all(inv.id);
  const questionRows = await db.prepare('SELECT * FROM questions WHERE investigation_id = ? ORDER BY sort_order').all(inv.id);

  const concepts = conceptRows.map((c) => ({ id: c.id, label: c.label, x: c.x, y: c.y, desc: c.desc, saved: !!c.saved }));
  const claims = claimRows.map((c) => ({ id: c.id, text: c.text, saved: !!c.saved }));
  const questions = questionRows.map((q) => ({ id: q.id, text: q.text, saved: !!q.saved }));

  return {
    key: inv.id,
    title: inv.title,
    baseSourceCount: inv.base_source_count,
    updated: inv.updated,
    percent: inv.percent,
    icon: inv.icon,
    tint: inv.tint,
    bg: inv.bg,
    status: inv.status,
    visibility: inv.visibility,
    trashed: !!inv.trashed,
    mapSaved: !!inv.map_saved,
    edges: JSON.parse(inv.edges),
    concepts,
    claims,
    questions,
  };
}

async function getOwnedInvestigation(userId, key) {
  return db.prepare('SELECT * FROM investigations WHERE id = ? AND user_id = ?').get(key, userId);
}

// GET /api/investigations              -> everything (trashed + active), like the
//                                          frontend's single in-memory array
// GET /api/investigations?trashed=0|1  -> just one bucket, if a caller wants it
router.get('/', async (req, res, next) => {
  try {
    let rows;
    if (req.query.trashed === '1' || req.query.trashed === '0') {
      rows = await db.prepare('SELECT * FROM investigations WHERE user_id = ? AND trashed = ? ORDER BY created_at DESC')
        .all(req.userId, req.query.trashed === '1' ? 1 : 0);
    } else {
      rows = await db.prepare('SELECT * FROM investigations WHERE user_id = ? ORDER BY created_at DESC').all(req.userId);
    }
    const investigations = await Promise.all(rows.map(serializeInvestigation));
    res.json({ investigations });
  } catch (err) {
    next(err);
  }
});

// GET /api/investigations/:key
router.get('/:key', async (req, res, next) => {
  try {
    const inv = await getOwnedInvestigation(req.userId, req.params.key);
    if (!inv) return res.status(404).json({ error: 'Investigation not found.' });
    res.json({ investigation: await serializeInvestigation(inv) });
  } catch (err) {
    next(err);
  }
});

// POST /api/investigations { title }
// Asks the LLM for a handful of real starter concepts based on the title,
// laid out in a circle. Falls back to the old word-splitting mock only if
// the LLM call fails (e.g. no ANTHROPIC_API_KEY set), so creating an
// investigation never hard-fails.
router.post('/', async (req, res, next) => {
  try {
    const { title } = req.body || {};
    if (!title?.trim()) return res.status(400).json({ error: 'Title is required.' });
    const trimmedTitle = title.trim();

    let concepts = null; // [{ label, desc }]
    let starterQuestion = `What are the most important sources to explore for "${trimmedTitle}"?`;

    try {
      const starter = await analyzeTopicStarter(trimmedTitle);
      concepts = (starter.concepts || [])
        .filter((c) => c?.label)
        .slice(0, 5)
        .map((c) => ({ label: c.label.trim(), desc: c.desc?.trim() || '' }));
      if (starter.question?.trim()) starterQuestion = starter.question.trim();
    } catch (err) {
      console.error('LLM starter concepts failed, falling back to title split:', err.message);
    }

    if (!concepts || concepts.length < 3) {
      const words = trimmedTitle.split(' ').filter(Boolean);
      const labels = Array.from({ length: Math.min(5, Math.max(3, words.length)) }, (_, i) => words[i % words.length] || `Topic ${i + 1}`)
        .map((w, i) => (i === 0 ? (trimmedTitle.length > 22 ? trimmedTitle.slice(0, 22) + '\u2026' : trimmedTitle) : w.charAt(0).toUpperCase() + w.slice(1)));
      const uniqueLabels = [...new Set(labels)].slice(0, 5);
      while (uniqueLabels.length < 3) uniqueLabels.push(`Idea ${uniqueLabels.length + 1}`);
      concepts = uniqueLabels.map((label) => ({ label, desc: `An early concept surfaced while exploring "${trimmedTitle}".` }));
    }

    const coords = circleLayout(concepts.length);
    const edges = ringEdges(concepts.length);

    const countRow = await db.prepare('SELECT COUNT(*) AS n FROM investigations WHERE user_id = ?').get(req.userId);
    const tint = PALETTE[countRow.n % PALETTE.length];

    const invId = uid('inv');
    const run = db.transaction(async (tx) => {
      await tx.prepare(`
        INSERT INTO investigations
          (id, user_id, title, base_source_count, updated, percent, icon, tint, bg, status, visibility, trashed, map_saved, edges)
        VALUES (?, ?, ?, 0, 'Just now', 4, 'Sparkles', ?, ?, 'In Progress', 'Private', 0, 0, ?)
      `).run(invId, req.userId, trimmedTitle, tint, `${tint}22`, JSON.stringify(edges));

      for (let i = 0; i < concepts.length; i++) {
        const c = concepts[i];
        await tx.prepare(`
          INSERT INTO concepts (id, investigation_id, label, x, y, desc, saved, sort_order)
          VALUES (?, ?, ?, ?, ?, ?, 0, ?)
        `).run(uid('c'), invId, c.label, coords[i][0], coords[i][1], c.desc, i);
      }

      await tx.prepare(`
        INSERT INTO questions (id, investigation_id, text, saved, sort_order)
        VALUES (?, ?, ?, 0, 0)
      `).run(uid('q'), invId, starterQuestion);
    });
    await run();

    await pushNotification(req.userId, `Created new investigation "${trimmedTitle}".`, 'info');

    const inv = await getOwnedInvestigation(req.userId, invId);
    res.status(201).json({ investigation: await serializeInvestigation(inv) });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/investigations/:key/trash
router.patch('/:key/trash', async (req, res, next) => {
  try {
    const inv = await getOwnedInvestigation(req.userId, req.params.key);
    if (!inv) return res.status(404).json({ error: 'Investigation not found.' });
    await db.prepare('UPDATE investigations SET trashed = 1 WHERE id = ?').run(inv.id);
    await pushNotification(req.userId, 'Investigation moved to trash.', 'info');
    const updated = await getOwnedInvestigation(req.userId, inv.id);
    res.json({ investigation: await serializeInvestigation(updated) });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/investigations/:key/restore
router.patch('/:key/restore', async (req, res, next) => {
  try {
    const inv = await getOwnedInvestigation(req.userId, req.params.key);
    if (!inv) return res.status(404).json({ error: 'Investigation not found.' });
    await db.prepare('UPDATE investigations SET trashed = 0 WHERE id = ?').run(inv.id);
    const updated = await getOwnedInvestigation(req.userId, inv.id);
    res.json({ investigation: await serializeInvestigation(updated) });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/investigations/:key — permanent delete (e.g. "Empty trash")
router.delete('/:key', async (req, res, next) => {
  try {
    const inv = await getOwnedInvestigation(req.userId, req.params.key);
    if (!inv) return res.status(404).json({ error: 'Investigation not found.' });
    await db.prepare('DELETE FROM investigations WHERE id = ?').run(inv.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// PATCH /api/investigations/:key/map-saved — toggle
router.patch('/:key/map-saved', async (req, res, next) => {
  try {
    const inv = await getOwnedInvestigation(req.userId, req.params.key);
    if (!inv) return res.status(404).json({ error: 'Investigation not found.' });
    await db.prepare('UPDATE investigations SET map_saved = NOT map_saved WHERE id = ?').run(inv.id);
    const updated = await getOwnedInvestigation(req.userId, inv.id);
    res.json({ investigation: await serializeInvestigation(updated) });
  } catch (err) {
    next(err);
  }
});

// Shared helper for toggling saved on a concept/claim/question row.
function toggleSavedRoute(table) {
  return async (req, res, next) => {
    try {
      const inv = await getOwnedInvestigation(req.userId, req.params.key);
      if (!inv) return res.status(404).json({ error: 'Investigation not found.' });

      const row = await db.prepare(`SELECT * FROM ${table} WHERE id = ? AND investigation_id = ?`).get(req.params.itemId, inv.id);
      if (!row) return res.status(404).json({ error: 'Item not found.' });

      await db.prepare(`UPDATE ${table} SET saved = NOT saved WHERE id = ?`).run(row.id);
      const updated = await getOwnedInvestigation(req.userId, inv.id);
      res.json({ investigation: await serializeInvestigation(updated) });
    } catch (err) {
      next(err);
    }
  };
}

router.patch('/:key/concepts/:itemId/saved', toggleSavedRoute('concepts'));
router.patch('/:key/claims/:itemId/saved', toggleSavedRoute('claims'));
router.patch('/:key/questions/:itemId/saved', toggleSavedRoute('questions'));

module.exports = router;
