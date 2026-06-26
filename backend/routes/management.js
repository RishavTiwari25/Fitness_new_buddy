const express = require('express');
const db = require('../db');
const mongo = require('../lib/mongo');
const { toObjectId } = mongo;
const { verifyToken, requireRole } = require('../middleware/auth');
const router = express.Router();

function addMonths(dateIso, months) {
  const d = dateIso ? new Date(dateIso) : new Date();
  const nd = new Date(d.getFullYear(), d.getMonth() + months, d.getDate());
  return nd.toISOString().slice(0,10);
}

// ----- Owner: memberships -----
router.get('/manager/members', verifyToken, requireRole('manager'), async (req, res) => {
  // list members for all gyms owned by this owner
  const ownerId = req.user.id;
  if (mongo.isEnabled()) {
    try {
      await mongo.connect();
      const Gyms = mongo.collection('gyms');
      const Users = mongo.collection('users');
      const Memberships = mongo.collection('memberships');
      const gyms = await Gyms.find({ owner_id: toObjectId(ownerId) }).project({ _id: 1 }).toArray();
      const gymIds = gyms.map(g => g._id);
      if (gymIds.length === 0) return res.json([]);
      const members = await Users.find({ role: 'member', gym_id: { $in: gymIds } }).project({ name: 1, email: 1, gym_id: 1 }).sort({ name: 1, email: 1 }).toArray();
      const userIds = members.map(m => m._id);
      const mbs = await Memberships.find({ user_id: { $in: userIds } }).project({ user_id: 1, monthly_fee: 1, next_due_date: 1 }).toArray();
      const mbMap = new Map(mbs.map(m => [m.user_id.toString(), m]));
      const rows = members.map(u => ({ user_id: u._id.toString(), name: u.name, email: u.email, gym_id: u.gym_id?.toString() || null, monthly_fee: mbMap.get(u._id.toString())?.monthly_fee || null, next_due_date: mbMap.get(u._id.toString())?.next_due_date || null }));
      return res.json(rows);
    } catch (e) { return res.status(500).json({ error: 'DB error' }); }
  } else {
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
  }
});

router.get('/manager/memberships', verifyToken, requireRole('manager'), async (req, res) => {
  const ownerId = req.user.id;
  const gymId = req.query.gymId ? req.query.gymId : null;
  if (mongo.isEnabled()) {
    try {
      await mongo.connect();
      const Gyms = mongo.collection('gyms');
      const Users = mongo.collection('users');
      const Memberships = mongo.collection('memberships');
      const Payments = mongo.collection('payments');
      const gymFilter = {};
      if (gymId) gymFilter._id = toObjectId(String(gymId));
      const gyms = await Gyms.find(gymFilter).project({ _id: 1 }).toArray();
      const gymIds = gyms.map(g => g._id);
      if (gymIds.length === 0) return res.json([]);
      const members = await Users.find({ role: 'member', gym_id: { $in: gymIds } }).project({ name: 1, email: 1, gym_id: 1 }).sort({ name: 1 }).toArray();
      const userIds = members.map(m => m._id);
      const mbs = await Memberships.find({ user_id: { $in: userIds } }).project({ user_id: 1, monthly_fee: 1, next_due_date: 1, status: 1 }).toArray();
      const mbMap = new Map(mbs.map(m => [m.user_id.toString(), m]));
      const pays = await Payments.aggregate([
        { $match: { user_id: { $in: userIds }, gym_id: { $in: gymIds } } },
        { $group: { _id: '$user_id', last_payment_at: { $max: '$created_at' } } }
      ]).toArray();
      const payMap = new Map(pays.map(p => [p._id.toString(), p.last_payment_at]));
      const rows = members.map(u => ({ user_id: u._id.toString(), name: u.name, email: u.email, gym_id: u.gym_id?.toString() || null, monthly_fee: mbMap.get(u._id.toString())?.monthly_fee || null, next_due_date: mbMap.get(u._id.toString())?.next_due_date || null, status: mbMap.get(u._id.toString())?.status || 'approved', last_payment_at: payMap.get(u._id.toString()) || null }));
      return res.json(rows);
    } catch (e) { return res.status(500).json({ error: 'DB error' }); }
  } else {
    const base = `SELECT u.id as user_id, u.name, u.email, u.gym_id, mb.monthly_fee, mb.next_due_date, mb.status,
    (SELECT MAX(created_at) FROM payments p WHERE p.user_id = u.id AND p.gym_id = u.gym_id) as last_payment_at
    FROM users u JOIN gyms g ON g.id = u.gym_id LEFT JOIN memberships mb ON mb.user_id = u.id WHERE u.role = 'member'`;
    const sql = gymId ? base + ' AND u.gym_id = ? ORDER BY u.name' : base + ' ORDER BY u.name';
    const params = gymId ? [gymId] : [];
    db.all(sql, params, (e, rows) => {
      if (e) return res.status(500).json({ error: 'DB error' });
      res.json(rows || []);
    });
  }
});

