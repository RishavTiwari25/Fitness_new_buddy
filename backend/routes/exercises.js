const express = require('express');
const db = require('../db');
const mongo = require('../lib/mongo');
const { verifyToken } = require('../middleware/auth');
const router = express.Router();

// GET /api/exercises/alternatives?targetMuscle=Chest
router.get('/exercises/alternatives', verifyToken, async (req, res) => {
  const target = (req.query.targetMuscle || '').trim();
  if (!target) return res.status(400).json({ error: 'targetMuscle is required' });
  if (mongo.isEnabled()) {
    try {
      await mongo.connect();
      const Exercises = mongo.collection('exercises');
      const rows = await Exercises.find({ target_muscle: { $regex: new RegExp(`^${target}$`, 'i') } })
        .project({ exercise_name: 1, target_muscle: 1, equipment_needed: 1, instructions: 1, media_url: 1 })
        .sort({ exercise_name: 1 }).limit(50).toArray();
      return res.json(rows.map(r => ({ id: r._id.toString(), ...r, _id: undefined })));
    } catch (e) { return res.status(500).json({ error: 'DB error' }); }
  } else {
    const sql = `SELECT id, exercise_name, target_muscle, equipment_needed, instructions, media_url
                 FROM exercises WHERE lower(target_muscle) = lower(?)
                 ORDER BY exercise_name ASC LIMIT 50`;
    db.all(sql, [target], (err, rows) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      res.json(rows);
    });
  }
});

// Optional: list muscles present
router.get('/exercises/muscles', verifyToken, async (req, res) => {
  if (mongo.isEnabled()) {
    try {
      await mongo.connect();
      const Exercises = mongo.collection('exercises');
      const rows = await Exercises.aggregate([
        { $match: { target_muscle: { $nin: [null, ''] } } },
        { $group: { _id: '$target_muscle' } },
        { $sort: { _id: 1 } }
      ]).toArray();
      return res.json(rows.map(r => r._id));
    } catch (e) { return res.status(500).json({ error: 'DB error' }); }
  } else {
    db.all(`SELECT DISTINCT target_muscle FROM exercises WHERE target_muscle IS NOT NULL AND target_muscle <> '' ORDER BY target_muscle`, [], (err, rows) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      res.json(rows.map(r => r.target_muscle));
    });
  }
});

module.exports = router;
