const express = require('express');
const db = require('../db');
const mongo = require('../lib/mongo');
const { toObjectId } = mongo;
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
router.get('/me/streaks', verifyToken, async (req, res) => {
  const userId = req.user.id;
  if (mongo.isEnabled()) {
    try {
      await mongo.connect();
      const Presence = mongo.collection('presence');
      const Food = mongo.collection('food_logs');
      const prs = await Presence.find({ user_id: toObjectId(userId) }).project({ checkin_at: 1 }).toArray();
      const fl = await Food.find({ user_id: toObjectId(userId) }).project({ date: 1 }).toArray();
      const gymSet = new Set(prs.map(p => (p.checkin_at instanceof Date ? p.checkin_at.toISOString().slice(0,10) : new Date(p.checkin_at).toISOString().slice(0,10))));
      const dietSet = new Set(fl.map(f => f.date));
      const gym_streak = computeStreak(gymSet);
      const diet_streak = computeStreak(dietSet);
      return res.json({ gym_streak, diet_streak });
    } catch (e) { return res.status(500).json({ error: 'DB error' }); }
  } else {
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
  }
});

// GET /api/me/points -> { points, history }
router.get('/me/points', verifyToken, async (req, res) => {
  const userId = req.user.id;
  if (mongo.isEnabled()) {
    try {
      await mongo.connect();
      const Users = mongo.collection('users');
      const Log = mongo.collection('user_points_log');
      const user = await Users.findOne({ _id: toObjectId(userId) }, { projection: { points: 1 } });
      const hist = await Log.find({ user_id: toObjectId(userId) }).sort({ created_at: -1 }).limit(100).toArray();
      const mapped = hist.map(h => ({ id: h._id.toString(), date: h.date, reason: h.reason, points: h.points, meta: h.meta, created_at: h.created_at }));
      return res.json({ points: Number(user?.points || 0), history: mapped });
    } catch (e) { return res.status(500).json({ error: 'DB error' }); }
  } else {
    db.get(`SELECT COALESCE(points,0) as points FROM users WHERE id = ?`, [userId], (e, row) => {
      if (e) return res.status(500).json({ error: 'DB error' });
      db.all(`SELECT id, date, reason, points, meta, created_at FROM user_points_log WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`, [userId], (e2, hist) => {
        if (e2) return res.status(500).json({ error: 'DB error' });
        res.json({ points: Number(row?.points || 0), history: hist || [] });
      });
    });
  }
});

// POST /api/me/claim-daily-points -> awards based on today's activity; idempotent per day
router.post('/me/claim-daily-points', verifyToken, async (req, res) => {
  const userId = req.user.id;
  const today = new Date().toISOString().slice(0,10);
  if (mongo.isEnabled()) {
    try {
      await mongo.connect();
      const Log = mongo.collection('user_points_log');
      const Presence = mongo.collection('presence');
      const Food = mongo.collection('food_logs');
      const Users = mongo.collection('users');
      const already = await Log.findOne({ user_id: toObjectId(userId), date: today, reason: 'daily' });
      if (already) return res.json({ ok: true, message: 'Already claimed for today' });
      const hasGym = !!(await Presence.findOne({ user_id: toObjectId(userId), checkin_at: { $gte: new Date(`${today}T00:00:00.000Z`), $lte: new Date(`${today}T23:59:59.999Z`) } }));
      const hasDiet = !!(await Food.findOne({ user_id: toObjectId(userId), date: today }));
      if (!hasGym && !hasDiet) return res.status(400).json({ error: 'No activity today to claim points' });
      const prs = await Presence.find({ user_id: toObjectId(userId) }).project({ checkin_at: 1 }).toArray();
      const fl = await Food.find({ user_id: toObjectId(userId) }).project({ date: 1 }).toArray();
      const gym_streak = computeStreak(new Set(prs.map(p => (p.checkin_at instanceof Date ? p.checkin_at.toISOString().slice(0,10) : new Date(p.checkin_at).toISOString().slice(0,10)))));
      const diet_streak = computeStreak(new Set(fl.map(f => f.date)));
      let base = 0;
      if (hasGym) base += 10;
      if (hasDiet) base += 5;
      let bonus = 0;
      if (hasGym && gym_streak > 0 && gym_streak % 7 === 0) bonus += 20;
      if (hasDiet && diet_streak > 0 && diet_streak % 7 === 0) bonus += 10;
      const total = base + bonus;
      const now = new Date();
      const writes = [];
      writes.push(Log.insertOne({ user_id: toObjectId(userId), date: today, reason: 'daily', points: base, meta: { hasGym, hasDiet }, created_at: now }));
      if (bonus) writes.push(Log.insertOne({ user_id: toObjectId(userId), date: today, reason: 'bonus', points: bonus, meta: { gym_streak, diet_streak }, created_at: now }));
      await Promise.all(writes);
      await Users.updateOne({ _id: toObjectId(userId) }, { $inc: { points: total } });
      const user = await Users.findOne({ _id: toObjectId(userId) }, { projection: { points: 1 } });
      return res.json({ ok: true, awarded: total, new_balance: Number(user?.points || 0), details: { base, bonus } });
    } catch (e) { return res.status(500).json({ error: 'Failed to update points' }); }
  } else {
    // SQLite fallback
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
  }
});