router.post('/manager/memberships/upsert', verifyToken, requireRole('manager'), async (req, res) => {
  const ownerId = req.user.id;
  const { user_id, monthly_fee, next_due_date } = req.body || {};
  if (!user_id || !monthly_fee) return res.status(400).json({ error: 'user_id and monthly_fee required' });
  if (mongo.isEnabled()) {
    try {
      await mongo.connect();
      const Users = mongo.collection('users');
      const Gyms = mongo.collection('gyms');
      const Memberships = mongo.collection('memberships');
      const u = await Users.findOne({ _id: toObjectId(user_id) }, { projection: { gym_id: 1 } });
      if (!u) return res.status(404).json({ error: 'User not found' });
      if (!u.gym_id) return res.status(400).json({ error: 'User not assigned to a gym' });
      const g = await Gyms.findOne({ _id: u.gym_id });
      if (!g || g.owner_id.toString() !== ownerId) return res.status(403).json({ error: 'Forbidden' });
      await Memberships.updateOne(
        { user_id: u._id },
        { $set: { user_id: u._id, gym_id: u.gym_id, monthly_fee: Number(monthly_fee), next_due_date: next_due_date || null } },
        { upsert: true }
      );
      return res.json({ success: true });
    } catch (e) { return res.status(500).json({ error: 'Failed to save' }); }
  } else {
    const q = `SELECT id, gym_id FROM users WHERE id = ?`;
    db.get(q, [user_id], (e, u) => {
      if (e) return res.status(500).json({ error: 'DB error' });
      if (!u) return res.status(404).json({ error: 'User not found' });
      const up = `INSERT INTO memberships (user_id, gym_id, monthly_fee, next_due_date) VALUES (?, ?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET monthly_fee=excluded.monthly_fee, next_due_date=excluded.next_due_date`;
      db.run(up, [user_id, u.gym_id, Number(monthly_fee), next_due_date || null], function(err2){
        if (err2) return res.status(500).json({ error: 'Failed to save' });
        res.json({ success: true });
      });
    });
  }
});

router.post('/manager/memberships/:userId/approve', verifyToken, requireRole('manager'), async (req, res) => {
  const ownerId = req.user.id;
  const userId = req.params.userId;
  if (mongo.isEnabled()) {
    try {
      await mongo.connect();
      const Users = mongo.collection('users');
      const Gyms = mongo.collection('gyms');
      const Memberships = mongo.collection('memberships');
      const u = await Users.findOne({ _id: toObjectId(String(userId)) }, { projection: { gym_id: 1 } });
      if (!u || !u.gym_id) return res.status(404).json({ error: 'User/Gym not found' });
      const g = await Gyms.findOne({ _id: u.gym_id });
      if (!g) return res.status(403).json({ error: 'Forbidden' });
      await Memberships.updateOne({ user_id: u._id }, { $set: { status: 'approved' } });
      return res.json({ success: true });
    } catch (e) { return res.status(500).json({ error: 'Failed to approve' }); }
  } else {
    const q = `SELECT u.id, u.gym_id, g.owner_id FROM users u JOIN gyms g ON g.id = u.gym_id WHERE u.id = ?`;
    db.get(q, [userId], (e, u) => {
      if (e) return res.status(500).json({ error: 'DB error' });
      if (!u || u.owner_id !== ownerId) return res.status(403).json({ error: 'Forbidden' });
      db.run(`UPDATE memberships SET status = 'approved' WHERE user_id = ?`, [userId], function(err2) {
        if (err2) return res.status(500).json({ error: 'Failed to approve' });
        res.json({ success: true });
      });
    });
  }
});

