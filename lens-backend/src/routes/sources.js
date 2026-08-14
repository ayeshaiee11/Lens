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

// In-memory storage: files never touch disk, buffer is only held for the
// duration of the request (scrape -> analyze -> discard). Fine at resume-
// project scale; swap to disk/S3 storage first if uploads get large/frequent.
// Only used when the request is multipart/form-data (PDF uploads) — plain
// JSON requests (URL/YouTube/Research Paper) pass straight through multer
// untouched, since it only intercepts matching content-types.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // keep in sync with MAX_PDF_BYTES in scrapeSource.js
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
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM sources WHERE user_id = ? ORDER BY created_at DESC').all(req.userId);
  res.json({ sources: rows.map(serializeSource) });
});

/**
 * Fetches the source's real content, asks the LLM to extract new
 * concepts/claims/questions from it, and writes them into the
 * investigation's knowledge map. Reads/writes are wrapped in a single
 * transaction so a partial write never lands in the DB.
 *
 * Any failure here (missing API key, network error, bad LLM output) is
 * left for the caller to catch — it must never prevent the source itself
 * from having been saved.
 */
async function enrichInvestigationFromSource({ inv, source, fileBuffer }) {
  const existingConcepts = db.prepare('SELECT * FROM concepts WHERE investigation_id = ? ORDER BY sort_order').all(inv.id);
  const existingClaimCount = db.prepare('SELECT COUNT(*) AS n FROM claims WHERE investigation_id = ?').get(inv.id).n;
  const existingQuestionCount = db.prepare('SELECT COUNT(*) AS n FROM questions WHERE investigation_id = ?').get(inv.id).n;

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

  const run = db.transaction(() => {
    // Re-lay-out every concept (existing + new) on the recalculated ring so
    // the map doesn't just pile new nodes on top of old ones. Positions
    // aren't persisted from user dragging, so this is safe to overwrite.
    existingConcepts.forEach((c, i) => {
      db.prepare('UPDATE concepts SET x = ?, y = ? WHERE id = ?').run(coords[i][0], coords[i][1], c.id);
    });

    const insertConcept = db.prepare(`
      INSERT INTO concepts (id, investigation_id, label, x, y, desc, saved, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?)
    `);
    newConcepts.forEach((c, i) => {
      const newIndex = existingConcepts.length + i;
      const [x, y] = coords[newIndex];
      insertConcept.run(uid('c'), inv.id, c.label.trim(), x, y, c.desc?.trim() || '', newIndex);

      const relatedLabel = c.relatedTo?.trim();
      const relatedIndex = relatedLabel
        ? existingConcepts.findIndex((e) => e.label.toLowerCase() === relatedLabel.toLowerCase())
        : -1;
      if (relatedIndex !== -1) newEdges.push([relatedIndex, newIndex]);
    });

    const insertClaim = db.prepare('INSERT INTO claims (id, investigation_id, text, saved, sort_order) VALUES (?, ?, ?, 0, ?)');
    (analysis.claims || []).slice(0, 4).forEach((c, i) => {
      if (c?.text) insertClaim.run(uid('cl'), inv.id, c.text.trim(), existingClaimCount + i);
    });

    const insertQuestion = db.prepare('INSERT INTO questions (id, investigation_id, text, saved, sort_order) VALUES (?, ?, ?, 0, ?)');
    (analysis.questions || []).slice(0, 2).forEach((q, i) => {
      if (q?.text) insertQuestion.run(uid('q'), inv.id, q.text.trim(), existingQuestionCount + i);
    });

    if (newEdges.length) {
      db.prepare('UPDATE investigations SET edges = ? WHERE id = ?')
        .run(JSON.stringify([...existingEdges, ...newEdges]), inv.id);
    }
  });
  run();
}

