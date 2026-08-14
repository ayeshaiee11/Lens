const express = require('express');
const multer = require('multer');
const { db } = require('../db');
const { uid } = require('../utils/id');
const { requireAuth } = require('../middleware/auth');
const { pushNotification } = require('../utils/notify');
const { circleLayout } = require('../seedData');
const { scrapeSourceContent } = require('../services/scrapeSource');
const { analyzeSource } = require('../services/analyzeSource');

const router = express.Router();
router.use(requireAuth);

// Vercel Serverless Functions enforce a hard 4.5MB request body limit that
// cannot be raised by any configuration — so the old 15MB PDF limit will
// always fail with a 413 on Vercel. Capped here to leave headroom under
// that ceiling. If you need larger PDFs later, uploads need to go through
// Vercel Blob (client uploads directly to storage, backend just reads the
// resulting URL) instead of straight through this endpoint.
const MAX_PDF_BYTES = 4 * 1024 * 1024; // 4MB — keep in sync with scrapeSource.js

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PDF_BYTES },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') return cb(new Error('Only PDF files are accepted.'));
    cb(null, true);
  },
});

function serializeSource(row) {
  return {
    key: row.id,
    title: row.title,
    domain: row.domain,
    type: row.type,
    added: row.added,
    icon: row.icon,
    tint: row.tint,
    saved: !!row.saved,
    usedIn: JSON.parse(row.used_in),
  };
}

// GET /api/sources
router.get('/', async (req, res, next) => {
  try {
    const rows = await db.prepare('SELECT * FROM sources WHERE user_id = ? ORDER BY created_at DESC').all(req.userId);
    res.json({ sources: rows.map(serializeSource) });
  } catch (err) {
    next(err);
  }
});

/**
 * Fetches the source's real content, asks the LLM to extract new
 * concepts/claims/questions from it, and writes them into the
 * investigation's knowledge map. Reads happen before the transaction;
 * everything inside the transaction is a write, using the tx-scoped `tx`
 * object so it's all committed (or rolled back) atomically.
 *
 * Any failure here (missing API key, network error, bad LLM output) is
 * left for the caller to catch — it must never prevent the source itself
 * from having been saved.
 */
async function enrichInvestigationFromSource({ inv, source, fileBuffer }) {
  const existingConcepts = await db.prepare('SELECT * FROM concepts WHERE investigation_id = ? ORDER BY sort_order').all(inv.id);
  const existingClaimCountRow = await db.prepare('SELECT COUNT(*) AS n FROM claims WHERE investigation_id = ?').get(inv.id);
  const existingQuestionCountRow = await db.prepare('SELECT COUNT(*) AS n FROM questions WHERE investigation_id = ?').get(inv.id);
  const existingClaimCount = existingClaimCountRow.n;
  const existingQuestionCount = existingQuestionCountRow.n;

  const scraped = await scrapeSourceContent({
    type: source.type, value: source.value, title: source.title, domain: source.domain, fileBuffer,
  });

  const analysis = await analyzeSource({
    investigationTitle: inv.title,
    existingConceptLabels: existingConcepts.map((c) => c.label),
    sourceTitle: source.title,
    sourceType: source.type,
    content: scraped.text,
  });

  const newConcepts = (analysis.concepts || [])
    .filter((c) => c?.label && !existingConcepts.some((e) => e.label.toLowerCase() === c.label.trim().toLowerCase()))
    .slice(0, 4);

  const totalConceptCount = existingConcepts.length + newConcepts.length;
  const coords = circleLayout(totalConceptCount);
  const existingEdges = JSON.parse(inv.edges || '[]');
  const newEdges = [];

  const run = db.transaction(async (tx) => {
    // Re-lay-out every concept (existing + new) on the recalculated ring so
    // the map doesn't just pile new nodes on top of old ones. Positions
    // aren't persisted from user dragging, so this is safe to overwrite.
    for (let i = 0; i < existingConcepts.length; i++) {
      const c = existingConcepts[i];
      await tx.prepare('UPDATE concepts SET x = ?, y = ? WHERE id = ?').run(coords[i][0], coords[i][1], c.id);
    }

    for (let i = 0; i < newConcepts.length; i++) {
      const c = newConcepts[i];
      const newIndex = existingConcepts.length + i;
      const [x, y] = coords[newIndex];
      await tx.prepare(`
        INSERT INTO concepts (id, investigation_id, label, x, y, desc, saved, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, 0, ?)
      `).run(uid('c'), inv.id, c.label.trim(), x, y, c.desc?.trim() || '', newIndex);

      const relatedLabel = c.relatedTo?.trim();
      const relatedIndex = relatedLabel
        ? existingConcepts.findIndex((e) => e.label.toLowerCase() === relatedLabel.toLowerCase())
        : -1;
      if (relatedIndex !== -1) newEdges.push([relatedIndex, newIndex]);
    }

    const claimsToInsert = (analysis.claims || []).slice(0, 4);
    for (let i = 0; i < claimsToInsert.length; i++) {
      const c = claimsToInsert[i];
      if (c?.text) {
        await tx.prepare('INSERT INTO claims (id, investigation_id, text, saved, sort_order) VALUES (?, ?, ?, 0, ?)')
          .run(uid('cl'), inv.id, c.text.trim(), existingClaimCount + i);
      }
    }

    const questionsToInsert = (analysis.questions || []).slice(0, 2);
    for (let i = 0; i < questionsToInsert.length; i++) {
      const q = questionsToInsert[i];
      if (q?.text) {
        await tx.prepare('INSERT INTO questions (id, investigation_id, text, saved, sort_order) VALUES (?, ?, ?, 0, ?)')
          .run(uid('q'), inv.id, q.text.trim(), existingQuestionCount + i);
      }
    }

    if (newEdges.length) {
      await tx.prepare('UPDATE investigations SET edges = ? WHERE id = ?')
        .run(JSON.stringify([...existingEdges, ...newEdges]), inv.id);
    }
  });
  await run();
}

