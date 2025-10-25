const express = require('express');
const db = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');
const router = express.Router();

function addMonths(dateIso, months) {
  const d = dateIso ? new Date(dateIso) : new Date();
  const nd = new Date(d.getFullYear(), d.getMonth() + months, d.getDate());
  return nd.toISOString().slice(0,10);
}

// ----- Owner: memberships -----
router.get('/owner/members', verifyToken, requireRole('owner'), (req, res) => {
  // list members for all gyms owned by this owner
  const ownerId = req.user.id;
  const sql = `
    SELECT u.id as user_id, u.name, u.email, u.gym_id,
           mb.monthly_fee, mb.next_due_date
    FROM users u
    JOIN gyms g ON g.id = u.gym_id
    LEFT JOIN memberships mb ON mb.user_id = u.id
    WHERE g.owner_id = ? AND u.role = 'member'
    ORDER BY COALESCE(u.name, u.email) COLLATE NOCASE ASC
  `;
  db.all(sql, [ownerId], (e, rows) => {
    if (e) return res.status(500).json({ error: 'DB error' });
    res.json(rows || []);
  });
});

router.get('/owner/memberships', verifyToken, requireRole('owner'), (req, res) => {
  const ownerId = req.user.id;
  const gymId = req.query.gymId ? parseInt(req.query.gymId,10) : null;
  const base = `SELECT u.id as user_id, u.name, u.email, u.gym_id, mb.monthly_fee, mb.next_due_date,
    (SELECT MAX(created_at) FROM payments p WHERE p.user_id = u.id AND p.gym_id = u.gym_id) as last_payment_at
    FROM users u JOIN gyms g ON g.id = u.gym_id LEFT JOIN memberships mb ON mb.user_id = u.id WHERE g.owner_id = ? AND u.role = 'member'`;
  const sql = gymId ? base + ' AND u.gym_id = ? ORDER BY u.name' : base + ' ORDER BY u.name';
  const params = gymId ? [ownerId, gymId] : [ownerId];
  db.all(sql, params, (e, rows) => {
    if (e) return res.status(500).json({ error: 'DB error' });
    res.json(rows || []);
  });
});

router.post('/owner/memberships/upsert', verifyToken, requireRole('owner'), (req, res) => {
  const ownerId = req.user.id;
  const { user_id, monthly_fee, next_due_date } = req.body || {};
  if (!user_id || !monthly_fee) return res.status(400).json({ error: 'user_id and monthly_fee required' });
  // verify that the user belongs to a gym owned by this owner
  const q = `SELECT u.id, u.gym_id, g.owner_id FROM users u JOIN gyms g ON g.id = u.gym_id WHERE u.id = ?`;
  db.get(q, [user_id], (e, u) => {
    if (e) return res.status(500).json({ error: 'DB error' });
    if (!u) return res.status(404).json({ error: 'User not found' });
    if (u.owner_id !== ownerId) return res.status(403).json({ error: 'Forbidden' });
    const up = `INSERT INTO memberships (user_id, gym_id, monthly_fee, next_due_date) VALUES (?, ?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET monthly_fee=excluded.monthly_fee, next_due_date=excluded.next_due_date`;
    db.run(up, [user_id, u.gym_id, Number(monthly_fee), next_due_date || null], function(err2){
      if (err2) return res.status(500).json({ error: 'Failed to save' });
      res.json({ success: true });
    });
  });
});

router.post('/owner/memberships/:userId/remind', verifyToken, requireRole('owner'), (req, res) => {
  const ownerId = req.user.id;
  const userId = parseInt(req.params.userId, 10);
  const q = `SELECT u.id, u.gym_id, g.owner_id FROM users u JOIN gyms g ON g.id = u.gym_id WHERE u.id = ?`;
  db.get(q, [userId], (e, u) => {
    if (e) return res.status(500).json({ error: 'DB error' });
    if (!u) return res.status(404).json({ error: 'User not found' });
    if (u.owner_id !== ownerId) return res.status(403).json({ error: 'Forbidden' });
    db.run(`INSERT INTO notifications (user_id, type, message) VALUES (?, 'billing_reminder', 'Your gym membership fee is due soon.')`, [userId], function(err2){
      if (err2) return res.status(500).json({ error: 'Failed to create reminder' });
      res.json({ success: true });
    });
  });
});

