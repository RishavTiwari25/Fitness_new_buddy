/**
 * =============================================
 * AUTHENTICATION ROUTES (routes/auth.js)
 * =============================================
 * Handles user authentication endpoints:
 * - Signup: Create new user account
 * - Login: Authenticate user and issue JWT token
 * - Profile: Get/update user profile information
 */

// ===== IMPORTS =====
const express = require('express');
const bcrypt = require('bcryptjs'); // Password hashing library
const jwt = require('jsonwebtoken'); // JWT token creation/verification
const db = require('../db'); // SQLite database connection
const mongo = require('../lib/mongo'); // MongoDB utilities
const { toObjectId } = mongo; // Helper to convert strings to MongoDB ObjectId
const { verifyToken } = require('../middleware/auth'); // JWT verification middleware
const router = express.Router();

// ===== JWT CONFIGURATION =====
// Secret key for signing and verifying JWT tokens
const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production'
  ? (() => { throw new Error('JWT_SECRET is required in production'); })()
  : 'dev_insecure_secret_change_me');

// ===== ALLOWED USER ROLES =====
// Valid role types that users can have
const ALLOWED_ROLES = ['member', 'manager'];

// =============================================
// POST /api/signup
// =============================================
// Create a new user account
// Body: { name, email, password, role }
// Returns: { id, email, role, token }
router.post('/signup', async (req, res) => {
  // Extract request body parameters
  const { name, email, password, role } = req.body;
  
  // Validate required fields
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  
  // Sanitize role - use provided role only if it's in ALLOWED_ROLES, otherwise default to 'member'
  const safeRole = ALLOWED_ROLES.includes(role) ? role : 'member';
  
  // Handle MongoDB path if enabled
  if (mongo.isEnabled()) {
    try {
      await mongo.connect();
      const Users = mongo.collection('users');
      
      // Check if email already registered
      const exists = await Users.findOne({ email });
      if (exists) return res.status(400).json({ error: 'Email already registered' });
      
      // Hash password using bcrypt (10 salt rounds for security)
      const hashed = bcrypt.hashSync(password, 10);
      
      // Create new user document
      const doc = { 
        name: name || '', 
        email, 
        password: hashed, 
        role: safeRole, 
        created_at: new Date() 
      };
      
      // Insert into MongoDB
      const ins = await Users.insertOne(doc);
      const userId = ins.insertedId.toString();
      
      // Create JWT token with 7-day expiration
      const token = jwt.sign({ id: userId, email, role: safeRole }, JWT_SECRET, { expiresIn: '7d' });
      
      // Return new user data and token
      return res.json({ id: userId, email, role: safeRole, token });
    } catch (e) {
      console.error('Signup MongoDB error:', e);
      return res.status(500).json({ error: 'Database error: ' + (e.message || String(e)) });
    }
  } else {
    // Handle SQLite path (fallback)
    db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (row) return res.status(400).json({ error: 'Email already registered' });

      // Hash password
      const hashed = bcrypt.hashSync(password, 10);
      
      // Insert new user into SQLite
      db.run('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)', 
        [name || '', email, hashed, safeRole], 
        function (err) {
          if (err) return res.status(500).json({ error: 'Failed to create user' });
          
          // Get the newly created user's ID
          const userId = this.lastID;
          
          // Create JWT token
          const token = jwt.sign({ id: userId, email, role: safeRole }, JWT_SECRET, { expiresIn: '7d' });
          
          // Return response
          res.json({ id: userId, email, role: safeRole, token });
        }
      );
    });
  }
});

// =============================================
// POST /api/login
// =============================================
// Authenticate user with email and password
// Body: { email, password }
// Returns: { id, name, email, role, token }
router.post('/login', async (req, res) => {
  // Extract email and password from request
  const { email, password } = req.body;
  
  // Validate required fields
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  
  // Handle MongoDB path if enabled
  if (mongo.isEnabled()) {
    try {
      await mongo.connect();
      const Users = mongo.collection('users');
      
      // Find user by email
      const user = await Users.findOne({ email });
      if (!user) return res.status(400).json({ error: 'Invalid credentials' });
      
      // Compare provided password with stored hash
      const ok = bcrypt.compareSync(password, user.password);
      if (!ok) return res.status(400).json({ error: 'Invalid credentials' });
      
      // Create JWT token with user info
      const token = jwt.sign(
        { 
          id: user._id.toString(), 
          email: user.email, 
          role: user.role, 
          gym_id: user.gym_id ? user.gym_id.toString() : null 
        }, 
        JWT_SECRET, 
        { expiresIn: '7d' }
      );
      
      // Return user data and token
      return res.json({ 
        id: user._id.toString(), 
        name: user.name, 
        email: user.email, 
        role: user.role, 
        token 
      });
    } catch (e) {
      console.error('Login MongoDB error:', e);
      return res.status(500).json({ error: 'Database error: ' + (e.message || String(e)) });
    }
  } else {
    // Handle SQLite path (fallback)
    db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
      if (err) {
        console.error('Login SQLite error:', err);
        return res.status(500).json({ error: 'Database error (SQLite): ' + (err.message || String(err)) });
      }
      if (!row) return res.status(400).json({ error: 'Invalid credentials' });

      // Compare password with stored hash
      const ok = bcrypt.compareSync(password, row.password);
      if (!ok) return res.status(400).json({ error: 'Invalid credentials' });

      // Create JWT token
      const token = jwt.sign(
        { 
          id: row.id, 
          email: row.email, 
          role: row.role, 
          gym_id: row.gym_id 
        }, 
        JWT_SECRET, 
        { expiresIn: '7d' }
      );
      
      // Return user data and token
      res.json({ 
        id: row.id, 
        name: row.name, 
        email: row.email, 
        role: row.role, 
        token 
      });
    });
  }
});

