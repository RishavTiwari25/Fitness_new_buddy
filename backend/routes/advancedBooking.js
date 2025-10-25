const express = require('express');
const db = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');
const router = express.Router();

const SLOT_MINUTES = 15;

function toSlotIso(date = new Date()) {
  const d = new Date(date);
  d.setSeconds(0, 0);
  const mins = d.getMinutes();
  const aligned = Math.floor(mins / SLOT_MINUTES) * SLOT_MINUTES;
  d.setMinutes(aligned);
  return d.toISOString();
}

function futureSlots(hoursAhead = 4) {
  const out = [];
  const start = new Date();
  const first = new Date(toSlotIso(start));
  const total = (hoursAhead * 60) / SLOT_MINUTES;
  for (let i = 0; i < total; i++) {
    const d = new Date(first.getTime() + i * SLOT_MINUTES * 60000);
    out.push(d.toISOString());
  }
  return out;
}

// GET /api/equipment/status/:equipmentId -> list of upcoming slots with counts
router.get('/equipment/status/:equipmentId', verifyToken, (req, res) => {
  const equipmentId = parseInt(req.params.equipmentId, 10);
  if (!equipmentId) return res.status(400).json({ error: 'Invalid equipmentId' });
  const slots = futureSlots(4);
  const placeholders = slots.map(() => '?').join(',');
  const sql = `SELECT slot_time, COUNT(*) as cnt
               FROM bookings
               WHERE equipment_id = ? AND status = 'ACTIVE' AND slot_time IN (${placeholders})
               GROUP BY slot_time`;
  db.all(sql, [equipmentId, ...slots], (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    const map = new Map(rows.map(r => [r.slot_time, Number(r.cnt)]));
    const result = slots.map(s => ({ slotTime: s, count: map.get(s) || 0 }));
    res.json({ equipmentId, slots: result, slotMinutes: SLOT_MINUTES });
  });
});

// POST /api/book { equipmentId, slotTime }
router.post('/book', verifyToken, (req, res) => {
  const userId = req.user.id;
  const { equipmentId, slotTime } = req.body || {};
  if (!equipmentId || !slotTime) return res.status(400).json({ error: 'equipmentId and slotTime required' });

  const slotIso = new Date(slotTime).toISOString();
  // Enforce at-most-one upcoming ACTIVE booking per user (global across equipment)
  const userLimitSql = `SELECT COUNT(*) as cnt FROM bookings WHERE user_id = ? AND status = 'ACTIVE' AND datetime(slot_time) >= datetime('now')`;
  db.get(userLimitSql, [userId], (errUser, rowUser) => {
    if (errUser) return res.status(500).json({ error: 'DB error' });
    if (Number(rowUser?.cnt || 0) > 0) return res.status(400).json({ error: 'You already have an active time slot.' });

    db.get(`SELECT COUNT(*) as cnt FROM bookings WHERE equipment_id = ? AND slot_time = ? AND status = 'ACTIVE'`, [equipmentId, slotIso], (err, row) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      const count = Number(row.cnt || 0);
      let bookingType = 'WAITLIST';
      if (count === 0) bookingType = 'MAIN';
      else if (count === 1) bookingType = 'ALTERNATE';

      db.run(`INSERT INTO bookings (equipment_id, user_id, slot_time, booking_type, status) VALUES (?, ?, ?, ?, 'ACTIVE')`,
        [equipmentId, userId, slotIso, bookingType], function (err2) {
          if (err2) return res.status(500).json({ error: 'Failed to create booking' });
          const msg = bookingType === 'MAIN' ? 'Booked!' : bookingType === 'ALTERNATE' ? 'Booked (1 spot left)' : 'You are on the waitlist';
          res.json({ id: this.lastID, equipmentId, slotTime: slotIso, bookingType, status: 'ACTIVE', message: msg });
        });
    });
  });
});