// POST /api/sources { title, domain, type, value, icon, tint, investigationKey? }
// Creates the source, then — if it's linked to an investigation — fetches
// the real content and has the LLM enrich that investigation's knowledge
// map with real concepts/claims/questions drawn from it.
//
// For type === 'PDF', the frontend sends multipart/form-data with the file
// under the field name "file" instead of JSON; upload.single('file') below
// only engages for multipart requests, so URL/YouTube/Research Paper
// sources (plain JSON) are completely unaffected.
router.post('/', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    // Both multer's own errors (e.g. file too large) and our fileFilter's
    // "Only PDF files are accepted" reach here — normalize both to a plain
    // JSON 400 instead of falling through to the generic 500 handler.
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, async (req, res) => {
  const { title, domain, type, value, icon, tint, investigationKey } = req.body || {};
  if (!title?.trim()) return res.status(400).json({ error: 'Title is required.' });
  if (type === 'PDF' && !req.file) return res.status(400).json({ error: 'A PDF file is required.' });

  let inv = null;
  if (investigationKey) {
    inv = db.prepare('SELECT * FROM investigations WHERE id = ? AND user_id = ?').get(investigationKey, req.userId);
    if (!inv) return res.status(404).json({ error: 'Investigation not found.' });
  }

  const id = uid('s');
  const usedIn = inv ? [inv.id] : [];
  db.prepare(`
    INSERT INTO sources (id, user_id, title, domain, type, added, icon, tint, saved, used_in)
    VALUES (?, ?, ?, ?, ?, 'Just now', ?, ?, 0, ?)
  `).run(id, req.userId, title.trim(), domain || '', type || 'URL', icon || 'Link2', tint || '#38BDF8', JSON.stringify(usedIn));

  if (inv) {
    db.prepare("UPDATE investigations SET percent = MIN(100, percent + 3), updated = 'Just now' WHERE id = ?").run(inv.id);
    pushNotification(req.userId, `Added "${title.trim()}" to ${inv.title}.`, 'source');

    try {
      await enrichInvestigationFromSource({
        inv,
        source: { title: title.trim(), domain: domain || '', type: type || 'URL', value: value || '' },
        fileBuffer: req.file ? req.file.buffer : undefined,
      });
    } catch (err) {
      // The source is already saved at this point — analysis is a bonus,
      // not a requirement, so we log it and let the request succeed.
      console.error('Source analysis failed:', err.message);
      pushNotification(req.userId, `Added "${title.trim()}", but automatic analysis failed.`, 'info');
    }
  } else {
    pushNotification(req.userId, `Added "${title.trim()}" to your sources.`, 'source');
  }

  const row = db.prepare('SELECT * FROM sources WHERE id = ?').get(id);
  res.status(201).json({ source: serializeSource(row) });
});

// DELETE /api/sources/:key
router.delete('/:key', (req, res) => {
  const row = db.prepare('SELECT * FROM sources WHERE id = ? AND user_id = ?').get(req.params.key, req.userId);
  if (!row) return res.status(404).json({ error: 'Source not found.' });
  db.prepare('DELETE FROM sources WHERE id = ?').run(row.id);
  res.status(204).end();
});

// PATCH /api/sources/:key/unlink { investigationKey }
router.patch('/:key/unlink', (req, res) => {
  const row = db.prepare('SELECT * FROM sources WHERE id = ? AND user_id = ?').get(req.params.key, req.userId);
  if (!row) return res.status(404).json({ error: 'Source not found.' });
  const { investigationKey } = req.body || {};

  const usedIn = JSON.parse(row.used_in).filter((k) => k !== investigationKey);
  db.prepare('UPDATE sources SET used_in = ? WHERE id = ?').run(JSON.stringify(usedIn), row.id);
  res.json({ source: serializeSource(db.prepare('SELECT * FROM sources WHERE id = ?').get(row.id)) });
});

// PATCH /api/sources/:key/saved — toggle
router.patch('/:key/saved', (req, res) => {
  const row = db.prepare('SELECT * FROM sources WHERE id = ? AND user_id = ?').get(req.params.key, req.userId);
  if (!row) return res.status(404).json({ error: 'Source not found.' });
  db.prepare('UPDATE sources SET saved = NOT saved WHERE id = ?').run(row.id);
  res.json({ source: serializeSource(db.prepare('SELECT * FROM sources WHERE id = ?').get(row.id)) });
});

module.exports = router;