router.post('/manager/memberships/:userId/remind', verifyToken, requireRole('manager'), async (req, res) => {
  const ownerId = req.user.id;
  const userId = req.params.userId;
  if (mongo.isEnabled()) {
    try {
      await mongo.connect();
      const Users = mongo.collection('users');
      const Gyms = mongo.collection('gyms');
      const Notes = mongo.collection('notifications');
      const u = await Users.findOne({ _id: toObjectId(String(userId)) }, { projection: { gym_id: 1 } });
      if (!u) return res.status(404).json({ error: 'User not found' });
      const g = u.gym_id ? await Gyms.findOne({ _id: u.gym_id }) : null;
      if (!g || g.owner_id.toString() !== ownerId) return res.status(403).json({ error: 'Forbidden' });
      await Notes.insertOne({ user_id: u._id, type: 'billing_reminder', message: 'Your gym membership fee is due soon.', created_at: new Date() });
      return res.json({ success: true });
    } catch (e) { return res.status(500).json({ error: 'Failed to create reminder' }); }
  } else {
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
  }
});

router.post('/manager/payments/record', verifyToken, requireRole('manager'), async (req, res) => {
  const ownerId = req.user.id;
  const { user_id, amount, method } = req.body || {};
  if (!user_id || !amount) return res.status(400).json({ error: 'user_id and amount required' });
  if (mongo.isEnabled()) {
    try {
      await mongo.connect();
      const Users = mongo.collection('users');
      const Gyms = mongo.collection('gyms');
      const Memberships = mongo.collection('memberships');
      const Payments = mongo.collection('payments');
      const u = await Users.findOne({ _id: toObjectId(user_id) }, { projection: { gym_id: 1 } });
      if (!u) return res.status(404).json({ error: 'User not found' });
      const g = u.gym_id ? await Gyms.findOne({ _id: u.gym_id }) : null;
      if (!g || g.owner_id.toString() !== ownerId) return res.status(403).json({ error: 'Forbidden' });
      const now = new Date();
      await Payments.insertOne({ user_id: toObjectId(user_id), gym_id: u.gym_id || null, amount: Number(amount), method: method || 'cash', txn_ref: null, created_at: now });
      const mb = await Memberships.findOne({ user_id: toObjectId(user_id) });
      const baseDate = mb?.next_due_date || new Date().toISOString().slice(0,10);
      const newDue = addMonths(baseDate, 1);
      await Memberships.updateOne(
        { user_id: toObjectId(user_id) },
        { $set: { user_id: toObjectId(user_id), gym_id: u.gym_id || null, monthly_fee: mb?.monthly_fee || Number(amount), next_due_date: newDue } },
        { upsert: true }
      );
      return res.json({ success: true });
    } catch (e) { return res.status(500).json({ error: 'DB error' }); }
  } else {
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
  }
});

// Owner: list recent payments for a specific member (authorization: must own member's gym)
router.get('/manager/payments', verifyToken, requireRole('manager'), async (req, res) => {
  const ownerId = req.user.id;
  const userId = req.query.userId;
  const limit = Math.min(parseInt(req.query.limit || '20', 10) || 20, 50);
  if (!userId) return res.status(400).json({ error: 'userId required' });
  if (mongo.isEnabled()) {
    try {
      await mongo.connect();
      const Users = mongo.collection('users');
      const Gyms = mongo.collection('gyms');
      const Payments = mongo.collection('payments');
      const u = await Users.findOne({ _id: toObjectId(String(userId)) }, { projection: { gym_id: 1 } });
      if (!u) return res.status(404).json({ error: 'User not found' });
      const g = u.gym_id ? await Gyms.findOne({ _id: u.gym_id }) : null;
      if (!g || g.owner_id.toString() !== ownerId) return res.status(403).json({ error: 'Forbidden' });
      const rows = await Payments.find({ user_id: toObjectId(String(userId)) }).sort({ created_at: -1 }).limit(limit).toArray();
      return res.json(rows.map(r => ({ id: r._id.toString(), gym_id: r.gym_id?.toString() || null, amount: r.amount, method: r.method, txn_ref: r.txn_ref, created_at: r.created_at })));
    } catch (e) { return res.status(500).json({ error: 'DB error' }); }
  } else {
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
  }
});