router.post('/owner/payments/record', verifyToken, requireRole('owner'), (req, res) => {
  const ownerId = req.user.id;
  const { user_id, amount, method } = req.body || {};
  if (!user_id || !amount) return res.status(400).json({ error: 'user_id and amount required' });
  const q = `SELECT u.id, u.gym_id, g.owner_id, mb.next_due_date FROM users u JOIN gyms g ON g.id = u.gym_id LEFT JOIN memberships mb ON mb.user_id = u.id WHERE u.id = ?`;
  db.get(q, [user_id], (e, u) => {
    if (e) return res.status(500).json({ error: 'DB error' });
    if (!u) return res.status(404).json({ error: 'User not found' });
    if (u.owner_id !== ownerId) return res.status(403).json({ error: 'Forbidden' });
    db.serialize(() => {
      db.run(`INSERT INTO payments (user_id, gym_id, amount, method, txn_ref) VALUES (?, ?, ?, ?, ?)`, [user_id, u.gym_id, Number(amount), method || 'cash', null]);
      const newDue = addMonths(u.next_due_date || new Date().toISOString().slice(0,10), 1);
      db.run(`INSERT INTO memberships (user_id, gym_id, monthly_fee, next_due_date) VALUES (?, ?, COALESCE((SELECT monthly_fee FROM memberships WHERE user_id = ?), ?), ?)
              ON CONFLICT(user_id) DO UPDATE SET next_due_date = excluded.next_due_date`, [user_id, u.gym_id, user_id, Number(amount), newDue]);
    });
    res.json({ success: true });
  });
});

// Owner: list recent payments for a specific member (authorization: must own member's gym)
router.get('/owner/payments', verifyToken, requireRole('owner'), (req, res) => {
  const ownerId = req.user.id;
  const userId = parseInt(req.query.userId, 10);
  const limit = Math.min(parseInt(req.query.limit || '20', 10) || 20, 50);
  if (!userId) return res.status(400).json({ error: 'userId required' });
  const q = `SELECT u.id, u.gym_id, g.owner_id FROM users u JOIN gyms g ON g.id = u.gym_id WHERE u.id = ?`;
  db.get(q, [userId], (e, u) => {
    if (e) return res.status(500).json({ error: 'DB error' });
    if (!u) return res.status(404).json({ error: 'User not found' });
    if (u.owner_id !== ownerId) return res.status(403).json({ error: 'Forbidden' });
    db.all(`SELECT id, gym_id, amount, method, txn_ref, created_at FROM payments WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`, [userId, limit], (e2, rows) => {
      if (e2) return res.status(500).json({ error: 'DB error' });
      res.json(rows || []);
    });
  });
});

// Member: membership details
router.get('/me/membership', verifyToken, (req, res) => {
  const userId = req.user.id;
  db.get(`SELECT mb.*, COALESCE(u.points,0) as points FROM memberships mb LEFT JOIN users u ON u.id = mb.user_id WHERE mb.user_id = ?`, [userId], (e, row) => {
    if (e) return res.status(500).json({ error: 'DB error' });
    db.all(`SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`, [userId], (e2, pay) => {
      if (e2) return res.status(500).json({ error: 'DB error' });
      res.json({ billing: row || null, payments: pay || [] });
    });
  });
});

// Mock payment integration for dev
router.post('/payments/mock/create-order', verifyToken, (req, res) => {
  const { amount } = req.body || {};
  if (!amount) return res.status(400).json({ error: 'amount required' });
  const order_id = 'mock_' + Date.now().toString(36);
  res.json({ order_id, amount: Number(amount) });
});

router.post('/payments/mock/confirm', verifyToken, (req, res) => {
  const userId = req.user.id;
  const { order_id, amount } = req.body || {};
  if (!order_id || !amount) return res.status(400).json({ error: 'order_id and amount required' });
  db.get(`SELECT gym_id FROM users WHERE id = ?`, [userId], (e, me) => {
    if (e) return res.status(500).json({ error: 'DB error' });
    const gymId = me?.gym_id || null;
    db.serialize(() => {
      db.run(`INSERT INTO payments (user_id, gym_id, amount, method, txn_ref) VALUES (?, ?, ?, 'online', ?)`, [userId, gymId, Number(amount), order_id]);
      db.run(`UPDATE memberships SET next_due_date = date(COALESCE(next_due_date, date('now')), '+1 month') WHERE user_id = ?`, [userId]);
    });
    res.json({ success: true });
  });
});

// ----- Trainer tools -----
router.get('/trainer/clients', verifyToken, requireRole('trainer'), (req, res) => {
  const trainerId = req.user.id;
  const sql = `SELECT tc.member_id as id, u.name, u.email, u.gym_id FROM trainer_clients tc JOIN users u ON u.id = tc.member_id WHERE tc.trainer_id = ? ORDER BY COALESCE(u.name,u.email)`;
  db.all(sql, [trainerId], (e, rows) => {
    if (e) return res.status(500).json({ error: 'DB error' });
    res.json(rows || []);
  });
});