// POST /api/release { bookingId }
router.post('/release', verifyToken, (req, res) => {
  const userId = req.user.id;
  const { bookingId } = req.body || {};
  if (!bookingId) return res.status(400).json({ error: 'bookingId required' });
  db.get(`SELECT * FROM bookings WHERE id = ?`, [bookingId], (err, b) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (!b) return res.status(404).json({ error: 'Not found' });
    if (b.user_id !== userId) return res.status(403).json({ error: 'Not allowed' });

    db.run(`DELETE FROM bookings WHERE id = ?`, [bookingId], function (err2) {
      if (err2) return res.status(500).json({ error: 'Failed to release' });
      // Promotion logic: find waitlist for same equipment+slot
      const sqlWL = `SELECT * FROM bookings WHERE equipment_id = ? AND slot_time = ? AND status = 'ACTIVE' AND booking_type = 'WAITLIST' ORDER BY created_at ASC LIMIT 1`;
      db.get(sqlWL, [b.equipment_id, b.slot_time], (err3, wait) => {
        if (err3) return res.status(500).json({ error: 'DB error' });
        if (!wait) return res.json({ success: true });
        // Count current after deletion
        db.get(`SELECT COUNT(*) as cnt FROM bookings WHERE equipment_id = ? AND slot_time = ? AND status = 'ACTIVE'`, [b.equipment_id, b.slot_time], (err4, r2) => {
          if (err4) return res.status(500).json({ error: 'DB error' });
          const cnt = Number(r2.cnt || 0);
          const newType = cnt === 0 ? 'MAIN' : cnt === 1 ? 'ALTERNATE' : 'ALTERNATE';
          db.run(`UPDATE bookings SET booking_type = ? WHERE id = ?`, [newType, wait.id], function (err5) {
            if (err5) return res.status(500).json({ error: 'Failed to promote' });
            res.json({ success: true, promoted: { id: wait.id, booking_type: newType } });
          });
        });
      });
    });
  });
});

// POST /api/book/take-idle-slot { equipmentId, slotTime, newUserId? }
router.post('/book/take-idle-slot', verifyToken, (req, res) => {
  const actorId = req.user.id;
  const actorRole = req.user.role;
  const { equipmentId, slotTime, newUserId } = req.body || {};
  if (!equipmentId || !slotTime) return res.status(400).json({ error: 'equipmentId and slotTime required' });
  const slotIso = new Date(slotTime).toISOString();
  const now = new Date();
  if (now < new Date(slotIso).getTime() + 5 * 60000) {
    return res.status(400).json({ error: 'Slot has not started yet' });
  }
  const targetUserId = actorRole === 'trainer' && newUserId ? newUserId : actorId;
  // Enforce at-most-one upcoming ACTIVE booking for target user
  const userLimitSql = `SELECT COUNT(*) as cnt FROM bookings WHERE user_id = ? AND status = 'ACTIVE' AND datetime(slot_time) >= datetime('now')`;
  db.get(userLimitSql, [targetUserId], (errUser, rowUser) => {
    if (errUser) return res.status(500).json({ error: 'DB error' });
    if (Number(rowUser?.cnt || 0) > 0) return res.status(400).json({ error: 'User already has an active time slot.' });

    // choose an existing booking to reassign: prefer ALTERNATE
    const pickSql = `SELECT * FROM bookings WHERE equipment_id = ? AND slot_time = ? AND status = 'ACTIVE' ORDER BY CASE booking_type WHEN 'ALTERNATE' THEN 0 ELSE 1 END, created_at ASC LIMIT 1`;
    db.get(pickSql, [equipmentId, slotIso], (err, b) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      if (!b) return res.status(400).json({ error: 'No active bookings to take over' });
      db.run(`UPDATE bookings SET user_id = ? WHERE id = ?`, [targetUserId, b.id], function (err2) {
        if (err2) return res.status(500).json({ error: 'Failed to take slot' });
        res.json({ success: true, reassignedBookingId: b.id, toUserId: targetUserId });
      });
    });
  });
});

// POST /api/admin/release-slot { bookingId } (trainer override)
router.post('/admin/release-slot', verifyToken, requireRole('trainer'), (req, res) => {
  const { bookingId } = req.body || {};
  if (!bookingId) return res.status(400).json({ error: 'bookingId required' });
  db.run(`DELETE FROM bookings WHERE id = ?`, [bookingId], function (err) {
    if (err) return res.status(500).json({ error: 'Failed to release' });
    res.json({ success: true });
  });
});

// GET /api/my/bookings-advanced
router.get('/my/bookings-advanced', verifyToken, (req, res) => {
  const userId = req.user.id;
  db.all(`SELECT b.*, e.name as equipment_name FROM bookings b JOIN equipment e ON e.id = b.equipment_id WHERE b.user_id = ? AND b.status = 'ACTIVE' AND datetime(b.slot_time) >= datetime('now') ORDER BY b.slot_time ASC`, [userId], (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json(rows);
  });
});

module.exports = router;
