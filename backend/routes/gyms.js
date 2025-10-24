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