// Member: membership details
router.get('/me/membership', verifyToken, async (req, res) => {
  const userId = req.user.id;
  if (mongo.isEnabled()) {
    try {
      await mongo.connect();
      const Memberships = mongo.collection('memberships');
      const Payments = mongo.collection('payments');
      const Users = mongo.collection('users');
      const mb = await Memberships.findOne({ user_id: toObjectId(userId) });
      const user = await Users.findOne({ _id: toObjectId(userId) }, { projection: { points: 1 } });
      const pays = await Payments.find({ user_id: toObjectId(userId) }).sort({ created_at: -1 }).limit(20).toArray();
      const billing = mb ? { user_id: mb.user_id.toString(), gym_id: mb.gym_id?.toString() || null, monthly_fee: mb.monthly_fee, next_due_date: mb.next_due_date, points: Number(user?.points || 0) } : { points: Number(user?.points || 0) };
      return res.json({ billing, payments: pays.map(p => ({ id: p._id.toString(), gym_id: p.gym_id?.toString() || null, amount: p.amount, method: p.method, txn_ref: p.txn_ref, created_at: p.created_at })) });
    } catch (e) { return res.status(500).json({ error: 'DB error' }); }
  } else {
    db.get(`SELECT mb.*, COALESCE(u.points,0) as points FROM memberships mb LEFT JOIN users u ON u.id = mb.user_id WHERE mb.user_id = ?`, [userId], (e, row) => {
      if (e) return res.status(500).json({ error: 'DB error' });
      db.all(`SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`, [userId], (e2, pay) => {
        if (e2) return res.status(500).json({ error: 'DB error' });
        res.json({ billing: row || null, payments: pay || [] });
      });
    });
  }
});

// Mock payment integration for dev
router.post('/payments/mock/create-order', verifyToken, (req, res) => {
  const { amount } = req.body || {};
  if (!amount) return res.status(400).json({ error: 'amount required' });
  const order_id = 'mock_' + Date.now().toString(36);
  res.json({ order_id, amount: Number(amount) });
});

router.post('/payments/mock/confirm', verifyToken, async (req, res) => {
  const userId = req.user.id;
  const { order_id, amount } = req.body || {};
  if (!order_id || !amount) return res.status(400).json({ error: 'order_id and amount required' });
  if (mongo.isEnabled()) {
    try {
      await mongo.connect();
      const Users = mongo.collection('users');
      const Payments = mongo.collection('payments');
      const Memberships = mongo.collection('memberships');
      const me = await Users.findOne({ _id: toObjectId(userId) }, { projection: { gym_id: 1 } });
      const gymId = me?.gym_id || null;
      const now = new Date();
      await Payments.insertOne({ user_id: toObjectId(userId), gym_id: gymId, amount: Number(amount), method: 'online', txn_ref: order_id, created_at: now });
      const mb = await Memberships.findOne({ user_id: toObjectId(userId) });
      const baseDate = mb?.next_due_date || new Date().toISOString().slice(0,10);
      const newDue = addMonths(baseDate, 1);
      await Memberships.updateOne({ user_id: toObjectId(userId) }, { $set: { user_id: toObjectId(userId), gym_id: gymId, monthly_fee: mb?.monthly_fee || Number(amount), next_due_date: newDue } }, { upsert: true });
      return res.json({ success: true });
    } catch (e) { return res.status(500).json({ error: 'DB error' }); }
  } else {
    db.get(`SELECT gym_id FROM users WHERE id = ?`, [userId], (e, me) => {
      if (e) return res.status(500).json({ error: 'DB error' });
      const gymId = me?.gym_id || null;
      db.serialize(() => {
        db.run(`INSERT INTO payments (user_id, gym_id, amount, method, txn_ref) VALUES (?, ?, ?, 'online', ?)`, [userId, gymId, Number(amount), order_id]);
        db.run(`UPDATE memberships SET next_due_date = date(COALESCE(next_due_date, date('now')), '+1 month') WHERE user_id = ?`, [userId]);
      });
      res.json({ success: true });
    });
  }
});

// ----- Trainer tools -----
router.get('/manager/clients', verifyToken, requireRole('manager'), async (req, res) => {
  const trainerId = req.user.id;
  if (mongo.isEnabled()) {
    try {
      await mongo.connect();
      const TC = mongo.collection('trainer_clients');
      const Users = mongo.collection('users');
      const links = await TC.find({ trainer_id: toObjectId(trainerId) }).toArray();
      const ids = links.map(l => l.member_id);
      if (ids.length === 0) return res.json([]);
      const users = await Users.find({ _id: { $in: ids } }).project({ name: 1, email: 1, gym_id: 1 }).toArray();
      const rows = users.map(u => ({ id: u._id.toString(), name: u.name, email: u.email, gym_id: u.gym_id?.toString() || null }));
      return res.json(rows);
    } catch (e) { return res.status(500).json({ error: 'DB error' }); }
  } else {
    const sql = `SELECT tc.member_id as id, u.name, u.email, u.gym_id FROM trainer_clients tc JOIN users u ON u.id = tc.member_id WHERE tc.trainer_id = ? ORDER BY COALESCE(u.name,u.email)`;
    db.all(sql, [trainerId], (e, rows) => {
      if (e) return res.status(500).json({ error: 'DB error' });
      res.json(rows || []);
    });
  }
});

