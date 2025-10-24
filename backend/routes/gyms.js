const express = require('express');
const db = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');
const router = express.Router();

// Create a gym - only owners can create gyms
router.post('/gyms', verifyToken, requireRole('owner'), (req, res) => {
  const ownerId = req.user.id;
  const { name, location } = req.body;
  if (!name) return res.status(400).json({ error: 'Gym name required' });

  db.run('INSERT INTO gyms (owner_id, name, location) VALUES (?, ?, ?)', [ownerId, name, location || ''], function (err) {
    if (err) return res.status(500).json({ error: 'Failed to create gym' });
    db.get('SELECT * FROM gyms WHERE id = ?', [this.lastID], (err2, row) => {
      if (err2) return res.status(500).json({ error: 'DB error' });
      res.json(row);
    });
  });
});

// Get gyms: owners get their gyms; others get all gyms (for members to select)
router.get('/gyms', verifyToken, (req, res) => {
  if (req.user.role === 'owner') {
    db.all('SELECT * FROM gyms WHERE owner_id = ?', [req.user.id], (err, rows) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      res.json(rows);
    });
  } else {
    db.all('SELECT * FROM gyms', [], (err, rows) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      res.json(rows);
    });
  }
});

// Get equipment for a gym - any authenticated user
router.get('/gyms/:gymId/equipment', verifyToken, (req, res) => {
  const gymId = req.params.gymId;
  db.all('SELECT * FROM equipment WHERE gym_id = ?', [gymId], (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json(rows);
  });
});

// Equipment with current booking status for a gym
router.get('/gyms/:gymId/equipment-status', verifyToken, (req, res) => {
  const gymId = parseInt(req.params.gymId, 10);
  const sql = `
    SELECT 
      e.*, 
      b.id AS booking_id,
      b.user_id AS booking_user_id,
      b.started_at AS booking_started_at,
      u.name AS booking_user_name,
      u.email AS booking_user_email
    FROM equipment e
    LEFT JOIN equipment_booking b ON b.equipment_id = e.id AND b.active = 1
    LEFT JOIN users u ON u.id = b.user_id
    WHERE e.gym_id = ?
    ORDER BY e.name ASC
  `;
  db.all(sql, [gymId], (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json(rows);
  });
});

// Add equipment to a gym - only the gym owner
router.post('/gyms/:gymId/equipment', verifyToken, requireRole('owner'), (req, res) => {
  const gymId = req.params.gymId;
  const { name, notes, quantity } = req.body;
  if (!name) return res.status(400).json({ error: 'Equipment name required' });

  // Verify ownership
  db.get('SELECT * FROM gyms WHERE id = ?', [gymId], (err, gym) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (!gym) return res.status(404).json({ error: 'Gym not found' });
    if (gym.owner_id !== req.user.id) return res.status(403).json({ error: 'Not the gym owner' });

    db.run('INSERT INTO equipment (gym_id, name, notes, quantity) VALUES (?, ?, ?, ?)', [gymId, name, notes || '', quantity || 1], function (err2) {
      if (err2) return res.status(500).json({ error: 'Failed to create equipment' });
      db.get('SELECT * FROM equipment WHERE id = ?', [this.lastID], (err3, row) => {
        if (err3) return res.status(500).json({ error: 'DB error' });
        res.json(row);
      });
    });
  });
});

// Edit equipment - only owner
router.put('/equipment/:id', verifyToken, requireRole('owner'), (req, res) => {
  const id = req.params.id;
  const { name, notes, quantity } = req.body;

  db.get('SELECT e.*, g.owner_id FROM equipment e JOIN gyms g ON e.gym_id = g.id WHERE e.id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (!row) return res.status(404).json({ error: 'Equipment not found' });
    if (row.owner_id !== req.user.id) return res.status(403).json({ error: 'Not the gym owner' });

    db.run('UPDATE equipment SET name = ?, notes = ?, quantity = ? WHERE id = ?', [name || row.name, notes || row.notes, quantity || row.quantity, id], function (err2) {
      if (err2) return res.status(500).json({ error: 'Failed to update' });
      db.get('SELECT * FROM equipment WHERE id = ?', [id], (err3, updated) => {
        if (err3) return res.status(500).json({ error: 'DB error' });
        res.json(updated);
      });
    });
  });
});

