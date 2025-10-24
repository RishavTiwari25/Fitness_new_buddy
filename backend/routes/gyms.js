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