// Owner: list my rewards (gyms I own)
router.get('/rewards/my', verifyToken, requireRole('owner'), async (req, res) => {
  const ownerId = req.user.id;
  if (mongo.isEnabled()) {
    try {
      await mongo.connect();
      const Gyms = mongo.collection('gyms');
      const Rewards = mongo.collection('rewards');
      const gyms = await Gyms.find({ owner_id: toObjectId(ownerId) }).project({ _id: 1 }).toArray();
      const ids = gyms.map(g => g._id);
      const rows = await Rewards.find({ gym_id: { $in: ids } }).sort({ created_at: -1 }).toArray();
      return res.json(rows.map(r => ({ id: r._id.toString(), gym_id: r.gym_id.toString(), name: r.name, description: r.description, cost_points: r.cost_points, active: !!r.active, created_at: r.created_at })));
    } catch (e) { return res.status(500).json({ error: 'DB error' }); }
  } else {
    const sql = `SELECT r.* FROM rewards r JOIN gyms g ON g.id = r.gym_id WHERE g.owner_id = ? ORDER BY r.created_at DESC`;
    db.all(sql, [ownerId], (e, rows) => {
      if (e) return res.status(500).json({ error: 'DB error' });
      res.json(rows || []);
    });
  }
});

// Owner: create reward { gym_id, name, cost_points, description }
router.post('/rewards', verifyToken, requireRole('owner'), async (req, res) => {
  const ownerId = req.user.id;
  const { gym_id, name, cost_points, description } = req.body || {};
  if (!gym_id || !name || !cost_points) return res.status(400).json({ error: 'gym_id, name, cost_points required' });
  if (mongo.isEnabled()) {
    try {
      await mongo.connect();
      const Gyms = mongo.collection('gyms');
      const Rewards = mongo.collection('rewards');
      const gym = await Gyms.findOne({ _id: toObjectId(gym_id) });
      if (!gym) return res.status(404).json({ error: 'Gym not found' });
      if (gym.owner_id.toString() !== ownerId) return res.status(403).json({ error: 'Not your gym' });
      const doc = { gym_id: gym._id, name, description: description || null, cost_points: parseInt(cost_points, 10), active: true, created_at: new Date() };
      const ins = await Rewards.insertOne(doc);
      return res.json({ id: ins.insertedId.toString(), gym_id: gym._id.toString(), name, description: description || null, cost_points: parseInt(cost_points,10), active: true });
    } catch (e) { return res.status(500).json({ error: 'Failed to create' }); }
  } else {
    db.get(`SELECT 1 FROM gyms WHERE id = ? AND owner_id = ?`, [gym_id, ownerId], (e, row) => {
      if (e) return res.status(500).json({ error: 'DB error' });
      if (!row) return res.status(403).json({ error: 'Not your gym' });
      db.run(`INSERT INTO rewards (gym_id, name, description, cost_points, active) VALUES (?, ?, ?, ?, 1)`, [gym_id, name, description || null, parseInt(cost_points,10)], function(err2){
        if (err2) return res.status(500).json({ error: 'Failed to create' });
        res.json({ id: this.lastID, gym_id, name, description: description || null, cost_points: parseInt(cost_points,10), active: 1 });
      });
    });
  }
});

