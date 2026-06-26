const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../db');
const mongo = require('../lib/mongo');
const { upload: uploadHelper, saveFile } = require('../lib/uploads');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Prefer centralized upload helper (Cloudinary if configured, else disk)
const upload = uploadHelper;
const modelCache = new Map();

function parseModelResponse(text) {
  // Expect JSON in the response; fallback to plain text items
  try {
    const obj = JSON.parse(text);
    return {
      items: obj.items || [],
      calories: obj.calories || null,
      macros: obj.macros || null,
      raw: text
    }
  } catch (_) {
    return { items: [], calories: null, macros: null, raw: text };
  }
}

function guessMimeFromPath(p) {
  const ext = path.extname(p).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  return 'image/jpeg';
}

function getGeminiApiKeys() {
  const raw = String(
    process.env.GOOGLE_API_KEY
    || process.env.GOOGLE_API_KEYS
    || process.env.GEMINI_API_KEY
    || process.env.GOOGLE_GENERATIVE_AI_API_KEY
    || ''
  ).trim();
  if (!raw) return [];
  return raw.split(',').map(k => k.trim()).filter(Boolean);
}

async function callModel(modelName, b64, mimeType, apiKey, apiVersion = 'v1beta') {
  const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${modelName}:generateContent?key=${apiKey}`;
  const prompt = `You are a world-class nutritional analyst. Analyze the attached meal image.
Respond ONLY as strict JSON with this shape:
{
  "items": ["string", ...],
  "calories": number,
  "macros": { "protein": number, "carbs": number, "fat": number }
}
Do not include explanations or code fences.`;

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { mimeType, data: b64 } }
        ]
      }
    ]
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!resp.ok) {
    const errBody = await resp.text().catch(() => '');
    const e = new Error(`Gemini HTTP ${resp.status}`);
    e.statusCode = resp.status;
    e.modelName = modelName;
    e.apiVersion = apiVersion;
    e.details = errBody;
    throw e;
  }
  const json = await resp.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || JSON.stringify(json);
  return text;
}

async function discoverModels(apiKey, apiVersion = 'v1beta') {
  const cacheKey = `${apiVersion}:${apiKey.slice(-8)}`;
  const cached = modelCache.get(cacheKey);
  const now = Date.now();
  if (cached && (now - cached.ts) < 10 * 60 * 1000) return cached.models;

  const url = `https://generativelanguage.googleapis.com/${apiVersion}/models?key=${apiKey}`;
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`list models failed: ${resp.status}`);
    const data = await resp.json();
    const models = (data?.models || [])
      .map(m => String(m?.name || '').replace(/^models\//, ''))
      .filter(Boolean)
      .filter(name => /gemini/i.test(name))
      .filter(name => /(flash|pro|vision|multimodal|image)/i.test(name));
    modelCache.set(cacheKey, { ts: now, models });
    return models;
  } catch (_) {
    return [];
  }
}