// =============================================
// GET /api/profile
// =============================================
// Get authenticated user's profile information
// Requires: Valid JWT token in Authorization header
// Returns: User profile data (excluding password)
router.get('/profile', verifyToken, async (req, res) => {
  // Get user ID from JWT token (set by verifyToken middleware)
  const userId = req.user.id;
  
  // Handle MongoDB path if enabled
  if (mongo.isEnabled()) {
    try {
      await mongo.connect();
      const Users = mongo.collection('users');
      
      // Convert string ID to MongoDB ObjectId
      const _id = toObjectId(userId);
      
      // Find user, excluding password field
      const user = await Users.findOne({ _id }, { projection: { password: 0 } });
      if (!user) return res.status(404).json({ error: 'User not found' });
      
      // Normalize fields for response (rename _id to id)
      user.id = user._id.toString();
      user.allow_calorie_share = !!user.allow_calorie_share; // Convert to boolean
      delete user._id;
      
      return res.json(user);
    } catch (e) {
      return res.status(500).json({ error: 'Database error' });
    }
  } else {
    // Handle SQLite path (fallback)
    db.get(
      'SELECT id, name, email, role, gym_id, avatar_url, bio, COALESCE(allow_calorie_share,0) as allow_calorie_share FROM users WHERE id = ?', 
      [userId], 
      (err, row) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!row) return res.status(404).json({ error: 'User not found' });
        res.json(row);
      }
    );
  }
});

// =============================================
// PUT /api/profile
// =============================================
// Update authenticated user's profile information
// Requires: Valid JWT token in Authorization header
// Body: { name, gym_id, bio, allow_calorie_share }
// Returns: Updated user profile data
router.put('/profile', verifyToken, async (req, res) => {
  // Get user ID from JWT token
  const userId = req.user.id;
  
  // Extract updatable fields from request body
  const { name, gym_id, bio, allow_calorie_share } = req.body;
  
  // Handle MongoDB path if enabled
  if (mongo.isEnabled()) {
    try {
      await mongo.connect();
      const Users = mongo.collection('users');
      
      // Convert string ID to MongoDB ObjectId
      const _id = toObjectId(userId);
      
      // Build update object - only include fields that were provided
      const update = {
        ...(name !== undefined ? { name } : {}),
        ...(bio !== undefined ? { bio } : {}),
        ...(allow_calorie_share !== undefined ? { allow_calorie_share: !!allow_calorie_share } : {}),
      };
      
      // Handle gym_id conversion
      if (gym_id !== undefined) {
        update.gym_id = gym_id ? toObjectId(gym_id) : null;
      }
      
      // Update user document
      await Users.updateOne({ _id }, { $set: update });
      
      // If gym_id was set, update/create membership as pending
      if (gym_id) {
        const Memberships = mongo.collection('memberships');
        await Memberships.updateOne(
          { user_id: _id },
          { 
            $set: { gym_id: update.gym_id, status: 'pending' },
            $setOnInsert: { created_at: new Date() }
          },
          { upsert: true }
        );
      }
      
      // Fetch and return updated user
      const user = await Users.findOne({ _id }, { projection: { password: 0 } });
      user.id = user._id.toString();
      user.allow_calorie_share = !!user.allow_calorie_share;
      delete user._id;
      return res.json(user);
    } catch (e) {
      return res.status(500).json({ error: 'Failed to update profile' });
    }
  } else {
    // Handle SQLite path (fallback)
    // Build SQL UPDATE query with provided fields, using COALESCE to preserve existing values if not provided
    db.run(
      'UPDATE users SET name = COALESCE(?, name), gym_id = COALESCE(?, gym_id), bio = COALESCE(?, bio), allow_calorie_share = COALESCE(?, allow_calorie_share) WHERE id = ?',
      [
        name !== undefined ? name : null,
        gym_id !== undefined ? gym_id : null,
        bio !== undefined ? bio : null,
        allow_calorie_share !== undefined ? (allow_calorie_share ? 1 : 0) : null,
        userId
      ],
      function (err) {
        if (err) return res.status(500).json({ error: 'Failed to update profile' });
        
        // If gym_id was set, update/create membership as pending
        if (gym_id) {
          db.run(`INSERT INTO memberships (user_id, gym_id, status) VALUES (?, ?, 'pending')
                  ON CONFLICT(user_id) DO UPDATE SET gym_id = excluded.gym_id, status = 'pending'`,
            [userId, gym_id],
            (err3) => {
              if (err3) console.error('Failed to upsert pending membership:', err3);
            }
          );
        }
        
        // Fetch and return updated user
        db.get(
          'SELECT id, name, email, role, gym_id, avatar_url, bio, COALESCE(allow_calorie_share,0) as allow_calorie_share FROM users WHERE id = ?',
          [userId],
          (err2, row) => {
            if (err2) return res.status(500).json({ error: 'Database error' });
            res.json(row);
          }
        );
      }
    );
  }
});

// ===== EXPORTS =====
// Export router to be used in main app
module.exports = router;
