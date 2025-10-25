const express = require('express');
const db = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');
const router = express.Router();

// Utility: compute consecutive-day streak given a Set of ISO yyyy-mm-dd strings
function computeStreak(daysSet) {
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (daysSet.has(key)) streak++; else break;
  }
  return streak;
}

// GET /api/me/streaks -> { gym_streak, diet_streak }
router.get('/me/streaks', verifyToken, (req, res) => {
  const userId = req.user.id;
  const sqlGym = `SELECT DISTINCT date(checkin_at) as d FROM presence WHERE user_id = ?`;
  const sqlDiet = `SELECT DISTINCT date(date) as d FROM food_logs WHERE user_id = ?`;
  db.all(sqlGym, [userId], (e1, gymRows) => {
    if (e1) return res.status(500).json({ error: 'DB error' });
    db.all(sqlDiet, [userId], (e2, dietRows) => {
      if (e2) return res.status(500).json({ error: 'DB error' });
      const gymSet = new Set((gymRows || []).map(r => r.d));
      const dietSet = new Set((dietRows || []).map(r => r.d));
      const gym_streak = computeStreak(gymSet);
      const diet_streak = computeStreak(dietSet);
      res.json({ gym_streak, diet_streak });
    });
  });
});

// GET /api/me/points -> { points, history }
router.get('/me/points', verifyToken, (req, res) => {
  const userId = req.user.id;
  db.get(`SELECT COALESCE(points,0) as points FROM users WHERE id = ?`, [userId], (e, row) => {
    if (e) return res.status(500).json({ error: 'DB error' });
    db.all(`SELECT id, date, reason, points, meta, created_at FROM user_points_log WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`, [userId], (e2, hist) => {
      if (e2) return res.status(500).json({ error: 'DB error' });
      res.json({ points: Number(row?.points || 0), history: hist || [] });
    });
  });
});

// POST /api/me/claim-daily-points -> awards based on today's activity; idempotent per day
router.post('/me/claim-daily-points', verifyToken, (req, res) => {
  const userId = req.user.id;
  const today = new Date().toISOString().slice(0,10);
  // Already claimed?
  db.get(`SELECT 1 FROM user_points_log WHERE user_id = ? AND date = ? AND reason = 'daily'`, [userId, today], (e, row) => {
    if (e) return res.status(500).json({ error: 'DB error' });
    if (row) return res.json({ ok: true, message: 'Already claimed for today' });

    const qGymToday = `SELECT 1 FROM presence WHERE user_id = ? AND date(checkin_at) = ? LIMIT 1`;
    const qDietToday = `SELECT 1 FROM food_logs WHERE user_id = ? AND date(date) = ? LIMIT 1`;
    db.get(qGymToday, [userId, today], (e1, g) => {
      if (e1) return res.status(500).json({ error: 'DB error' });
      db.get(qDietToday, [userId, today], (e2, d) => {
        if (e2) return res.status(500).json({ error: 'DB error' });
        const hasGym = !!g; const hasDiet = !!d;
        if (!hasGym && !hasDiet) return res.status(400).json({ error: 'No activity today to claim points' });
        // Compute current streaks for milestone bonuses
        const sqlGymDays = `SELECT DISTINCT date(checkin_at) as d FROM presence WHERE user_id = ?`;
        const sqlDietDays = `SELECT DISTINCT date(date) as d FROM food_logs WHERE user_id = ?`;
        db.all(sqlGymDays, [userId], (e3, gymRows) => {
          if (e3) return res.status(500).json({ error: 'DB error' });
          db.all(sqlDietDays, [userId], (e4, dietRows) => {
            if (e4) return res.status(500).json({ error: 'DB error' });
            const gym_streak = computeStreak(new Set((gymRows||[]).map(r=>r.d)));
            const diet_streak = computeStreak(new Set((dietRows||[]).map(r=>r.d)));
            let base = 0;
            if (hasGym) base += 10;
            if (hasDiet) base += 5;
            let bonus = 0;
            if (hasGym && gym_streak > 0 && gym_streak % 7 === 0) bonus += 20;
            if (hasDiet && diet_streak > 0 && diet_streak % 7 === 0) bonus += 10;
            const total = base + bonus;
            db.serialize(() => {
              db.run(`INSERT INTO user_points_log (user_id, date, reason, points, meta) VALUES (?, ?, 'daily', ?, ?)`, [userId, today, base, JSON.stringify({ hasGym, hasDiet })]);
              if (bonus) {
                db.run(`INSERT INTO user_points_log (user_id, date, reason, points, meta) VALUES (?, ?, 'bonus', ?, ?)`, [userId, today, bonus, JSON.stringify({ gym_streak, diet_streak })]);
              }
              db.run(`UPDATE users SET points = COALESCE(points,0) + ? WHERE id = ?`, [total, userId], function(err5){
                if (err5) return res.status(500).json({ error: 'Failed to update points' });
                db.get(`SELECT COALESCE(points,0) as points FROM users WHERE id = ?`, [userId], (e6, r) => {
                  if (e6) return res.status(500).json({ error: 'DB error' });
                  res.json({ ok: true, awarded: total, new_balance: Number(r?.points || 0), details: { base, bonus } });
                });
              });
            });
          });
        });
      });
    });
  });
});

