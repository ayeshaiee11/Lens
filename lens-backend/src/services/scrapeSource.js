const cheerio = require('cheerio');
const { YoutubeTranscript } = require('youtube-transcript');
const pdfParse = require('pdf-parse');

const MAX_CHARS = 12000;
const FETCH_TIMEOUT_MS = 10000;
const MAX_PDF_BYTES = 15 * 1024 * 1024; // keep in sync with the multer limit in routes/sources.js

function truncate(text) {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  return clean.length > MAX_CHARS ? clean.slice(0, MAX_CHARS) : clean;
}

async function fetchWithTimeout(url, opts = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

function extractYoutubeId(url) {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

async function scrapeUrl(url) {
  const normalized = url.startsWith('http') ? url : `https://${url}`;
  const res = await fetchWithTimeout(normalized, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LENS research assistant)' },
  });
  if (!res.ok) throw new Error(`Fetch failed with status ${res.status}`);
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
    throw new Error(`Unsupported content-type: ${contentType || 'unknown'}`);
  }
  const html = await res.text();
  const $ = cheerio.load(html);
  $('script, style, nav, footer, header, noscript, svg, form, iframe').remove();
  const text = $('article').text() || $('main').text() || $('body').text();
  return { text: truncate(text) };
}

async function scrapeYoutube(url) {
  const videoId = extractYoutubeId(url);
  if (!videoId) throw new Error('Could not parse a YouTube video ID from that URL.');
  const segments = await YoutubeTranscript.fetchTranscript(videoId);
  const text = segments.map((s) => s.text).join(' ');
  return { text: truncate(text) };
}

/**
 * Extracts real text from an uploaded PDF's raw bytes via pdf-parse.
 * Scanned/image-only PDFs will come back with little or no text — pdf-parse
 * has no OCR step, so that's a known limitation, not a bug: the caller
 * (analyzeSource) already handles thin/empty content gracefully.
 */
async function scrapePdfBuffer(buffer) {
  if (!buffer || !buffer.length) throw new Error('No PDF file data received.');
  if (buffer.length > MAX_PDF_BYTES) throw new Error('PDF is too large (15MB max).');
  const parsed = await pdfParse(buffer);
  const text = truncate(parsed.text);
  if (!text) throw new Error('Could not extract any text from this PDF (it may be scanned/image-only).');
  return { text, pageCount: parsed.numpages };
}

/**
 * Best-effort fetch of a source's real content so the LLM has something to
 * actually read, rather than guessing from a title alone.
 *
 * Falls back to metadata-only content (title/domain/type) when we can't
 * fetch real text (e.g. no file was attached for a PDF source, or a fetch/
 * parse error below).
 */
async function scrapeSourceContent({ type, value, title, domain, fileBuffer }) {
  try {
    if (type === 'PDF' && fileBuffer) return await scrapePdfBuffer(fileBuffer);
    if (type === 'YouTube' && value) return await scrapeYoutube(value);
    if ((type === 'URL' || type === 'Research Paper') && value) return await scrapeUrl(value);
  } catch (err) {
    return {
      text: `(Could not fetch this source directly: ${err.message}. Falling back to metadata only.)\nTitle: ${title}\nDomain: ${domain}\nType: ${type}`,
      fetchFailed: true,
    };
  }
  return {
    text: `Title: ${title}\nDomain: ${domain}\nType: ${type}\n(No file content available yet for this source type — metadata only.)`,
    fetchFailed: true,
  };
}

module.exports = { scrapeSourceContent, scrapePdfBuffer };