router.post('/manager/clients', verifyToken, requireRole('manager'), async (req, res) => {
  const trainerId = req.user.id;
  const { client_id } = req.body || {};
  if (!client_id) return res.status(400).json({ error: 'client_id required' });
  if (mongo.isEnabled()) {
    try {
      await mongo.connect();
      const Users = mongo.collection('users');
      const TC = mongo.collection('trainer_clients');
      const me = await Users.findOne({ _id: toObjectId(trainerId) }, { projection: { gym_id: 1 } });
      const cli = await Users.findOne({ _id: toObjectId(client_id) }, { projection: { gym_id: 1 } });
      if (!me?.gym_id || !cli?.gym_id || me.gym_id.toString() !== cli.gym_id.toString()) return res.status(400).json({ error: 'Client must be in your gym' });
      const exists = await TC.findOne({ trainer_id: toObjectId(trainerId), member_id: toObjectId(client_id) });
      if (!exists) await TC.insertOne({ trainer_id: toObjectId(trainerId), member_id: toObjectId(client_id), created_at: new Date() });
      return res.json({ success: true });
    } catch (e) { return res.status(500).json({ error: 'Failed to add client' }); }
  } else {
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
  }
});

router.delete('/manager/clients/:clientId', verifyToken, requireRole('manager'), async (req, res) => {
  const trainerId = req.user.id;
  const clientId = req.params.clientId;
  if (mongo.isEnabled()) {
    try {
      await mongo.connect();
      const TC = mongo.collection('trainer_clients');
      await TC.deleteOne({ trainer_id: toObjectId(trainerId), member_id: toObjectId(String(clientId)) });
      return res.json({ success: true });
    } catch (e) { return res.status(500).json({ error: 'Failed to remove' }); }
  } else {
    db.run(`DELETE FROM trainer_clients WHERE trainer_id = ? AND member_id = ?`, [trainerId, clientId], function(err){
      if (err) return res.status(500).json({ error: 'Failed to remove' });
      res.json({ success: true });
    });
  }
});

router.get('/manager/clients/:clientId/diet-logs', verifyToken, requireRole('manager'), async (req, res) => {
  const trainerId = req.user.id;
  const clientId = req.params.clientId;
  if (mongo.isEnabled()) {
    try {
      await mongo.connect();
      const TC = mongo.collection('trainer_clients');
      const Users = mongo.collection('users');
      const Food = mongo.collection('food_logs');
      const link = await TC.findOne({ trainer_id: toObjectId(trainerId), member_id: toObjectId(String(clientId)) });
      if (!link) return res.status(403).json({ error: 'Not your client' });
      const p = await Users.findOne({ _id: toObjectId(String(clientId)) }, { projection: { allow_trainer_access: 1, allow_calorie_share: 1 } });
      const allow = !!(p?.allow_trainer_access || p?.allow_calorie_share);
      if (!allow) return res.status(403).json({ error: 'Client has not granted access' });
      const rows = await Food.find({ user_id: toObjectId(String(clientId)) }).project({ date: 1, calories: 1, protein: 1, carbs: 1, fat: 1, items_text: 1 }).sort({ date: -1 }).limit(30).toArray();
      return res.json(rows.map(r => ({ id: r._id.toString(), date: r.date, calories: r.calories, protein: r.protein, carbs: r.carbs, fat: r.fat, items_text: r.items_text })));
    } catch (e) { return res.status(500).json({ error: 'DB error' }); }
  } else {
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
  }
});