async function analyzeWithGemini(input) {
  const apiKeys = getGeminiApiKeys();
  if (!apiKeys.length) {
    throw new Error('Gemini API key is not configured. Set GOOGLE_API_KEY (or GEMINI_API_KEY) in backend environment.');
  }
  const envModel = (process.env.GOOGLE_GEMINI_MODEL || '').trim();
  // Use stable multimodal model by default; allow env override.
  let modelName = envModel || 'gemini-2.5-flash';
  if (/^gemini-?pro$/i.test(modelName)) modelName = 'gemini-2.5-pro';
  if (/^gemini-?pro-?vision$/i.test(modelName)) modelName = 'gemini-2.5-flash';

  const source = typeof input === 'string' ? { pathOrUrl: input } : (input || {});

  // Support in-memory uploads first, then URL/local path fallback
  let b64;
  let mimeType = 'image/jpeg';
  if (source.buffer && Buffer.isBuffer(source.buffer)) {
    b64 = source.buffer.toString('base64');
    mimeType = source.mimeType || 'image/jpeg';
  } else if (source.pathOrUrl && source.pathOrUrl.startsWith('http')) {
    const resp = await fetch(source.pathOrUrl);
    if (!resp.ok) throw new Error(`Failed to fetch image URL: ${resp.status}`);
    const arr = await resp.arrayBuffer();
    b64 = Buffer.from(arr).toString('base64');
    mimeType = resp.headers.get('content-type') || 'image/jpeg';
  } else if (source.pathOrUrl) {
    b64 = fs.readFileSync(source.pathOrUrl).toString('base64');
    mimeType = guessMimeFromPath(source.pathOrUrl);
  } else {
    throw new Error('No image data provided for analysis');
  }

  const staticCandidates = [
    modelName,
    'gemini-2.5-flash',
    'gemini-2.0-flash-exp',
    'gemini-2.0-flash-lite',
    'gemini-2.0-flash',
    'gemini-1.5-flash-8b',
    'gemini-1.5-flash-latest',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-1.5-pro-latest'
  ].filter(Boolean);
  const apiVersions = ['v1beta', 'v1'];

  let text;
  let lastErr = null;
  for (const apiKey of apiKeys) {
    for (const apiVersion of apiVersions) {
      const discovered = await discoverModels(apiKey, apiVersion);
      const modelCandidates = Array.from(new Set([...staticCandidates, ...discovered]));
      for (const candidate of modelCandidates) {
        try {
          text = await callModel(candidate, b64, mimeType, apiKey, apiVersion);
          break;
        } catch (e) {
          lastErr = e;
          const status = Number(e?.statusCode || 0);
          const details = String(e?.details || '').toLowerCase();
          const isModelNotFound = status === 404 || (status === 400 && /not found|unsupported model|is not found/.test(details));
          const isRateLimited = status === 429;
          const isImageProcessError = status === 400 && /unable to process input image|invalid_argument/.test(details);
          if (isModelNotFound) continue;
          if (isRateLimited) {
            // Try next model/version/key before failing.
            continue;
          }
          if (isImageProcessError) {
            // Some models reject certain image encodings/sizes; try alternatives.
            continue;
          }
          throw e;
        }
      }
      if (text) break;
    }
    if (text) break;
  }

  if (!text) {
    if (Number(lastErr?.statusCode || 0) === 429) {
      const err = new Error('Gemini quota/rate limit reached for configured API key(s). Add another key or retry later.');
      err.statusCode = 429;
      throw err;
    }
    if (Number(lastErr?.statusCode || 0) === 400) {
      const err = new Error('Gemini could not process this image. Try a clearer photo (good lighting, non-blurry, larger image).');
      err.statusCode = 400;
      throw err;
    }
    const modelLabel = lastErr?.modelName ? `${lastErr.modelName}` : 'unknown model';
    const versionLabel = lastErr?.apiVersion ? `${lastErr.apiVersion}` : 'unknown api version';
    throw new Error(`Gemini model unavailable (${modelLabel}, ${versionLabel}). Set GOOGLE_GEMINI_MODEL to a valid model.`);
  }

  // Some models wrap JSON in code fences; try to extract JSON first
  let body = text;
  const fence = body.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fence) body = fence[1];
  return parseModelResponse(body);
}

