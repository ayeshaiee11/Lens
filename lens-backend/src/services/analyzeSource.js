const { getClient } = require('./groqClient');

// Free-tier Groq model. Fast and solid quality. Swap to 'llama-3.1-8b-instant'
// if you want higher throughput/lower latency at a small quality cost.
const MODEL = 'llama-3.3-70b-versatile';

function extractJson(text) {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i) || text.match(/```\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  return JSON.parse(raw);
}

async function callForJson({ system, user, maxTokens }) {
  const client = getClient();
  const response = await client.chat.completions.create({
    model: MODEL,
    max_tokens: maxTokens,
    response_format: { type: 'json_object' }, // Groq enforces valid JSON output with this
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  });
  const text = response.choices?.[0]?.message?.content;
  if (!text) throw new Error('LLM returned no content.');
  return extractJson(text);
}

/**
 * Reads a source's scraped content and returns new concepts/claims/questions
 * to weave into the investigation's knowledge map, plus which existing
 * concept (by label) each new concept relates most closely to, if any.
 */
async function analyzeSource({ investigationTitle, existingConceptLabels, sourceTitle, sourceType, content }) {
  const system = `You are a research assistant inside an app called LENS that helps people build a knowledge map for an investigation.
Given the text of one source, extract what's genuinely new and useful.
Respond with ONLY a JSON object, matching exactly this shape:
{
  "concepts": [{ "label": "short 1-4 word concept name", "desc": "one sentence description", "relatedTo": "label of an existing concept this connects to, or null" }],
  "claims": [{ "text": "one specific factual claim made or supported by the source" }],
  "questions": [{ "text": "one open question this source raises or leaves unanswered" }]
}
Rules:
- 2 to 4 concepts, 2 to 4 claims, 1 to 2 questions.
- Concepts must be genuinely new — do not repeat any of these existing concepts: ${existingConceptLabels.join(', ') || '(none yet)'}.
- "relatedTo" must EXACTLY match one of the existing concept labels above, or be null if nothing fits well.
- Keep everything grounded in the source content given below. Do not invent facts the content doesn't support.
- If the content is only metadata (fetch failed), keep concepts/claims general and say less rather than inventing specifics.`;

  const user = `Investigation: "${investigationTitle}"
Source title: "${sourceTitle}"
Source type: ${sourceType}

Source content:
"""
${content}
"""`;

  return callForJson({ system, user, maxTokens: 1200 });
}

/**
 * Generates a handful of starter concepts + a first open question purely
 * from an investigation's title, before any sources have been added.
 */
async function analyzeTopicStarter(title) {
  const system = `You help kick off a research investigation. Given only a topic title, suggest a small starting knowledge map.
Respond with ONLY a JSON object:
{
  "concepts": [{ "label": "short 1-3 word concept name", "desc": "one sentence description" }],
  "question": "one open question worth investigating first"
}
Return 3 to 5 concepts.`;

  return callForJson({ system, user: `Investigation title: "${title}"`, maxTokens: 600 });
}

module.exports = { analyzeSource, analyzeTopicStarter };