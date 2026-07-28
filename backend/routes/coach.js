/**
 * =============================================
 * AI PERSONAL TRAINER — RAG COACH CHAT (coach.js)
 * =============================================
 * POST /api/coach/chat  (auth required)
 *
 * A retrieval-augmented fitness/nutrition coach. The client sends the
 * conversation plus the user's OWN retrieved data (streaks, points, profile,
 * recent bookings, recent meals); this route injects that context into a
 * Gemini system instruction and STREAMS the reply back to the browser over
 * Server-Sent Events.
 *
 * Model + key reuse the same convention as routes/diet.js so one env var
 * powers all AI features. No key committed — set GEMINI_API_KEY (or
 * GOOGLE_API_KEY) in the backend environment.
 */
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');

function getGeminiKey() {
  return (
    process.env.GOOGLE_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    ''
  ).trim();
}

const MODEL = (process.env.GOOGLE_GEMINI_MODEL || 'gemini-2.5-flash').trim();

// Assemble the retrieved user context into a compact, model-friendly block.
function buildSystemPrompt(user, ctx = {}) {
  const name = ctx.profile?.name || ctx.profile?.username || (user?.email ? user.email.split('@')[0] : 'there');
  const L = [];
  L.push('You are FitCoach, an expert, encouraging fitness & nutrition coach inside the Fitness Buddy app.');
  L.push(`You are talking to ${name} (account role: ${user?.role || 'member'}).`);
  L.push('Be concise, warm, and specific. Give actionable advice grounded in the user data below.');
  L.push('Never invent metrics that are not present. If the user asks about something outside health/fitness/nutrition, answer briefly and steer back. Prefer short paragraphs or tight bullet lists. Keep replies under ~180 words unless asked for a full plan.');
  L.push('');
  L.push('=== RETRIEVED USER DATA ===');
  if (ctx.streaks) L.push(`Streaks — gym: ${ctx.streaks.gym_streak ?? 0} day(s), diet: ${ctx.streaks.diet_streak ?? 0} day(s).`);
  if (typeof ctx.points === 'number') L.push(`Reward points: ${ctx.points}.`);
  if (ctx.profile) {
    const p = ctx.profile;
    const bits = [];
    if (p.weight) bits.push(`weight ${p.weight}`);
    if (p.height) bits.push(`height ${p.height}`);
    if (p.age) bits.push(`age ${p.age}`);
    if (p.goal) bits.push(`goal ${p.goal}`);
    if (p.bio) bits.push(`bio "${String(p.bio).slice(0, 200)}"`);
    if (bits.length) L.push(`Profile — ${bits.join(', ')}.`);
  }
  if (Array.isArray(ctx.bookings) && ctx.bookings.length) {
    L.push('Recent equipment bookings:');
    ctx.bookings.slice(0, 5).forEach(b =>
      L.push(`  - ${b.equipment_name || 'Equipment'} on ${b.slot_date || '?'} ${b.slot_time || ''} (${b.status || 'pending'})`)
    );
  }
  if (Array.isArray(ctx.dietLogs) && ctx.dietLogs.length) {
    L.push('Recent meals logged:');
    ctx.dietLogs.slice(0, 7).forEach(m =>
      L.push(`  - ${m.name || m.food_name || 'meal'}: ${m.calories ?? '?'} kcal (P${m.protein ?? '?'} / C${m.carbs ?? '?'} / F${m.fat ?? '?'})`)
    );
  }
  if (L[L.length - 1] === '=== RETRIEVED USER DATA ===') L.push('(No activity recorded yet — encourage the user to log a workout or meal.)');
  L.push('=== END USER DATA ===');
  return L.join('\n');
}

router.post('/coach/chat', verifyToken, async (req, res) => {
  const key = getGeminiKey();
  if (!key) return res.status(503).json({ error: 'AI coach is not configured. Set GEMINI_API_KEY in the backend environment.' });

  const { messages = [], context = {} } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  const systemInstruction = { parts: [{ text: buildSystemPrompt(req.user, context) }] };
  // Keep the last 16 turns; map assistant->model for the Gemini API.
  const contents = messages.slice(-16).map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: String(m.content || '').slice(0, 4000) }],
  }));

  const body = {
    systemInstruction,
    contents,
    generationConfig: { temperature: 0.7, maxOutputTokens: 900, topP: 0.95 },
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:streamGenerateContent?alt=sse&key=${key}`;

  // Open the SSE channel to the browser.
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable proxy buffering (nginx/Render)
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text().catch(() => '');
      res.write(`event: error\ndata: ${JSON.stringify({ error: `Gemini HTTP ${upstream.status}`, detail: detail.slice(0, 300) })}\n\n`);
      return res.end();
    }

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        const jsonStr = line.slice(5).trim();
        if (!jsonStr || jsonStr === '[DONE]') continue;
        try {
          const obj = JSON.parse(jsonStr);
          const text = (obj?.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
          if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`);
        } catch (_) { /* ignore partial/non-JSON keepalives */ }
      }
    }
    res.write('event: done\ndata: {}\n\n');
    res.end();
  } catch (e) {
    res.write(`event: error\ndata: ${JSON.stringify({ error: e.message || 'stream failed' })}\n\n`);
    res.end();
  }
});

module.exports = router;
