/**
 * =============================================
 * AI FEATURES (ai.js) — non-streaming Gemini endpoints
 * =============================================
 *  - POST /api/ai/search         Feature 3: semantic search over a catalog (embeddings + cosine)
 *  - POST /api/ai/parse-booking  Feature 2: NL booking request -> structured intent
 *  - POST /api/coach/insights    Feature 4: weekly progress report (LLM summarization)
 * All require auth. All powered by the same Gemini key as diet analysis + coach.
 */
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const gemini = require('../lib/gemini');

// ---- Feature 3: semantic search / smarter alternatives ------------------
router.post('/ai/search', verifyToken, async (req, res) => {
  try {
    const { query, items } = req.body || {};
    if (!query || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'query and items[] are required' });
    }
    if (!gemini.hasKey()) return res.status(503).json({ error: 'AI search is not configured (missing Gemini key).' });

    const capped = items.slice(0, 100);
    const [qVec, itemVecs] = await Promise.all([
      gemini.embedOne(query),
      gemini.embedMany(capped.map(it => it.text || it.name || '')),
    ]);
    const results = capped
      .map((it, i) => ({ id: it.id, score: Number(gemini.cosine(qVec, itemVecs[i]).toFixed(4)) }))
      .sort((a, b) => b.score - a.score);
    res.json({ results });
  } catch (e) {
    res.status(e.code === 'NO_KEY' ? 503 : 500).json({ error: e.message, detail: e.detail });
  }
});

// ---- Feature 2: natural-language booking -> structured intent -----------
router.post('/ai/parse-booking', verifyToken, async (req, res) => {
  try {
    const { text, equipment, today } = req.body || {};
    if (!text) return res.status(400).json({ error: 'text is required' });
    if (!gemini.hasKey()) return res.status(503).json({ error: 'AI is not configured (missing Gemini key).' });

    const names = Array.isArray(equipment) ? equipment.slice(0, 80) : [];
    const system = "You convert a gym member's natural-language request into a structured booking intent. Output STRICT JSON only, no prose.";
    const prompt = [
      `User request: "${String(text).slice(0, 400)}"`,
      today ? `Today is ${today}. Resolve relative dates (e.g. "tomorrow") to an ISO date YYYY-MM-DD.` : '',
      names.length ? `Available equipment names: ${JSON.stringify(names)}. Set "equipment" to the closest matching name, or null if nothing fits.` : '',
      'Return JSON with keys: action ("book"|"cancel"|"check"|"unknown"), equipment (string|null), date (YYYY-MM-DD|null), time ("HH:MM" 24h|null), confidence (number 0-1), summary (one short human sentence describing the intent).',
    ].filter(Boolean).join('\n');

    const intent = await gemini.generateJSON({ system, prompt });
    res.json({ intent });
  } catch (e) {
    res.status(e.code === 'NO_KEY' ? 503 : 500).json({ error: e.message, detail: e.detail });
  }
});

// ---- Feature 4: weekly insights (LLM summarization) ---------------------
router.post('/coach/insights', verifyToken, async (req, res) => {
  try {
    if (!gemini.hasKey()) return res.status(503).json({ error: 'AI is not configured (missing Gemini key).' });
    const ctx = (req.body && req.body.context) || {};
    const name = ctx.profile?.name || (req.user?.email ? req.user.email.split('@')[0] : 'there');

    const data = [];
    if (ctx.streaks) data.push(`Gym streak: ${ctx.streaks.gym_streak ?? 0} days. Diet streak: ${ctx.streaks.diet_streak ?? 0} days.`);
    if (typeof ctx.points === 'number') data.push(`Reward points: ${ctx.points}.`);
    if (Array.isArray(ctx.bookings) && ctx.bookings.length) {
      data.push(`Recent bookings: ${ctx.bookings.slice(0, 5).map(b => `${b.equipment_name || 'equipment'} (${b.status || 'pending'})`).join('; ')}.`);
    }
    if (Array.isArray(ctx.dietLogs) && ctx.dietLogs.length) {
      data.push(`Recent meals: ${ctx.dietLogs.slice(0, 7).map(m => `${m.name || 'meal'} ${m.calories ?? '?'}kcal`).join('; ')}.`);
    }
    if (!data.length) data.push('No activity has been logged yet this week.');

    const system = 'You are FitCoach generating a concise weekly progress report for a fitness-app member. Output STRICT JSON only.';
    const prompt = [
      `Member: ${name}.`,
      `This week's data:\n${data.join('\n')}`,
      'Return JSON: { "headline": string (<=8 words, motivating), "summary": string (2-3 sentences on the week), "wins": string[] (1-3 short positives), "focus": string[] (1-3 specific actionable goals for next week), "score": number (0-100 consistency estimate) }.',
    ].join('\n');

    const report = await gemini.generateJSON({ system, prompt, temperature: 0.5 });
    res.json({ report });
  } catch (e) {
    res.status(e.code === 'NO_KEY' ? 503 : 500).json({ error: e.message, detail: e.detail });
  }
});

module.exports = router;