router.post('/trainer/clients', verifyToken, requireRole('trainer'), (req, res) => {
  const trainerId = req.user.id;
  const { client_id } = req.body || {};
  if (!client_id) return res.status(400).json({ error: 'client_id required' });
  // Require same gym
  const q = `SELECT a.gym_id as g1, b.gym_id as g2 FROM users a, users b WHERE a.id = ? AND b.id = ?`;
  db.get(q, [trainerId, client_id], (e, row) => {
    if (e) return res.status(500).json({ error: 'DB error' });
    if (!row || !row.g1 || row.g1 !== row.g2) return res.status(400).json({ error: 'Client must be in your gym' });
    db.run(`INSERT OR IGNORE INTO trainer_clients (trainer_id, member_id) VALUES (?, ?)`, [trainerId, client_id], function(err2){
      if (err2) return res.status(500).json({ error: 'Failed to add client' });
      res.json({ success: true });
    });
  });
});

router.delete('/trainer/clients/:clientId', verifyToken, requireRole('trainer'), (req, res) => {
  const trainerId = req.user.id;
  const clientId = parseInt(req.params.clientId, 10);
  db.run(`DELETE FROM trainer_clients WHERE trainer_id = ? AND member_id = ?`, [trainerId, clientId], function(err){
    if (err) return res.status(500).json({ error: 'Failed to remove' });
    res.json({ success: true });
  });
});

router.get('/trainer/clients/:clientId/diet-logs', verifyToken, requireRole('trainer'), (req, res) => {
  const trainerId = req.user.id;
  const clientId = parseInt(req.params.clientId, 10);
  const linkSql = `SELECT 1 FROM trainer_clients WHERE trainer_id = ? AND member_id = ?`;
  db.get(linkSql, [trainerId, clientId], (e, link) => {
    if (e) return res.status(500).json({ error: 'DB error' });
    if (!link) return res.status(403).json({ error: 'Not your client' });
    const permSql = `SELECT COALESCE(allow_trainer_access,0) as allow_trainer_access, COALESCE(allow_calorie_share,0) as allow_calorie_share FROM users WHERE id = ?`;
    db.get(permSql, [clientId], (e2, p) => {
      if (e2) return res.status(500).json({ error: 'DB error' });
      if (!p || (!p.allow_trainer_access && !p.allow_calorie_share)) return res.status(403).json({ error: 'Client has not granted access' });
      db.all(`SELECT id, date, calories, protein, carbs, fat, items_text FROM food_logs WHERE user_id = ? ORDER BY date DESC LIMIT 30`, [clientId], (e3, rows) => {
        if (e3) return res.status(500).json({ error: 'DB error' });
        res.json(rows || []);
      });
    });
  });
});

// Trainer: release active equipment booking for equipmentId if in same gym
router.post('/trainer/equipment/:equipmentId/release', verifyToken, requireRole('trainer'), (req, res) => {
  const trainerId = req.user.id;
  const equipmentId = parseInt(req.params.equipmentId, 10);
  const q = `SELECT e.id, e.gym_id, b.id as booking_id, b.active FROM equipment e LEFT JOIN equipment_booking b ON b.equipment_id = e.id AND b.active = 1 WHERE e.id = ?`;
  db.get(q, [equipmentId], (e, row) => {
    if (e) return res.status(500).json({ error: 'DB error' });
    if (!row) return res.status(404).json({ error: 'Equipment not found' });
    // Trainer must belong to the same gym
    db.get(`SELECT gym_id FROM users WHERE id = ?`, [trainerId], (e2, me) => {
      if (e2) return res.status(500).json({ error: 'DB error' });
      if (!me || me.gym_id !== row.gym_id) return res.status(403).json({ error: 'Trainer not in this gym' });
      if (!row.booking_id) return res.status(400).json({ error: 'No active booking to release' });
      db.run(`UPDATE equipment_booking SET active = 0, ended_at = datetime('now') WHERE id = ?`, [row.booking_id], function(err3){
        if (err3) return res.status(500).json({ error: 'Failed to release' });
        res.json({ success: true });
      });
    });
  });
});

// Trainer: list gym active equipment bookings
router.get('/trainer/gym/bookings', verifyToken, requireRole('trainer'), (req, res) => {
  const trainerId = req.user.id;
  db.get(`SELECT gym_id FROM users WHERE id = ?`, [trainerId], (e, me) => {
    if (e) return res.status(500).json({ error: 'DB error' });
    if (!me || !me.gym_id) return res.json([]);
    const gymId = me.gym_id;
    const sql = `
      SELECT b.id as booking_id, b.started_at, b.user_id, b.equipment_id,
             u.name as user_name, u.email as user_email,
             e.name as equipment_name
      FROM equipment_booking b
      JOIN equipment e ON e.id = b.equipment_id
      JOIN users u ON u.id = b.user_id
      WHERE b.active = 1 AND e.gym_id = ?
      ORDER BY b.started_at ASC
    `;
    db.all(sql, [gymId], (e2, rows) => {
      if (e2) return res.status(500).json({ error: 'DB error' });
      res.json(rows || []);
    });
  });
});

module.exports = router;