// POST /api/diet/analyze - multipart image -> AI analysis
router.post('/diet/analyze', verifyToken, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Image is required' });
    // Save to Cloudinary if configured
    let urlOrPath = null;
    try {
      urlOrPath = await saveFile(req.file, 'fitness-buddy/food');
    } catch (uploadErr) {
      console.warn('[diet] saveFile failed, continuing without remote image:', uploadErr?.message || uploadErr);
      urlOrPath = req.file.path ? ('/uploads/' + path.basename(req.file.path)) : null;
    }
    const filePath = req.file.path || null;
    const analysis = await analyzeWithGemini({
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      pathOrUrl: filePath || urlOrPath
    });
    const imagePath = typeof urlOrPath === 'string'
      ? urlOrPath
      : (filePath ? path.basename(filePath) : null);
    res.json({
      image_path: imagePath,
      items: analysis.items,
      calories: analysis.calories,
      macros: analysis.macros,
      raw: analysis.raw
    });
  } catch (err) {
    console.error('diet/analyze error', err);
    const isConfigError = /api key is not configured|GOOGLE_API_KEY|GEMINI_API_KEY/i.test(err?.message || '');
    const geminiStatus = Number(err?.statusCode || ((err?.message || '').match(/Gemini HTTP\s+(\d{3})/) || [])[1] || 0);
    const status = isConfigError ? 503 : (geminiStatus || 500);
    if (status === 429) {
      return res.status(429).json({ error: 'Gemini quota/rate limit reached. Try again later or use a different API key.' });
    }
    res.status(status).json({ error: err?.message || 'Failed to analyze image' });
  }
});

// POST /api/diet/log - persist a confirmed entry
router.post('/diet/log', verifyToken, async (req, res) => {
  const userId = req.user.id;
  const { date, items, calories, macros, image_path } = req.body;
  const day = date || new Date().toISOString().slice(0, 10);
  const itemsArray = Array.isArray(items) ? items : (items ? [items] : []);
  const itemsText = itemsArray.map(x => typeof x === 'string' ? x : (x?.name || JSON.stringify(x))).join(', ');
  const itemsJson = JSON.stringify({ items, macros });
  const cal = calories != null ? Number(calories) : null;
  const p = macros?.protein != null ? Number(macros.protein) : null;
  const c = macros?.carbs != null ? Number(macros.carbs) : null;
  const f = macros?.fat != null ? Number(macros.fat) : null;
  if (mongo.isEnabled()) {
    try {
      await mongo.connect();
      const Food = mongo.collection('food_logs');
      const doc = {
        user_id: mongo.toObjectId(userId),
        date: day, items_text: itemsText, items_json: itemsJson,
        calories: cal, protein: p, carbs: c, fat: f,
        image_path: image_path || null,
        created_at: new Date()
      };
      const ins = await Food.insertOne(doc);
      const row = await Food.findOne({ _id: ins.insertedId });
      return res.json({ id: row._id.toString(), ...row, _id: undefined, user_id: row.user_id.toString() });
    } catch (e) { return res.status(500).json({ error: 'Failed to save log' }); }
  } else {
    db.run(
      `INSERT INTO food_logs (user_id, date, items_text, items_json, calories, protein, carbs, fat, image_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, day, itemsText, itemsJson, cal, p, c, f, image_path || null],
      function (err) {
        if (err) return res.status(500).json({ error: 'Failed to save log' });
        db.get('SELECT * FROM food_logs WHERE id = ?', [this.lastID], (e2, row) => {
          if (e2) return res.status(500).json({ error: 'DB error' });
          res.json(row);
        });
      }
    );
  }
});

// GET /api/diet/logs?date=YYYY-MM-DD - list user logs
router.get('/diet/logs', verifyToken, async (req, res) => {
  const userId = req.user.id;
  const day = req.query.date || new Date().toISOString().slice(0, 10);
  if (mongo.isEnabled()) {
    try {
      await mongo.connect();
      const Food = mongo.collection('food_logs');
      const rows = await Food.find({ user_id: mongo.toObjectId(userId), date: day }).sort({ created_at: -1 }).toArray();
      return res.json(rows.map(r => ({ id: r._id.toString(), user_id: r.user_id.toString(), date: r.date, items_text: r.items_text, items_json: r.items_json, calories: r.calories, protein: r.protein, carbs: r.carbs, fat: r.fat, image_path: r.image_path, created_at: r.created_at })));
    } catch (e) { return res.status(500).json({ error: 'DB error' }); }
  } else {
    db.all('SELECT * FROM food_logs WHERE user_id = ? AND date = ? ORDER BY created_at DESC', [userId, day], (err, rows) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      res.json(rows);
    });
  }
});

module.exports = router;
