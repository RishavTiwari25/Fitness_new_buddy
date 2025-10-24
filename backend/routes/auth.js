const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { verifyToken } = require('../middleware/auth');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'please_change_this_secret';

const ALLOWED_ROLES = ['member', 'trainer', 'owner'];

// Signup
router.post('/signup', (req, res) => {
  const { name, email, password, role } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  const safeRole = ALLOWED_ROLES.includes(role) ? role : 'member';

  db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (row) return res.status(400).json({ error: 'Email already registered' });

    const hashed = bcrypt.hashSync(password, 10);
    db.run('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)', [name || '', email, hashed, safeRole], function (err) {
      if (err) return res.status(500).json({ error: 'Failed to create user' });
      const userId = this.lastID;
      const token = jwt.sign({ id: userId, email, role: safeRole }, JWT_SECRET, { expiresIn: '7d' });
      res.json({ id: userId, email, role: safeRole, token });
    });
  });
});

// Login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!row) return res.status(400).json({ error: 'Invalid credentials' });

    const ok = bcrypt.compareSync(password, row.password);
    if (!ok) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: row.id, email: row.email, role: row.role, gym_id: row.gym_id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ id: row.id, name: row.name, email: row.email, role: row.role, token });
  });
});

// Protected profile route (GET)
router.get('/profile', verifyToken, (req, res) => {
  const userId = req.user.id;
  db.get('SELECT id, name, email, role, gym_id FROM users WHERE id = ?', [userId], (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!row) return res.status(404).json({ error: 'User not found' });
    res.json(row);
  });
});

// Update profile (PUT) - allow changing name and for members selecting gym
router.put('/profile', verifyToken, (req, res) => {
  const userId = req.user.id;
  const { name, gym_id } = req.body;

  // Only members can set gym_id here; owners/trainers shouldn't set it this way
  db.run('UPDATE users SET name = ?, gym_id = ? WHERE id = ?', [name || null, gym_id || null, userId], function (err) {
    if (err) return res.status(500).json({ error: 'Failed to update profile' });
    db.get('SELECT id, name, email, role, gym_id FROM users WHERE id = ?', [userId], (err2, row) => {
      if (err2) return res.status(500).json({ error: 'Database error' });
      res.json(row);
    });
  });
});

module.exports = router;
