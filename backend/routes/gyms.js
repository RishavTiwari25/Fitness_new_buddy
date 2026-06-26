/**
 * =============================================
 * GYM MANAGEMENT ROUTES (routes/gyms.js)
 * =============================================
 * Handles gym CRUD operations and equipment management
 * Different permissions for owners, trainers, and members
 */

// ===== IMPORTS =====
const express = require('express');
const db = require('../db'); // SQLite database
const mongo = require('../lib/mongo'); // MongoDB utilities
const { toObjectId } = mongo; // Helper to convert strings to ObjectId
const { verifyToken, requireRole } = require('../middleware/auth'); // Auth middleware
const router = express.Router();

// =============================================
// POST /api/gyms
// =============================================
// Create a new gym (only gym owners can do this)
// Body: { name, location }
// Returns: { id, owner_id, name, location }
router.post('/gyms', verifyToken, requireRole('manager'), async (req, res) => {
  // Get owner ID from JWT token
  const ownerId = req.user.id;
  
  // Extract gym details from request
  const { name, location, description, timings, contact_info, amenities } = req.body;
  
  // Validate required field
  if (!name) return res.status(400).json({ error: 'Gym name required' });
  
  // Handle MongoDB path if enabled
  if (mongo.isEnabled()) {
    try {
      await mongo.connect();
      const Gyms = mongo.collection('gyms');
      
      // Create new gym document
      const doc = { 
        owner_id: toObjectId(ownerId), 
        name, 
        location: location || '', 
        description: description || '',
        timings: timings || '',
        contact_info: contact_info || '',
        amenities: amenities || '',
        created_at: new Date() 
      };
      
      // Insert gym into MongoDB
      const ins = await Gyms.insertOne(doc);
      return res.json({ 
        id: ins.insertedId.toString(), 
        owner_id: ownerId, 
        name, 
        location: location || '',
        description: description || '',
        timings: timings || '',
        contact_info: contact_info || '',
        amenities: amenities || ''
      });
    } catch (e) { 
      return res.status(500).json({ error: 'Failed to create gym' }); 
    }
  } else {
    // Handle SQLite path (fallback)
    db.run(
      `INSERT INTO gyms (owner_id, name, location, description, timings, contact_info, amenities) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [ownerId, name, location || '', description || '', timings || '', contact_info || '', amenities || ''],
      function(err) {
        if (err) return res.status(500).json({ error: 'Failed to create gym' });
        
        // Fetch and return the newly created gym
        db.get('SELECT * FROM gyms WHERE id = ?', [this.lastID], (err2, row) => {
          if (err2) return res.status(500).json({ error: 'DB error' });
          res.json(row);
        });
      }
    );
  }
});

// =============================================
// GET /api/gyms
// =============================================
// Get gyms based on user role:
// - Owners: Only their own gyms
// - Members/Trainers: All gyms (to browse and select)
router.get('/gyms', verifyToken, async (req, res) => {
  // Handle MongoDB path
  if (mongo.isEnabled()) {
    try {
      await mongo.connect();
      const Gyms = mongo.collection('gyms');
      
      // Filter based on user role
      // Owners only see their gyms, others see all
      const filter = req.user.role === 'owner' ? { owner_id: toObjectId(req.user.id) } : {};
      const rows = await Gyms.find(filter).toArray();
      
      // Format response with string IDs
      return res.json(rows.map(g => ({ 
        id: g._id.toString(), 
        owner_id: g.owner_id.toString(), 
        name: g.name, 
        location: g.location,
        description: g.description || '',
        timings: g.timings || '',
        contact_info: g.contact_info || '',
        amenities: g.amenities || ''
      })));
    } catch (e) { return res.status(500).json({ error: 'DB error' }); }
  } else {
    // Handle SQLite path
    if (req.user.role === 'owner') {
      // Owners: fetch their gyms only
      db.all('SELECT * FROM gyms WHERE owner_id = ?', [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ error: 'DB error' });
        res.json(rows);
      });
    } else {
      // Members/Trainers: fetch all gyms
      db.all('SELECT * FROM gyms', [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'DB error' });
        res.json(rows);
      });
    }
  }
});

// =============================================
// PUT /api/gyms/:gymId
// =============================================
// Update gym details
router.put('/gyms/:gymId', verifyToken, requireRole('manager'), async (req, res) => {
  const gymId = req.params.gymId;
  const ownerId = req.user.id;
  const { name, location, description, timings, contact_info, amenities } = req.body;

  if (mongo.isEnabled()) {
    try {
      await mongo.connect();
      const Gyms = mongo.collection('gyms');
      
      const gym = await Gyms.findOne({ _id: toObjectId(String(gymId)) });
      if (!gym) return res.status(404).json({ error: 'Gym not found' });
      if (gym.owner_id.toString() !== String(ownerId)) return res.status(403).json({ error: 'Forbidden' });
      
      const update = {
        name: name || gym.name,
        location: location || gym.location,
        description: description || '',
        timings: timings || '',
        contact_info: contact_info || '',
        amenities: amenities || ''
      };
      
      await Gyms.updateOne({ _id: gym._id }, { $set: update });
      return res.json({ success: true });
    } catch (e) { return res.status(500).json({ error: 'DB error' }); }
  } else {
    db.get('SELECT * FROM gyms WHERE id = ?', [gymId], (err, gym) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      if (!gym) return res.status(404).json({ error: 'Gym not found' });
      if (String(gym.owner_id) !== String(ownerId)) return res.status(403).json({ error: 'Forbidden' });
      
      const sql = `UPDATE gyms SET name = ?, location = ?, description = ?, timings = ?, contact_info = ?, amenities = ? WHERE id = ?`;
      db.run(sql, [
        name || gym.name, 
        location || gym.location, 
        description || '', 
        timings || '', 
        contact_info || '', 
        amenities || '', 
        gymId
      ], function(err2) {
        if (err2) return res.status(500).json({ error: 'Failed to update gym' });
        res.json({ success: true });
      });
    });
  }
});

// =============================================
// GET /api/gyms/:gymId/details
// =============================================
// Get detailed profile of a gym including trainers and equipment count
router.get('/gyms/:gymId/details', verifyToken, async (req, res) => {
  const gymId = req.params.gymId;
  
  if (mongo.isEnabled()) {
    try {
      await mongo.connect();
      const Gyms = mongo.collection('gyms');
      const Users = mongo.collection('users');
      const Equipment = mongo.collection('equipment');
      
      const gym = await Gyms.findOne({ _id: toObjectId(String(gymId)) });
      if (!gym) return res.status(404).json({ error: 'Gym not found' });
      
      const trainers = await Users.find({ role: 'trainer', gym_id: gym._id }).project({ name: 1, email: 1, avatar_url: 1 }).toArray();
      const eqCount = await Equipment.countDocuments({ gym_id: gym._id });
      
      return res.json({
        id: gym._id.toString(),
        name: gym.name,
        location: gym.location,
        description: gym.description || '',
        timings: gym.timings || '',
        contact_info: gym.contact_info || '',
        amenities: gym.amenities || '',
        trainers: trainers.map(t => ({ id: t._id.toString(), name: t.name || 'Trainer', email: t.email, avatar_url: t.avatar_url })),
        equipment_count: eqCount
      });
    } catch (e) { return res.status(500).json({ error: 'DB error' }); }
  } else {
    db.get('SELECT * FROM gyms WHERE id = ?', [gymId], (err, gym) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      if (!gym) return res.status(404).json({ error: 'Gym not found' });
      
      db.all('SELECT id, name, email, avatar_url FROM users WHERE role = "trainer" AND gym_id = ?', [gymId], (err2, trainers) => {
        if (err2) return res.status(500).json({ error: 'DB error' });
        
        db.get('SELECT COUNT(*) as count FROM equipment WHERE gym_id = ?', [gymId], (err3, eq) => {
          if (err3) return res.status(500).json({ error: 'DB error' });
          
          res.json({
            ...gym,
            description: gym.description || '',
            timings: gym.timings || '',
            contact_info: gym.contact_info || '',
            amenities: gym.amenities || '',
            trainers: trainers || [],
            equipment_count: eq ? eq.count : 0
          });
        });
      });
    });
  }
});

// Get equipment for a gym - any authenticated user
router.get('/gyms/:gymId/equipment', verifyToken, async (req, res) => {
  const gymId = req.params.gymId;
  if (mongo.isEnabled()) {
    try {
      await mongo.connect();
      const Equipment = mongo.collection('equipment');
      const rows = await Equipment.find({ gym_id: toObjectId(gymId) }).toArray();
      return res.json(rows.map(e => ({ id: e._id.toString(), gym_id: e.gym_id.toString(), name: e.name, notes: e.notes, quantity: e.quantity })));
    } catch (e) { return res.status(500).json({ error: 'DB error' }); }
  } else {
    db.all('SELECT * FROM equipment WHERE gym_id = ?', [gymId], (err, rows) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      res.json(rows);
    });
  }
});

// Equipment with current booking status for a gym
router.get('/gyms/:gymId/equipment-status', verifyToken, async (req, res) => {
  const gymId = req.params.gymId;
  if (mongo.isEnabled()) {
    try {
      await mongo.connect();
      const Equipment = mongo.collection('equipment');
      const Bookings = mongo.collection('equipment_booking');
      const eq = await Equipment.find({ gym_id: toObjectId(String(gymId)) }).toArray();
      const ids = eq.map(e => e._id);
      const agg = await Bookings.aggregate([
        { $match: { equipment_id: { $in: ids }, active: true } },
        { $group: { _id: '$equipment_id', cnt: { $sum: 1 }, mine: { $sum: { $cond: [{ $eq: ['$user_id', toObjectId(req.user.id)] }, 1, 0] } } } }
      ]).toArray();
      const map = new Map(agg.map(a => [a._id.toString(), a]));
      const rows = eq.map(e => {
        const a = map.get(e._id.toString());
        return {
          id: e._id.toString(),
          gym_id: e.gym_id.toString(),
          name: e.name,
          notes: e.notes,
          quantity: e.quantity,
          active_count: a?.cnt || 0,
          booked_by_me: (a?.mine || 0) > 0
        };
      });
      return res.json(rows);
    } catch (e) { return res.status(500).json({ error: 'DB error' }); }
  } else {
    // For each equipment, return active booking count and whether current user booked it
    const sql = `
      SELECT 
        e.id,
        e.gym_id,
        e.name,
        e.notes,
        e.quantity,
        -- total active bookings for this equipment
        (
          SELECT COUNT(1) FROM equipment_booking b 
          WHERE b.equipment_id = e.id AND b.active = 1
        ) AS active_count,
        -- whether current user has an active booking on this equipment
        (
          SELECT COUNT(1) FROM equipment_booking b2 
          WHERE b2.equipment_id = e.id AND b2.active = 1 AND b2.user_id = ?
        ) AS booked_by_me
      FROM equipment e
      WHERE e.gym_id = ?
      ORDER BY e.name ASC
    `;
    db.all(sql, [req.user.id, gymId], (err, rows) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      // Normalize booleans
      const mapped = rows.map(r => ({
        ...r,
        active_count: Number(r.active_count || 0),
        booked_by_me: Number(r.booked_by_me || 0) > 0
      }));
      res.json(mapped);
    });
  }
});

// Add equipment to a gym - only the gym owner
router.post('/gyms/:gymId/equipment', verifyToken, requireRole('manager'), async (req, res) => {
  const gymId = req.params.gymId;
  const { name, notes, quantity } = req.body;
  if (!name) return res.status(400).json({ error: 'Equipment name required' });
  if (mongo.isEnabled()) {
    try {
      await mongo.connect();
      const Gyms = mongo.collection('gyms');
      const Equipment = mongo.collection('equipment');
      const gym = await Gyms.findOne({ _id: toObjectId(gymId) });
      if (!gym) return res.status(404).json({ error: 'Gym not found' });
      if (gym.owner_id.toString() !== req.user.id) return res.status(403).json({ error: 'Not the gym owner' });
      const ins = await Equipment.insertOne({ gym_id: gym._id, name, notes: notes || '', quantity: quantity || 1 });
      const row = await Equipment.findOne({ _id: ins.insertedId });
      return res.json({ id: row._id.toString(), gym_id: row.gym_id.toString(), name: row.name, notes: row.notes, quantity: row.quantity });
    } catch (e) { return res.status(500).json({ error: 'Failed to create equipment' }); }
  } else {
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
  }
});

// Edit equipment - only owner
router.put('/equipment/:id', verifyToken, requireRole('manager'), async (req, res) => {
  const id = req.params.id;
  const { name, notes, quantity } = req.body;
  if (mongo.isEnabled()) {
    try {
      await mongo.connect();
      const Equipment = mongo.collection('equipment');
      const Gyms = mongo.collection('gyms');
      const row = await Equipment.findOne({ _id: toObjectId(id) });
      if (!row) return res.status(404).json({ error: 'Equipment not found' });
      const gym = await Gyms.findOne({ _id: row.gym_id });
      if (!gym) return res.status(404).json({ error: 'Gym not found' });
      if (gym.owner_id.toString() !== req.user.id) return res.status(403).json({ error: 'Not the gym owner' });
      await Equipment.updateOne({ _id: row._id }, { $set: { name: name || row.name, notes: notes || row.notes, quantity: quantity || row.quantity } });
      const updated = await Equipment.findOne({ _id: row._id });
      return res.json({ id: updated._id.toString(), gym_id: updated.gym_id.toString(), name: updated.name, notes: updated.notes, quantity: updated.quantity });
    } catch (e) { return res.status(500).json({ error: 'Failed to update' }); }
  } else {
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
  }
});

// Delete equipment - only owner
router.delete('/equipment/:id', verifyToken, requireRole('manager'), async (req, res) => {
  const id = req.params.id;
  if (mongo.isEnabled()) {
    try {
      await mongo.connect();
      const Equipment = mongo.collection('equipment');
      const Gyms = mongo.collection('gyms');
      const row = await Equipment.findOne({ _id: toObjectId(id) });
      if (!row) return res.status(404).json({ error: 'Equipment not found' });
      const gym = await Gyms.findOne({ _id: row.gym_id });
      if (!gym) return res.status(404).json({ error: 'Gym not found' });
      if (gym.owner_id.toString() !== req.user.id) return res.status(403).json({ error: 'Not the gym owner' });
      await Equipment.deleteOne({ _id: row._id });
      return res.json({ success: true });
    } catch (e) { return res.status(500).json({ error: 'Failed to delete' }); }
  } else {
    db.get('SELECT e.*, g.owner_id FROM equipment e JOIN gyms g ON e.gym_id = g.id WHERE e.id = ?', [id], (err, row) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      if (!row) return res.status(404).json({ error: 'Equipment not found' });
      if (row.owner_id !== req.user.id) return res.status(403).json({ error: 'Not the gym owner' });

      db.run('DELETE FROM equipment WHERE id = ?', [id], function (err2) {
        if (err2) return res.status(500).json({ error: 'Failed to delete' });
        res.json({ success: true });
      });
    });
  }
});

module.exports = router;
// Additional presence/occupancy endpoints

// Book an equipment (members/trainers). Requires being checked in to that gym.
router.post('/equipment/:equipmentId/book', verifyToken, async (req, res) => {
  const equipmentId = req.params.equipmentId;
  const userId = req.user.id;
  if (!['member', 'trainer'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Only members or trainers can book equipment' });
  }
  if (mongo.isEnabled()) {
    try {
      await mongo.connect();
      const Equipment = mongo.collection('equipment');
      const Presence = mongo.collection('presence');
      const Bookings = mongo.collection('equipment_booking');
      const eq = await Equipment.findOne({ _id: toObjectId(req.params.equipmentId) });
      if (!eq) return res.status(404).json({ error: 'Equipment not found' });
      const pres = await Presence.findOne({ user_id: toObjectId(userId), gym_id: eq.gym_id, active: true });
      if (!pres) return res.status(400).json({ error: 'You must be checked in to this gym to book equipment' });
      const activeCount = await Bookings.countDocuments({ equipment_id: eq._id, active: true });
      if (activeCount >= (eq.quantity || 1)) return res.status(400).json({ error: 'All units are currently booked' });
      const userActive = await Bookings.findOne({ user_id: toObjectId(userId), active: true, equipment_id: { $in: await Equipment.find({ gym_id: eq.gym_id }).project({ _id: 1 }).map(e => e._id).toArray() } });
      if (userActive) return res.status(400).json({ error: 'You already have an active booking in this gym' });
      const ins = await Bookings.insertOne({ equipment_id: eq._id, user_id: toObjectId(userId), started_at: new Date(), active: true });
      const row = await Bookings.findOne({ _id: ins.insertedId });
      return res.json({ id: row._id.toString(), equipment_id: row.equipment_id.toString(), user_id: row.user_id.toString(), started_at: row.started_at, active: row.active });
    } catch (e) { return res.status(500).json({ error: 'Failed to create booking' }); }
  } else {
    const fetchEquipment = `SELECT e.*, g.owner_id FROM equipment e JOIN gyms g ON e.gym_id = g.id WHERE e.id = ?`;
    db.get(fetchEquipment, [equipmentId], (err, eq) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      if (!eq) return res.status(404).json({ error: 'Equipment not found' });

      // Must be checked in to this gym to book
      db.get('SELECT * FROM presence WHERE user_id = ? AND gym_id = ? AND active = 1', [userId, eq.gym_id], (err2, pres) => {
        if (err2) return res.status(500).json({ error: 'DB error' });
        if (!pres) return res.status(400).json({ error: 'You must be checked in to this gym to book equipment' });

        // Check current active bookings vs quantity
        db.get('SELECT COUNT(1) AS cnt FROM equipment_booking WHERE equipment_id = ? AND active = 1', [equipmentId], (err3, cntRow) => {
          if (err3) return res.status(500).json({ error: 'DB error' });
          const activeCount = cntRow ? Number(cntRow.cnt || 0) : 0;
          if (activeCount >= (eq.quantity || 1)) {
            return res.status(400).json({ error: 'All units are currently booked' });
          }

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
  }
});

// Release an equipment booking. Only the booking user or the gym owner can release.
router.post('/equipment/:equipmentId/release', verifyToken, async (req, res) => {
  const equipmentId = req.params.equipmentId;
  const userId = req.user.id;
  if (mongo.isEnabled()) {
    try {
      await mongo.connect();
      const Equipment = mongo.collection('equipment');
      const Gyms = mongo.collection('gyms');
      const Bookings = mongo.collection('equipment_booking');
      const eq = await Equipment.findOne({ _id: toObjectId(req.params.equipmentId) });
      if (!eq) return res.status(404).json({ error: 'Equipment not found' });
      const mine = await Bookings.findOne({ equipment_id: eq._id, active: true, user_id: toObjectId(userId) }, { sort: { started_at: 1 } });
      if (mine) {
        await Bookings.updateOne({ _id: mine._id }, { $set: { active: false, ended_at: new Date() } });
        return res.json({ success: true });
      }
      const gym = await Gyms.findOne({ _id: eq.gym_id });
      if (!gym) return res.status(404).json({ error: 'Gym not found' });
      if (!(req.user.role === 'owner' && gym.owner_id.toString() === userId)) return res.status(403).json({ error: 'Not allowed to release this booking' });
      const any = await Bookings.findOne({ equipment_id: eq._id, active: true }, { sort: { started_at: 1 } });
      if (!any) return res.status(400).json({ error: 'No active booking found for this equipment' });
      await Bookings.updateOne({ _id: any._id }, { $set: { active: false, ended_at: new Date() } });
      return res.json({ success: true });
    } catch (e) { return res.status(500).json({ error: 'Failed to release booking' }); }
  } else {
    const baseJoin = `
      SELECT b.*, e.gym_id, g.owner_id FROM equipment_booking b
      JOIN equipment e ON e.id = b.equipment_id
      JOIN gyms g ON g.id = e.gym_id
      WHERE b.equipment_id = ? AND b.active = 1
    `;
    // Prefer releasing the booking of the current user if exists
    db.get(baseJoin + ' AND b.user_id = ? ORDER BY b.started_at ASC', [equipmentId, userId], (err, mine) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      if (mine) {
        return db.run('UPDATE equipment_booking SET active = 0, ended_at = datetime("now") WHERE id = ?', [mine.id], function (err2) {
          if (err2) return res.status(500).json({ error: 'Failed to release booking' });
          return res.json({ success: true });
        });
      }
      // If not user's booking, allow owner to release any active booking
      db.get(baseJoin + ' ORDER BY b.started_at ASC', [equipmentId], (err2, row) => {
        if (err2) return res.status(500).json({ error: 'DB error' });
        if (!row) return res.status(400).json({ error: 'No active booking found for this equipment' });
        const isOwner = req.user.role === 'owner' && row.owner_id === userId;
        if (!isOwner) return res.status(403).json({ error: 'Not allowed to release this booking' });
        db.run('UPDATE equipment_booking SET active = 0, ended_at = datetime("now") WHERE id = ?', [row.id], function (err3) {
          if (err3) return res.status(500).json({ error: 'Failed to release booking' });
          res.json({ success: true });
        });
      });
    });
  }
});

// Get current user's active booking(s)
router.get('/me/bookings', verifyToken, async (req, res) => {
  const userId = req.user.id;
  if (mongo.isEnabled()) {
    try {
      await mongo.connect();
      const Bookings = mongo.collection('equipment_booking');
      const Equipment = mongo.collection('equipment');
      const Gyms = mongo.collection('gyms');
      const rows = await Bookings.find({ user_id: toObjectId(userId), active: true }).sort({ started_at: -1 }).toArray();
      const eqIds = rows.map(r => r.equipment_id);
      const eqDocs = await Equipment.find({ _id: { $in: eqIds } }).project({ name: 1, gym_id: 1 }).toArray();
      const eqMap = new Map(eqDocs.map(e => [e._id.toString(), e]));
      const gymIds = [...new Set(eqDocs.map(e => e.gym_id.toString()))].map(toObjectId);
      const gyms = await Gyms.find({ _id: { $in: gymIds } }).project({ name: 1 }).toArray();
      const gymMap = new Map(gyms.map(g => [g._id.toString(), g]));
      const resp = rows.map(b => {
        const e = eqMap.get(b.equipment_id.toString());
        const g = e ? gymMap.get(e.gym_id.toString()) : null;
        return {
          id: b._id.toString(),
          user_id: b.user_id.toString(),
          equipment_id: b.equipment_id.toString(),
          equipment_name: e?.name,
          gym_id: e?.gym_id?.toString(),
          gym_name: g?.name,
          started_at: b.started_at,
          active: b.active
        };
      });
      return res.json(resp);
    } catch (e) { return res.status(500).json({ error: 'DB error' }); }
  } else {
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
  }
});

// Toggle check-in/out for a member at a gym
router.post('/gyms/:gymId/checkin', verifyToken, requireRole('member'), async (req, res) => {
  const gymId = req.params.gymId;
  const userId = req.user.id;
  if (mongo.isEnabled()) {
    try {
      await mongo.connect();
      const Gyms = mongo.collection('gyms');
      const Presence = mongo.collection('presence');
      const Equipment = mongo.collection('equipment');
      const Bookings = mongo.collection('equipment_booking');
      const Memberships = mongo.collection('memberships');
      
      const gym = await Gyms.findOne({ _id: toObjectId(String(gymId)) });
      if (!gym) return res.status(404).json({ error: 'Gym not found' });
      const activeRow = await Presence.findOne({ user_id: toObjectId(userId), active: true });
      const finish = async () => {
        const count = await Presence.countDocuments({ gym_id: toObjectId(String(gymId)), active: true });
        return res.json({ gym_id: gymId, action: req._action, count });
      };
      if (activeRow && activeRow.gym_id.toString() === String(gym._id)) {
        await Presence.updateOne({ _id: activeRow._id }, { $set: { active: false, checkout_at: new Date() } });
        // Release bookings in this gym
        const eqIds = await Equipment.find({ gym_id: gym._id }).project({ _id: 1 }).map(e => e._id).toArray();
        await Bookings.updateMany({ user_id: toObjectId(userId), active: true, equipment_id: { $in: eqIds } }, { $set: { active: false, ended_at: new Date() } });
        req._action = 'checkout';
        return finish();
      } else {
        // Checking in - verify membership is approved
        const mbr = await Memberships.findOne({ user_id: toObjectId(userId), gym_id: gym._id });
        if (!mbr || mbr.status !== 'approved') {
          return res.status(403).json({ error: 'Your membership is pending approval by the Gym Manager.' });
        }
        
        if (activeRow) {
          await Presence.updateOne({ _id: activeRow._id }, { $set: { active: false, checkout_at: new Date() } });
          // Release bookings in previous gym
          const eqPrev = await Equipment.find({ gym_id: activeRow.gym_id }).project({ _id: 1 }).map(e => e._id).toArray();
          await Bookings.updateMany({ user_id: toObjectId(userId), active: true, equipment_id: { $in: eqPrev } }, { $set: { active: false, ended_at: new Date() } });
        }
        await Presence.insertOne({ gym_id: gym._id, user_id: toObjectId(userId), checkin_at: new Date(), active: true });
        req._action = 'checkin';
        return finish();
      }
    } catch (e) { return res.status(500).json({ error: 'DB error' }); }
  } else {
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
            // Auto-release any active bookings by this user in this gym
            const releaseSql = `
              UPDATE equipment_booking
              SET active = 0, ended_at = datetime('now')
              WHERE user_id = ? AND active = 1 AND equipment_id IN (
                SELECT id FROM equipment WHERE gym_id = ?
              )
            `;
            db.run(releaseSql, [userId, gymId], function () {
              req._action = 'checkout';
              finish();
            });
          });
        } else {
          // Checking in - verify membership is approved
          db.get('SELECT status FROM memberships WHERE user_id = ? AND gym_id = ?', [userId, gymId], (errMbr, mbrRow) => {
            if (errMbr) return res.status(500).json({ error: 'DB error' });
            if (!mbrRow || mbrRow.status !== 'approved') {
              return res.status(403).json({ error: 'Your membership is pending approval by the Gym Manager.' });
            }
            
            const endOther = (cb) => {
              if (activeRow) {
              db.run('UPDATE presence SET active = 0, checkout_at = datetime("now") WHERE id = ?', [activeRow.id], (errEnd) => {
                if (errEnd) return cb(errEnd);
                // Also auto-release any active bookings in the previous gym
                const releasePrevSql = `
                  UPDATE equipment_booking
                  SET active = 0, ended_at = datetime('now')
                  WHERE user_id = ? AND active = 1 AND equipment_id IN (
                    SELECT id FROM equipment WHERE gym_id = ?
                  )
                `;
                db.run(releasePrevSql, [userId, activeRow.gym_id], (errRel) => cb(errRel));
              });
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
          }); // End db.get(memberships)
        }
      });
    });
  }
});

// Get current occupancy for a gym
router.get('/gyms/:gymId/occupancy', verifyToken, async (req, res) => {
  const gymId = req.params.gymId;
  if (mongo.isEnabled()) {
    try {
      await mongo.connect();
      const Gyms = mongo.collection('gyms');
      const Presence = mongo.collection('presence');
      const gym = await Gyms.findOne({ _id: toObjectId(String(gymId)) });
      if (!gym) return res.status(404).json({ error: 'Gym not found' });
      const count = await Presence.countDocuments({ gym_id: gym._id, active: true });
      return res.json({ gym_id: String(gymId), gym_name: gym.name, count });
    } catch (e) { return res.status(500).json({ error: 'DB error' }); }
  } else {
    db.get('SELECT * FROM gyms WHERE id = ?', [gymId], (err, gym) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      if (!gym) return res.status(404).json({ error: 'Gym not found' });
      db.get('SELECT COUNT(*) AS count FROM presence WHERE gym_id = ? AND active = 1', [gymId], (err2, c) => {
        if (err2) return res.status(500).json({ error: 'DB error' });
        res.json({ gym_id: gymId, gym_name: gym.name, count: c.count });
      });
    });
  }
});

// List of currently checked-in members for a gym (owners only)
router.get('/gyms/:gymId/presence', verifyToken, requireRole('manager'), async (req, res) => {
  const gymId = req.params.gymId;
  if (mongo.isEnabled()) {
    try {
      await mongo.connect();
      const Gyms = mongo.collection('gyms');
      const Presence = mongo.collection('presence');
      const Users = mongo.collection('users');
      const gym = await Gyms.findOne({ _id: toObjectId(String(gymId)) });
      if (!gym) return res.status(404).json({ error: 'Gym not found' });
      if (gym.owner_id.toString() !== req.user.id) return res.status(403).json({ error: 'Not the gym owner' });
      const prs = await Presence.find({ gym_id: gym._id, active: true }).sort({ checkin_at: 1 }).toArray();
      const userIds = prs.map(p => p.user_id);
      const users = await Users.find({ _id: { $in: userIds } }).project({ name: 1, email: 1 }).toArray();
      const uMap = new Map(users.map(u => [u._id.toString(), u]));
      const rows = prs.map(p => ({ presence_id: p._id.toString(), checkin_at: p.checkin_at, user_id: p.user_id.toString(), name: uMap.get(p.user_id.toString())?.name, email: uMap.get(p.user_id.toString())?.email }));
      return res.json({ gym_id: String(gymId), members: rows });
    } catch (e) { return res.status(500).json({ error: 'DB error' }); }
  } else {
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
  }
});

// List active bookings for a gym (owners only)
router.get('/gyms/:gymId/bookings', verifyToken, requireRole('manager'), async (req, res) => {
  const gymId = req.params.gymId;
  if (mongo.isEnabled()) {
    try {
      await mongo.connect();
      const Gyms = mongo.collection('gyms');
      const Equipment = mongo.collection('equipment');
      const Bookings = mongo.collection('equipment_booking');
      const Users = mongo.collection('users');
      const gym = await Gyms.findOne({ _id: toObjectId(String(gymId)) });
      if (!gym) return res.status(404).json({ error: 'Gym not found' });
      if (gym.owner_id.toString() !== req.user.id) return res.status(403).json({ error: 'Not the gym owner' });
      const eqIds = await Equipment.find({ gym_id: gym._id }).project({ _id: 1, name: 1 }).toArray();
      const eqMap = new Map(eqIds.map(e => [e._id.toString(), e.name]));
      const ids = eqIds.map(e => e._id);
      const rows = await Bookings.find({ active: true, equipment_id: { $in: ids } }).sort({ started_at: 1 }).toArray();
      const userIds = [...new Set(rows.map(r => r.user_id.toString()))].map(toObjectId);
      const users = await Users.find({ _id: { $in: userIds } }).project({ name: 1, email: 1 }).toArray();
      const uMap = new Map(users.map(u => [u._id.toString(), u]));
      const resp = rows.map(b => ({
        booking_id: b._id.toString(),
        started_at: b.started_at,
        user_id: b.user_id.toString(),
        equipment_id: b.equipment_id.toString(),
        user_name: uMap.get(b.user_id.toString())?.name,
        user_email: uMap.get(b.user_id.toString())?.email,
        equipment_name: eqMap.get(b.equipment_id.toString())
      }));
      return res.json({ gym_id: String(gymId), bookings: resp });
    } catch (e) { return res.status(500).json({ error: 'DB error' }); }
  } else {
    db.get('SELECT * FROM gyms WHERE id = ?', [gymId], (err, gym) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      if (!gym) return res.status(404).json({ error: 'Gym not found' });
      if (gym.owner_id !== req.user.id) return res.status(403).json({ error: 'Not the gym owner' });

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
      db.all(sql, [gymId], (err2, rows) => {
        if (err2) return res.status(500).json({ error: 'DB error' });
        res.json({ gym_id: gymId, bookings: rows });
      });
    });
  }
});