// POST /api/sources { title, domain, type, value, icon, tint, investigationKey? }
router.post('/', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, async (req, res, next) => {
  try {
    const { title, domain, type, value, icon, tint, investigationKey } = req.body || {};
    if (!title?.trim()) return res.status(400).json({ error: 'Title is required.' });
    if (type === 'PDF' && !req.file) return res.status(400).json({ error: 'A PDF file is required.' });

    let inv = null;
    if (investigationKey) {
      inv = await db.prepare('SELECT * FROM investigations WHERE id = ? AND user_id = ?').get(investigationKey, req.userId);
      if (!inv) return res.status(404).json({ error: 'Investigation not found.' });
    }

    const id = uid('s');
    const usedIn = inv ? [inv.id] : [];
    await db.prepare(`
      INSERT INTO sources (id, user_id, title, domain, type, added, icon, tint, saved, used_in)
      VALUES (?, ?, ?, ?, ?, 'Just now', ?, ?, 0, ?)
    `).run(id, req.userId, title.trim(), domain || '', type || 'URL', icon || 'Link2', tint || '#38BDF8', JSON.stringify(usedIn));

    if (inv) {
      await db.prepare("UPDATE investigations SET percent = MIN(100, percent + 3), updated = 'Just now' WHERE id = ?").run(inv.id);
      await pushNotification(req.userId, `Added "${title.trim()}" to ${inv.title}.`, 'source');

      try {
        await enrichInvestigationFromSource({
          inv,
          source: { title: title.trim(), domain: domain || '', type: type || 'URL', value: value || '' },
          fileBuffer: req.file ? req.file.buffer : undefined,
        });
      } catch (err) {
        console.error('Source analysis failed:', err.message);
        await pushNotification(req.userId, `Added "${title.trim()}", but automatic analysis failed.`, 'info');
      }
    } else {
      await pushNotification(req.userId, `Added "${title.trim()}" to your sources.`, 'source');
    }

    const row = await db.prepare('SELECT * FROM sources WHERE id = ?').get(id);
    res.status(201).json({ source: serializeSource(row) });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/sources/:key
router.delete('/:key', async (req, res, next) => {
  try {
    const row = await db.prepare('SELECT * FROM sources WHERE id = ? AND user_id = ?').get(req.params.key, req.userId);
    if (!row) return res.status(404).json({ error: 'Source not found.' });
    await db.prepare('DELETE FROM sources WHERE id = ?').run(row.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// PATCH /api/sources/:key/unlink { investigationKey }
router.patch('/:key/unlink', async (req, res, next) => {
  try {
    const row = await db.prepare('SELECT * FROM sources WHERE id = ? AND user_id = ?').get(req.params.key, req.userId);
    if (!row) return res.status(404).json({ error: 'Source not found.' });
    const { investigationKey } = req.body || {};

    const usedIn = JSON.parse(row.used_in).filter((k) => k !== investigationKey);
    await db.prepare('UPDATE sources SET used_in = ? WHERE id = ?').run(JSON.stringify(usedIn), row.id);
    const updated = await db.prepare('SELECT * FROM sources WHERE id = ?').get(row.id);
    res.json({ source: serializeSource(updated) });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/sources/:key/saved — toggle
router.patch('/:key/saved', async (req, res, next) => {
  try {
    const row = await db.prepare('SELECT * FROM sources WHERE id = ? AND user_id = ?').get(req.params.key, req.userId);
    if (!row) return res.status(404).json({ error: 'Source not found.' });
    await db.prepare('UPDATE sources SET saved = NOT saved WHERE id = ?').run(row.id);
    const updated = await db.prepare('SELECT * FROM sources WHERE id = ?').get(row.id);
    res.json({ source: serializeSource(updated) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