// Trainer: release active equipment booking for equipmentId if in same gym
router.post('/manager/equipment/:equipmentId/release', verifyToken, requireRole('manager'), async (req, res) => {
  const trainerId = req.user.id;
  const equipmentId = req.params.equipmentId;
  if (mongo.isEnabled()) {
    try {
      await mongo.connect();
      const Equipment = mongo.collection('equipment');
      const Users = mongo.collection('users');
      const Bookings = mongo.collection('equipment_booking');
      const eq = await Equipment.findOne({ _id: toObjectId(String(equipmentId)) });
      if (!eq) return res.status(404).json({ error: 'Equipment not found' });
      const me = await Users.findOne({ _id: toObjectId(trainerId) }, { projection: { gym_id: 1 } });
      if (!me || !me.gym_id || me.gym_id.toString() !== eq.gym_id.toString()) return res.status(403).json({ error: 'Trainer not in this gym' });
      const active = await Bookings.findOne({ equipment_id: eq._id, active: true }, { sort: { started_at: 1 } });
      if (!active) return res.status(400).json({ error: 'No active booking to release' });
      await Bookings.updateOne({ _id: active._id }, { $set: { active: false, ended_at: new Date() } });
      return res.json({ success: true });
    } catch (e) { return res.status(500).json({ error: 'Failed to release' }); }
  } else {
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
  }
});

// Trainer: list gym active equipment bookings
router.get('/manager/gym/bookings', verifyToken, requireRole('manager'), async (req, res) => {
  const trainerId = req.user.id;
  if (mongo.isEnabled()) {
    try {
      await mongo.connect();
      const Users = mongo.collection('users');
      const Equipment = mongo.collection('equipment');
      const Bookings = mongo.collection('equipment_booking');
      const me = await Users.findOne({ _id: toObjectId(trainerId) }, { projection: { gym_id: 1 } });
      if (!me || !me.gym_id) return res.json([]);
      const eq = await Equipment.find({ gym_id: me.gym_id }).project({ _id: 1, name: 1 }).toArray();
      const eqMap = new Map(eq.map(e => [e._id.toString(), e.name]));
      const ids = eq.map(e => e._id);
      if (!ids.length) return res.json([]);
      const rows = await Bookings.find({ active: true, equipment_id: { $in: ids } }).sort({ started_at: 1 }).toArray();
      const memberIds = [...new Set(rows.map(r => r.user_id.toString()))].map(toObjectId);
      const memberDocs = await Users.find({ _id: { $in: memberIds } }).project({ name: 1, email: 1 }).toArray();
      const uMap = new Map(memberDocs.map(u => [u._id.toString(), u]));
      const resp = rows.map(b => ({
        booking_id: b._id.toString(),
        started_at: b.started_at,
        user_id: b.user_id.toString(),
        equipment_id: b.equipment_id.toString(),
        user_name: uMap.get(b.user_id.toString())?.name,
        user_email: uMap.get(b.user_id.toString())?.email,
        equipment_name: eqMap.get(b.equipment_id.toString())
      }));
      return res.json(resp);
    } catch (e) { return res.status(500).json({ error: 'DB error' }); }
  } else {
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
  }
});


// ----- Leaderboard -----
router.get('/manager/leaderboard', verifyToken, requireRole('manager'), async (req, res) => {
  const { gymId } = req.query;
  if (!gymId) return res.status(400).json({ error: 'gymId required' });

  if (mongo.isEnabled()) {
    try {
      await mongo.connect();
      const Users = mongo.collection('users');
      const Streaks = mongo.collection('user_streaks');
      
      const members = await Users.find({ role: 'member', gym_id: toObjectId(gymId) }).project({ name: 1, email: 1 }).toArray();
      if (members.length === 0) return res.json([]);
      
      const userIds = members.map(m => m._id);
      const streaks = await Streaks.find({ user_id: { $in: userIds } }).project({ user_id: 1, gym_streak: 1 }).toArray();
      
      const streakMap = new Map(streaks.map(s => [s.user_id.toString(), s.gym_streak]));
      
      const rows = members.map(m => ({
        user_id: m._id.toString(),
        name: m.name || m.email,
        gym_streak: streakMap.get(m._id.toString()) || 0
      }));
      
      // Sort by gym_streak descending
      rows.sort((a, b) => b.gym_streak - a.gym_streak);
      return res.json(rows);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: 'DB error' });
    }
  } else {
    const sql = `
      SELECT u.id as user_id, COALESCE(u.name, u.email) as name, COALESCE(s.gym_streak, 0) as gym_streak
      FROM users u
      LEFT JOIN user_streaks s ON s.user_id = u.id
      WHERE u.gym_id = ? AND u.role = 'member'
      ORDER BY gym_streak DESC, name ASC
    `;
    db.all(sql, [gymId], (err, rows) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      res.json(rows || []);
    });
  }
});

module.exports = router;
