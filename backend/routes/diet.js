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

async function callModel(modelName, b64, mimeType) {
  // Prefer direct HTTP to v1beta for widest model compatibility
  const apiKey = process.env.GOOGLE_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
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
    e.details = errBody;
    throw e;
  }
  const json = await resp.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || JSON.stringify(json);
  return text;
}

async function analyzeWithGemini(imagePathOrUrl) {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    // Mock response for development without key
    return {
      items: [
        { name: '2 eggs' },
        { name: '3 bacon strips' },
        { name: '1 toast slice' }
      ],
      calories: 450,
      macros: { protein: 28, carbs: 22, fat: 28 },
      raw: 'mock'
    };
  }
  const envModel = (process.env.GOOGLE_GEMINI_MODEL || '').trim();
  // Prefer most recent multimodal preview if unspecified; fall back to stable 1.5 models
  let modelName = envModel || 'gemini-2.5-flash-preview-09-2025';
  if (/^gemini-?pro$/i.test(modelName)) modelName = 'gemini-1.5-pro-latest';
  if (/^gemini-?pro-?vision$/i.test(modelName)) modelName = 'gemini-1.0-pro-vision';

  // If a local path is provided, read file; if it's a URL (Cloudinary), skip inlineData for now
  let b64;
  let mimeType = 'image/jpeg';
  if (imagePathOrUrl && imagePathOrUrl.startsWith('http')) {
    // For remote URLs, a more advanced approach would fetch and convert to base64.
    // Keep simple: skip analysis in this edge case unless needed.
    // Fall back to mock-like minimal response to avoid blocking.
    return { items: [], calories: null, macros: null, raw: 'url-skip' };
  } else {
    b64 = fs.readFileSync(imagePathOrUrl).toString('base64');
    mimeType = guessMimeFromPath(imagePathOrUrl);
  }

  // Try requested/default model; if it fails for modality, fallback to 1.5-flash-latest then 1.5-pro-latest
  let text;
  try {
    text = await callModel(modelName, b64, mimeType);
  } catch (e) {
    const fallback = 'gemini-1.5-flash-latest';
    if (modelName !== fallback) {
      try {
        text = await callModel(fallback, b64, mimeType);
      } catch (e2) {
        // final fallback to pro-latest
        const fb2 = 'gemini-1.5-pro-latest';
        if (fallback !== fb2) {
          text = await callModel(fb2, b64, mimeType);
        } else {
          throw e2;
        }
      }
    } else {
      throw e;
    }
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
    const urlOrPath = await saveFile(req.file, 'fitness-buddy/food');
    const filePath = req.file.path || urlOrPath;
    const analysis = await analyzeWithGemini(req.file.buffer ? null : filePath);
    res.json({
      image_path: urlOrPath?.startsWith('http') ? urlOrPath : path.basename(filePath),
      items: analysis.items,
      calories: analysis.calories,
      macros: analysis.macros,
      raw: analysis.raw
    });
  } catch (err) {
    console.error('diet/analyze error', err);
    res.status(500).json({ error: 'Failed to analyze image' });
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