// Owner: list my rewards (gyms I own)
router.get('/rewards/my', verifyToken, requireRole('owner'), (req, res) => {
  const ownerId = req.user.id;
  const sql = `SELECT r.* FROM rewards r JOIN gyms g ON g.id = r.gym_id WHERE g.owner_id = ? ORDER BY r.created_at DESC`;
  db.all(sql, [ownerId], (e, rows) => {
    if (e) return res.status(500).json({ error: 'DB error' });
    res.json(rows || []);
  });
});

// Owner: create reward { gym_id, name, cost_points, description }
router.post('/rewards', verifyToken, requireRole('owner'), (req, res) => {
  const ownerId = req.user.id;
  const { gym_id, name, cost_points, description } = req.body || {};
  if (!gym_id || !name || !cost_points) return res.status(400).json({ error: 'gym_id, name, cost_points required' });
  db.get(`SELECT 1 FROM gyms WHERE id = ? AND owner_id = ?`, [gym_id, ownerId], (e, row) => {
    if (e) return res.status(500).json({ error: 'DB error' });
    if (!row) return res.status(403).json({ error: 'Not your gym' });
    db.run(`INSERT INTO rewards (gym_id, name, description, cost_points, active) VALUES (?, ?, ?, ?, 1)`, [gym_id, name, description || null, parseInt(cost_points,10)], function(err2){
      if (err2) return res.status(500).json({ error: 'Failed to create' });
      res.json({ id: this.lastID, gym_id, name, description: description || null, cost_points: parseInt(cost_points,10), active: 1 });
    });
  });
});

// Owner: update reward
router.put('/rewards/:id', verifyToken, requireRole('owner'), (req, res) => {
  const ownerId = req.user.id;
  const id = parseInt(req.params.id,10);
  const { name, description, cost_points, active } = req.body || {};
  const sqlCheck = `SELECT r.*, g.owner_id FROM rewards r JOIN gyms g ON g.id = r.gym_id WHERE r.id = ?`;
  db.get(sqlCheck, [id], (e, r) => {
    if (e) return res.status(500).json({ error: 'DB error' });
    if (!r) return res.status(404).json({ error: 'Not found' });
    if (r.owner_id !== ownerId) return res.status(403).json({ error: 'Forbidden' });
    db.run(`UPDATE rewards SET name = COALESCE(?, name), description = COALESCE(?, description), cost_points = COALESCE(?, cost_points), active = COALESCE(?, active) WHERE id = ?`, [name ?? null, description ?? null, cost_points ?? null, (active==null? null : (active?1:0)), id], function(err2){
      if (err2) return res.status(500).json({ error: 'Failed to update' });
      res.json({ success: true });
    });
  });
});

// Owner: delete reward
router.delete('/rewards/:id', verifyToken, requireRole('owner'), (req, res) => {
  const ownerId = req.user.id;
  const id = parseInt(req.params.id,10);
  const sqlCheck = `SELECT r.*, g.owner_id FROM rewards r JOIN gyms g ON g.id = r.gym_id WHERE r.id = ?`;
  db.get(sqlCheck, [id], (e, r) => {
    if (e) return res.status(500).json({ error: 'DB error' });
    if (!r) return res.status(404).json({ error: 'Not found' });
    if (r.owner_id !== ownerId) return res.status(403).json({ error: 'Forbidden' });
    db.run(`DELETE FROM rewards WHERE id = ?`, [id], function(err2){
      if (err2) return res.status(500).json({ error: 'Failed to delete' });
      res.json({ success: true });
    });
  });
});