// Owner: update reward
router.put('/rewards/:id', verifyToken, requireRole('owner'), async (req, res) => {
  const ownerId = req.user.id;
  const id = req.params.id;
  const { name, description, cost_points, active } = req.body || {};
  if (mongo.isEnabled()) {
    try {
      await mongo.connect();
      const Rewards = mongo.collection('rewards');
      const Gyms = mongo.collection('gyms');
      const r = await Rewards.findOne({ _id: toObjectId(id) });
      if (!r) return res.status(404).json({ error: 'Not found' });
      const g = await Gyms.findOne({ _id: r.gym_id });
      if (!g) return res.status(404).json({ error: 'Gym not found' });
      if (g.owner_id.toString() !== ownerId) return res.status(403).json({ error: 'Forbidden' });
      const update = {
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(cost_points !== undefined ? { cost_points: parseInt(cost_points, 10) } : {}),
        ...(active !== undefined ? { active: !!active } : {}),
      };
      await Rewards.updateOne({ _id: r._id }, { $set: update });
      return res.json({ success: true });
    } catch (e) { return res.status(500).json({ error: 'Failed to update' }); }
  } else {
    const sqlCheck = `SELECT r.*, g.owner_id FROM rewards r JOIN gyms g ON g.id = r.gym_id WHERE r.id = ?`;
    db.get(sqlCheck, [parseInt(id,10)], (e, r) => {
      if (e) return res.status(500).json({ error: 'DB error' });
      if (!r) return res.status(404).json({ error: 'Not found' });
      if (r.owner_id !== ownerId) return res.status(403).json({ error: 'Forbidden' });
      db.run(`UPDATE rewards SET name = COALESCE(?, name), description = COALESCE(?, description), cost_points = COALESCE(?, cost_points), active = COALESCE(?, active) WHERE id = ?`, [name ?? null, description ?? null, cost_points ?? null, (active==null? null : (active?1:0)), parseInt(id,10)], function(err2){
        if (err2) return res.status(500).json({ error: 'Failed to update' });
        res.json({ success: true });
      });
    });
  }
});

// Owner: delete reward
router.delete('/rewards/:id', verifyToken, requireRole('owner'), async (req, res) => {
  const ownerId = req.user.id;
  const id = req.params.id;
  if (mongo.isEnabled()) {
    try {
      await mongo.connect();
      const Rewards = mongo.collection('rewards');
      const Gyms = mongo.collection('gyms');
      const r = await Rewards.findOne({ _id: toObjectId(id) });
      if (!r) return res.status(404).json({ error: 'Not found' });
      const g = await Gyms.findOne({ _id: r.gym_id });
      if (!g) return res.status(404).json({ error: 'Gym not found' });
      if (g.owner_id.toString() !== ownerId) return res.status(403).json({ error: 'Forbidden' });
      await Rewards.deleteOne({ _id: r._id });
      return res.json({ success: true });
    } catch (e) { return res.status(500).json({ error: 'Failed to delete' }); }
  } else {
    const sqlCheck = `SELECT r.*, g.owner_id FROM rewards r JOIN gyms g ON g.id = r.gym_id WHERE r.id = ?`;
    db.get(sqlCheck, [parseInt(id,10)], (e, r) => {
      if (e) return res.status(500).json({ error: 'DB error' });
      if (!r) return res.status(404).json({ error: 'Not found' });
      if (r.owner_id !== ownerId) return res.status(403).json({ error: 'Forbidden' });
      db.run(`DELETE FROM rewards WHERE id = ?`, [parseInt(id,10)], function(err2){
        if (err2) return res.status(500).json({ error: 'Failed to delete' });
        res.json({ success: true });
      });
    });
  }
});