// Delete equipment - only owner
router.delete('/equipment/:id', verifyToken, requireRole('owner'), (req, res) => {
  const id = req.params.id;
  db.get('SELECT e.*, g.owner_id FROM equipment e JOIN gyms g ON e.gym_id = g.id WHERE e.id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (!row) return res.status(404).json({ error: 'Equipment not found' });
    if (row.owner_id !== req.user.id) return res.status(403).json({ error: 'Not the gym owner' });

    db.run('DELETE FROM equipment WHERE id = ?', [id], function (err2) {
      if (err2) return res.status(500).json({ error: 'Failed to delete' });
      res.json({ success: true });
    });
  });
});

module.exports = router;
// Additional presence/occupancy endpoints

// Book an equipment (members/trainers). Requires being checked in to that gym.
router.post('/equipment/:equipmentId/book', verifyToken, (req, res) => {
  const equipmentId = parseInt(req.params.equipmentId, 10);
  const userId = req.user.id;
  if (!['member', 'trainer'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Only members or trainers can book equipment' });
  }

  const fetchEquipment = `SELECT e.*, g.owner_id FROM equipment e JOIN gyms g ON e.gym_id = g.id WHERE e.id = ?`;
  db.get(fetchEquipment, [equipmentId], (err, eq) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (!eq) return res.status(404).json({ error: 'Equipment not found' });

    // Must be checked in to this gym to book
    db.get('SELECT * FROM presence WHERE user_id = ? AND gym_id = ? AND active = 1', [userId, eq.gym_id], (err2, pres) => {
      if (err2) return res.status(500).json({ error: 'DB error' });
      if (!pres) return res.status(400).json({ error: 'You must be checked in to this gym to book equipment' });

      // Equipment not already booked
      db.get('SELECT * FROM equipment_booking WHERE equipment_id = ? AND active = 1', [equipmentId], (err3, activeEq) => {
        if (err3) return res.status(500).json({ error: 'DB error' });
        if (activeEq) return res.status(400).json({ error: 'This equipment is already booked' });

        // User does not have another active booking in this gym
        const sqlUserActive = `
          SELECT b.* FROM equipment_booking b
          JOIN equipment e2 ON e2.id = b.equipment_id
          WHERE b.user_id = ? AND b.active = 1 AND e2.gym_id = ?
        `;
        db.get(sqlUserActive, [userId, eq.gym_id], (err4, userActive) => {
          if (err4) return res.status(500).json({ error: 'DB error' });
          if (userActive) return res.status(400).json({ error: 'You already have an active booking in this gym' });

          db.run('INSERT INTO equipment_booking (equipment_id, user_id, started_at, active) VALUES (?, ?, datetime("now"), 1)', [equipmentId, userId], function (err5) {
            if (err5) return res.status(500).json({ error: 'Failed to create booking' });
            db.get('SELECT * FROM equipment_booking WHERE id = ?', [this.lastID], (err6, row) => {
              if (err6) return res.status(500).json({ error: 'DB error' });
              res.json(row);
            });
          });
        });
      });
    });
  });
});

// Release an equipment booking. Only the booking user or the gym owner can release.
router.post('/equipment/:equipmentId/release', verifyToken, (req, res) => {
  const equipmentId = parseInt(req.params.equipmentId, 10);
  const userId = req.user.id;
  const sql = `
    SELECT b.*, e.gym_id, g.owner_id FROM equipment_booking b
    JOIN equipment e ON e.id = b.equipment_id
    JOIN gyms g ON g.id = e.gym_id
    WHERE b.equipment_id = ? AND b.active = 1
  `;
  db.get(sql, [equipmentId], (err, row) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (!row) return res.status(400).json({ error: 'No active booking found for this equipment' });
    const isOwner = req.user.role === 'owner' && row.owner_id === userId;
    const isBooker = row.user_id === userId;
    if (!isOwner && !isBooker) return res.status(403).json({ error: 'Not allowed to release this booking' });

    db.run('UPDATE equipment_booking SET active = 0, ended_at = datetime("now") WHERE id = ?', [row.id], function (err2) {
      if (err2) return res.status(500).json({ error: 'Failed to release booking' });
      res.json({ success: true });
    });
  });
});