// Member: list rewards available for my gym
router.get('/rewards/available', verifyToken, (req, res) => {
  const userId = req.user.id;
  db.get(`SELECT gym_id FROM users WHERE id = ?`, [userId], (e, me) => {
    if (e) return res.status(500).json({ error: 'DB error' });
    if (!me || !me.gym_id) return res.json([]);
    db.all(`SELECT * FROM rewards WHERE gym_id = ? AND active = 1 ORDER BY created_at DESC`, [me.gym_id], (e2, rows) => {
      if (e2) return res.status(500).json({ error: 'DB error' });
      res.json(rows || []);
    });
  });
});

// Member: redeem a reward
router.post('/rewards/:id/redeem', verifyToken, (req, res) => {
  const userId = req.user.id;
  const id = parseInt(req.params.id,10);
  db.get(`SELECT u.id as uid, u.gym_id, COALESCE(u.points,0) as points FROM users u WHERE u.id = ?`, [userId], (e, me) => {
    if (e) return res.status(500).json({ error: 'DB error' });
    if (!me || !me.gym_id) return res.status(400).json({ error: 'Join a gym to redeem rewards' });
    db.get(`SELECT * FROM rewards WHERE id = ? AND active = 1`, [id], (e2, rw) => {
      if (e2) return res.status(500).json({ error: 'DB error' });
      if (!rw) return res.status(404).json({ error: 'Reward not found' });
      if (rw.gym_id !== me.gym_id) return res.status(400).json({ error: 'Reward not available for your gym' });
      if (me.points < rw.cost_points) return res.status(400).json({ error: 'Not enough points' });
      db.serialize(() => {
        db.run(`INSERT INTO reward_redemptions (user_id, reward_id) VALUES (?, ?)`, [userId, id]);
        db.run(`INSERT INTO user_points_log (user_id, date, reason, points, meta) VALUES (?, date('now'), 'redeem', ?, ?)`, [userId, -rw.cost_points, JSON.stringify({ reward_id: id })]);
        db.run(`UPDATE users SET points = COALESCE(points,0) - ? WHERE id = ?`, [rw.cost_points, userId], function(err3){
          if (err3) return res.status(500).json({ error: 'Failed to deduct points' });
          db.get(`SELECT COALESCE(points,0) as points FROM users WHERE id = ?`, [userId], (e4, r) => {
            if (e4) return res.status(500).json({ error: 'DB error' });
            res.json({ success: true, new_balance: Number(r?.points || 0) });
          });
        });
      });
    });
  });
});

// Home workout suggestions (bodyweight only)
router.get('/home-workout', verifyToken, (req, res) => {
  const level = (req.query.level || 'easy').toLowerCase();
  const catalog = [
    { name: 'Bodyweight Squats', reps: { easy: '3x12', medium: '4x15', hard: '5x20' } },
    { name: 'Push-ups', reps: { easy: '3x8', medium: '4x12', hard: '5x15' } },
    { name: 'Glute Bridges', reps: { easy: '3x12', medium: '4x15', hard: '5x20' } },
    { name: 'Reverse Lunges', reps: { easy: '3x10/leg', medium: '4x12/leg', hard: '5x15/leg' } },
    { name: 'Plank', reps: { easy: '3x30s', medium: '4x45s', hard: '5x60s' } },
    { name: 'Mountain Climbers', reps: { easy: '3x20', medium: '4x30', hard: '5x40' } },
    { name: 'Supermans', reps: { easy: '3x10', medium: '4x12', hard: '5x15' } },
  ];
  // Simple randomized 5-exercise plan
  const shuffled = catalog.sort(() => Math.random() - 0.5);
  const plan = shuffled.slice(0, 5).map(x => ({ name: x.name, prescription: x.reps[level] || x.reps.easy }));
  res.json({ title: `Home Workout (${level})`, est_time_min: level==='hard'?40: level==='medium'?30:20, exercises: plan });
});

module.exports = router;
