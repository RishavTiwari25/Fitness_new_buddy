/**
 * Weekly AI Insights cron.
 * Every Monday 08:00 (configurable via WEEKLY_INSIGHTS_CRON) drop a notification
 * to every member so their weekly AI progress report is surfaced. The full
 * report is generated on demand (POST /api/coach/insights) when they open the
 * AI Coach — keeping the scheduled job cheap and avoiding a fan-out of LLM calls.
 *
 * Disable with DISABLE_CRON=1. Runs inside the web process (fine for a single
 * instance); for multi-instance deploys use a Render Cron Job hitting an
 * internal endpoint instead.
 */
const cron = require('node-cron');
const db = require('../db');
const mongo = require('./mongo');

const MESSAGE = 'Your weekly AI insights are ready — open the AI Coach to see your progress report.';

async function runWeekly() {
  if (mongo.isEnabled()) {
    await mongo.connect();
    const members = await mongo.collection('users').find({ role: 'member' }, { projection: { _id: 1 } }).toArray();
    if (members.length) {
      const now = new Date();
      await mongo.collection('notifications').insertMany(
        members.map(u => ({ user_id: u._id, type: 'weekly_insights', message: MESSAGE, created_at: now }))
      );
    }
    return members.length;
  }
  return new Promise((resolve) => {
    db.all("SELECT id FROM users WHERE role = 'member'", [], (err, rows) => {
      if (err || !rows || !rows.length) return resolve(0);
      const stmt = db.prepare("INSERT INTO notifications (user_id, type, message) VALUES (?, 'weekly_insights', ?)");
      rows.forEach(r => stmt.run(r.id, MESSAGE));
      stmt.finalize(() => resolve(rows.length));
    });
  });
}

function start() {
  if (process.env.DISABLE_CRON === '1') return;
  const schedule = process.env.WEEKLY_INSIGHTS_CRON || '0 8 * * 1'; // Mon 08:00
  if (!cron.validate(schedule)) {
    console.warn('[cron] invalid WEEKLY_INSIGHTS_CRON, skipping:', schedule);
    return;
  }
  cron.schedule(schedule, () => {
    runWeekly()
      .then(n => console.log(`[cron] weekly insights notified ${n} member(s)`))
      .catch(e => console.warn('[cron] weekly insights failed:', e.message));
  });
  console.log('[cron] weekly insights scheduled:', schedule);
}

module.exports = { start, runWeekly };