// Member: list rewards available for my gym
router.get('/rewards/available', verifyToken, async (req, res) => {
  const userId = req.user.id;
  if (mongo.isEnabled()) {
    try {
      await mongo.connect();
      const Users = mongo.collection('users');
      const Rewards = mongo.collection('rewards');
      const me = await Users.findOne({ _id: toObjectId(userId) }, { projection: { gym_id: 1 } });
      if (!me || !me.gym_id) return res.json([]);
      const rows = await Rewards.find({ gym_id: me.gym_id, active: true }).sort({ created_at: -1 }).toArray();
      return res.json(rows.map(r => ({ id: r._id.toString(), gym_id: r.gym_id.toString(), name: r.name, description: r.description, cost_points: r.cost_points, active: !!r.active, created_at: r.created_at })));
    } catch (e) { return res.status(500).json({ error: 'DB error' }); }
  } else {
    db.get(`SELECT gym_id FROM users WHERE id = ?`, [userId], (e, me) => {
      if (e) return res.status(500).json({ error: 'DB error' });
      if (!me || !me.gym_id) return res.json([]);
      db.all(`SELECT * FROM rewards WHERE gym_id = ? AND active = 1 ORDER BY created_at DESC`, [me.gym_id], (e2, rows) => {
        if (e2) return res.status(500).json({ error: 'DB error' });
        res.json(rows || []);
      });
    });
  }
});

// Member: redeem a reward
router.post('/rewards/:id/redeem', verifyToken, async (req, res) => {
  const userId = req.user.id;
  const id = req.params.id;
  if (mongo.isEnabled()) {
    try {
      await mongo.connect();
      const Users = mongo.collection('users');
      const Rewards = mongo.collection('rewards');
      const Redeems = mongo.collection('reward_redemptions');
      const Log = mongo.collection('user_points_log');
      const me = await Users.findOne({ _id: toObjectId(userId) }, { projection: { gym_id: 1, points: 1 } });
      if (!me || !me.gym_id) return res.status(400).json({ error: 'Join a gym to redeem rewards' });
      const rw = await Rewards.findOne({ _id: toObjectId(id), active: true });
      if (!rw) return res.status(404).json({ error: 'Reward not found' });
      if (rw.gym_id.toString() !== me.gym_id.toString()) return res.status(400).json({ error: 'Reward not available for your gym' });
      const currentPoints = Number(me.points || 0);
      if (currentPoints < rw.cost_points) return res.status(400).json({ error: 'Not enough points' });
      const now = new Date();
      await Redeems.insertOne({ user_id: toObjectId(userId), reward_id: rw._id, created_at: now });
      await Log.insertOne({ user_id: toObjectId(userId), date: now.toISOString().slice(0,10), reason: 'redeem', points: -Math.abs(rw.cost_points), meta: { reward_id: id }, created_at: now });
      await Users.updateOne({ _id: toObjectId(userId) }, { $inc: { points: -Math.abs(rw.cost_points) } });
      const updated = await Users.findOne({ _id: toObjectId(userId) }, { projection: { points: 1 } });
      return res.json({ success: true, new_balance: Number(updated?.points || 0) });
    } catch (e) { return res.status(500).json({ error: 'Failed to redeem' }); }
  } else {
    const idNum = parseInt(id,10);
    db.get(`SELECT u.id as uid, u.gym_id, COALESCE(u.points,0) as points FROM users u WHERE u.id = ?`, [userId], (e, me) => {
      if (e) return res.status(500).json({ error: 'DB error' });
      if (!me || !me.gym_id) return res.status(400).json({ error: 'Join a gym to redeem rewards' });
      db.get(`SELECT * FROM rewards WHERE id = ? AND active = 1`, [idNum], (e2, rw) => {
        if (e2) return res.status(500).json({ error: 'DB error' });
        if (!rw) return res.status(404).json({ error: 'Reward not found' });
        if (rw.gym_id !== me.gym_id) return res.status(400).json({ error: 'Reward not available for your gym' });
        if (me.points < rw.cost_points) return res.status(400).json({ error: 'Not enough points' });
        db.serialize(() => {
          db.run(`INSERT INTO reward_redemptions (user_id, reward_id) VALUES (?, ?)`, [userId, idNum]);
          db.run(`INSERT INTO user_points_log (user_id, date, reason, points, meta) VALUES (?, date('now'), 'redeem', ?, ?)`, [userId, -rw.cost_points, JSON.stringify({ reward_id: idNum })]);
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
  }
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
