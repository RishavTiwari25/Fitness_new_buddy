/**
 * Shared Google Gemini helpers used by the AI features
 * (coach chat, NL booking, semantic search, weekly insights).
 * One env var powers everything: GOOGLE_API_KEY / GEMINI_API_KEY.
 */
const BASE = 'https://generativelanguage.googleapis.com/v1beta';
const EMBED_MODEL = 'gemini-embedding-001';

function key() {
  return (
    process.env.GOOGLE_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    ''
  ).trim();
}
function model() {
  return (process.env.GOOGLE_GEMINI_MODEL || 'gemini-2.5-flash').trim();
}
function hasKey() {
  return !!key();
}

async function callGenerate(body) {
  const k = key();
  if (!k) { const e = new Error('AI is not configured (missing Gemini API key).'); e.code = 'NO_KEY'; throw e; }
  const r = await fetch(`${BASE}/models/${model()}:generateContent?key=${k}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const detail = await r.text().catch(() => '');
    const e = new Error(`Gemini HTTP ${r.status}`);
    e.detail = detail.slice(0, 300);
    throw e;
  }
  const j = await r.json();
  return (j?.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
}

// Free-form text generation.
async function generateText({ system, contents, generationConfig } = {}) {
  const body = { contents };
  if (system) body.systemInstruction = { parts: [{ text: system }] };
  if (generationConfig) body.generationConfig = generationConfig;
  return callGenerate(body);
}

// Structured output — asks Gemini for JSON and parses it robustly.
async function generateJSON({ system, prompt, temperature = 0.2 } = {}) {
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json', temperature },
  };
  if (system) body.systemInstruction = { parts: [{ text: system }] };
  const text = await callGenerate(body);
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (m) return JSON.parse(m[0]);
    const e = new Error('AI returned non-JSON output');
    e.raw = text.slice(0, 300);
    throw e;
  }
}

// Embed one string -> vector (gemini-embedding-001, 3072-dim).
async function embedOne(text) {
  const k = key();
  if (!k) { const e = new Error('AI is not configured (missing Gemini API key).'); e.code = 'NO_KEY'; throw e; }
  const r = await fetch(`${BASE}/models/${EMBED_MODEL}:embedContent?key=${k}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: { parts: [{ text: String(text).slice(0, 2000) }] } }),
  });
  if (!r.ok) {
    const detail = await r.text().catch(() => '');
    const e = new Error(`Gemini embed HTTP ${r.status}`);
    e.detail = detail.slice(0, 300);
    throw e;
  }
  const j = await r.json();
  return j?.embedding?.values || [];
}

// Embed many strings in parallel (bounded).
async function embedMany(texts) {
  const out = [];
  const CONCURRENCY = 8;
  for (let i = 0; i < texts.length; i += CONCURRENCY) {
    const batch = texts.slice(i, i + CONCURRENCY);
    const vecs = await Promise.all(batch.map(t => embedOne(t)));
    out.push(...vecs);
  }
  return out;
}

function cosine(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom ? dot / denom : 0;
}

module.exports = { hasKey, generateText, generateJSON, embedOne, embedMany, cosine };
