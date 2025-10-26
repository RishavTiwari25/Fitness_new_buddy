const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const mongo = require('../lib/mongo');
const { toObjectId } = mongo;
const { verifyToken } = require('../middleware/auth');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production'
  ? (() => { throw new Error('JWT_SECRET is required in production'); })()
  : 'dev_insecure_secret_change_me');

const ALLOWED_ROLES = ['member', 'trainer', 'owner'];

// Signup
router.post('/signup', async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  const safeRole = ALLOWED_ROLES.includes(role) ? role : 'member';
  if (mongo.isEnabled()) {
    try {
      await mongo.connect();
      const Users = mongo.collection('users');
      const exists = await Users.findOne({ email });
      if (exists) return res.status(400).json({ error: 'Email already registered' });
      const hashed = bcrypt.hashSync(password, 10);
      const doc = { name: name || '', email, password: hashed, role: safeRole, created_at: new Date() };
      const ins = await Users.insertOne(doc);
      const userId = ins.insertedId.toString();
      const token = jwt.sign({ id: userId, email, role: safeRole }, JWT_SECRET, { expiresIn: '7d' });
      return res.json({ id: userId, email, role: safeRole, token });
    } catch (e) {
      return res.status(500).json({ error: 'Failed to create user' });
    }
  } else {
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
  }
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  if (mongo.isEnabled()) {
    try {
      await mongo.connect();
      const Users = mongo.collection('users');
      const user = await Users.findOne({ email });
      if (!user) return res.status(400).json({ error: 'Invalid credentials' });
      const ok = bcrypt.compareSync(password, user.password);
      if (!ok) return res.status(400).json({ error: 'Invalid credentials' });
      const token = jwt.sign({ id: user._id.toString(), email: user.email, role: user.role, gym_id: user.gym_id ? user.gym_id.toString() : null }, JWT_SECRET, { expiresIn: '7d' });
      return res.json({ id: user._id.toString(), name: user.name, email: user.email, role: user.role, token });
    } catch (e) {
      return res.status(500).json({ error: 'Database error' });
    }
  } else {
    db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (!row) return res.status(400).json({ error: 'Invalid credentials' });

      const ok = bcrypt.compareSync(password, row.password);
      if (!ok) return res.status(400).json({ error: 'Invalid credentials' });

      const token = jwt.sign({ id: row.id, email: row.email, role: row.role, gym_id: row.gym_id }, JWT_SECRET, { expiresIn: '7d' });
      res.json({ id: row.id, name: row.name, email: row.email, role: row.role, token });
    });
  }
});

// Protected profile route (GET)
router.get('/profile', verifyToken, async (req, res) => {
  const userId = req.user.id;
  if (mongo.isEnabled()) {
    try {
      await mongo.connect();
      const Users = mongo.collection('users');
      const _id = toObjectId(userId);
      const user = await Users.findOne({ _id }, { projection: { password: 0 } });
      if (!user) return res.status(404).json({ error: 'User not found' });
      // Normalize fields
      user.id = user._id.toString();
      user.allow_calorie_share = !!user.allow_calorie_share;
      delete user._id;
      return res.json(user);
    } catch (e) {
      return res.status(500).json({ error: 'Database error' });
    }
  } else {
    db.get('SELECT id, name, email, role, gym_id, avatar_url, bio, COALESCE(allow_calorie_share,0) as allow_calorie_share FROM users WHERE id = ?', [userId], (err, row) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (!row) return res.status(404).json({ error: 'User not found' });
      res.json(row);
    });
  }
});

// Update profile (PUT) - allow changing name and for members selecting gym
router.put('/profile', verifyToken, async (req, res) => {
  const userId = req.user.id;
  const { name, gym_id, bio, allow_calorie_share } = req.body;
  if (mongo.isEnabled()) {
    try {
      await mongo.connect();
      const Users = mongo.collection('users');
      const _id = toObjectId(userId);
      const update = {
        ...(name !== undefined ? { name } : {}),
        ...(bio !== undefined ? { bio } : {}),
        ...(allow_calorie_share !== undefined ? { allow_calorie_share: !!allow_calorie_share } : {}),
      };
      if (gym_id !== undefined) {
        update.gym_id = gym_id ? toObjectId(gym_id) : null;
      }
      await Users.updateOne({ _id }, { $set: update });
      const user = await Users.findOne({ _id }, { projection: { password: 0 } });
      user.id = user._id.toString();
      user.allow_calorie_share = !!user.allow_calorie_share;
      delete user._id;
      return res.json(user);
    } catch (e) {
      return res.status(500).json({ error: 'Failed to update profile' });
    }
  } else {
    // Only members can set gym_id here; owners/trainers shouldn't set it this way
    db.run('UPDATE users SET name = ?, gym_id = ?, bio = COALESCE(?, bio), allow_calorie_share = COALESCE(?, allow_calorie_share, 0) WHERE id = ?', [name || null, gym_id || null, bio ?? null, (allow_calorie_share ? 1 : 0), userId], function (err) {
      if (err) return res.status(500).json({ error: 'Failed to update profile' });
      db.get('SELECT id, name, email, role, gym_id, avatar_url, bio, COALESCE(allow_calorie_share,0) as allow_calorie_share FROM users WHERE id = ?', [userId], (err2, row) => {
        if (err2) return res.status(500).json({ error: 'Database error' });
        res.json(row);
      });
    });
  }
});

module.exports = router;