// Get current user's active booking(s)
router.get('/me/bookings', verifyToken, (req, res) => {
  const userId = req.user.id;
  const sql = `
    SELECT b.*, e.name AS equipment_name, e.gym_id, g.name AS gym_name
    FROM equipment_booking b
    JOIN equipment e ON e.id = b.equipment_id
    JOIN gyms g ON g.id = e.gym_id
    WHERE b.user_id = ? AND b.active = 1
    ORDER BY b.started_at DESC
  `;
  db.all(sql, [userId], (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json(rows);
  });
});

// Toggle check-in/out for a member at a gym
router.post('/gyms/:gymId/checkin', verifyToken, requireRole('member'), (req, res) => {
  const gymId = parseInt(req.params.gymId, 10);
  const userId = req.user.id;

  db.get('SELECT * FROM gyms WHERE id = ?', [gymId], (err, gym) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (!gym) return res.status(404).json({ error: 'Gym not found' });

    // See if user is currently checked in anywhere
    db.get('SELECT * FROM presence WHERE user_id = ? AND active = 1', [userId], (err2, activeRow) => {
      if (err2) return res.status(500).json({ error: 'DB error' });

      const finish = () => {
        db.get('SELECT COUNT(*) AS count FROM presence WHERE gym_id = ? AND active = 1', [gymId], (err3, c) => {
          if (err3) return res.status(500).json({ error: 'DB error' });
          res.json({ gym_id: gymId, action: req._action, count: c.count });
        });
      };

      if (activeRow && activeRow.gym_id === gymId) {
        // Checkout from the same gym
        db.run('UPDATE presence SET active = 0, checkout_at = datetime("now") WHERE id = ?', [activeRow.id], function (err4) {
          if (err4) return res.status(500).json({ error: 'Failed to checkout' });
          req._action = 'checkout';
          finish();
        });
      } else {
        const endOther = (cb) => {
          if (activeRow) {
            db.run('UPDATE presence SET active = 0, checkout_at = datetime("now") WHERE id = ?', [activeRow.id], cb);
          } else cb();
        };

        endOther((err5) => {
          if (err5) return res.status(500).json({ error: 'DB error' });
          db.run('INSERT INTO presence (gym_id, user_id, checkin_at, active) VALUES (?, ?, datetime("now"), 1)', [gymId, userId], function (err6) {
            if (err6) return res.status(500).json({ error: 'Failed to checkin' });
            req._action = 'checkin';
            finish();
          });
        });
      }
    });
  });
});

// Get current occupancy for a gym
router.get('/gyms/:gymId/occupancy', verifyToken, (req, res) => {
  const gymId = parseInt(req.params.gymId, 10);
  db.get('SELECT * FROM gyms WHERE id = ?', [gymId], (err, gym) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (!gym) return res.status(404).json({ error: 'Gym not found' });
    db.get('SELECT COUNT(*) AS count FROM presence WHERE gym_id = ? AND active = 1', [gymId], (err2, c) => {
      if (err2) return res.status(500).json({ error: 'DB error' });
      res.json({ gym_id: gymId, gym_name: gym.name, count: c.count });
    });
  });
});

// List of currently checked-in members for a gym (owners only)
router.get('/gyms/:gymId/presence', verifyToken, requireRole('owner'), (req, res) => {
  const gymId = parseInt(req.params.gymId, 10);
  db.get('SELECT * FROM gyms WHERE id = ?', [gymId], (err, gym) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (!gym) return res.status(404).json({ error: 'Gym not found' });
    if (gym.owner_id !== req.user.id) return res.status(403).json({ error: 'Not the gym owner' });

    const sql = `
      SELECT p.id as presence_id, p.checkin_at, u.id as user_id, u.name, u.email
      FROM presence p
      JOIN users u ON u.id = p.user_id
      WHERE p.gym_id = ? AND p.active = 1
      ORDER BY p.checkin_at ASC
    `;
    db.all(sql, [gymId], (err2, rows) => {
      if (err2) return res.status(500).json({ error: 'DB error' });
      res.json({ gym_id: gymId, members: rows });
    });
  });
});
