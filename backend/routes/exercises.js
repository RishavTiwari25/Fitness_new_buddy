const express = require('express');
const db = require('../db');
const { verifyToken } = require('../middleware/auth');
const router = express.Router();

// GET /api/exercises/alternatives?targetMuscle=Chest
router.get('/exercises/alternatives', verifyToken, (req, res) => {
  const target = (req.query.targetMuscle || '').trim();
  if (!target) return res.status(400).json({ error: 'targetMuscle is required' });
  const sql = `SELECT id, exercise_name, target_muscle, equipment_needed, instructions, media_url
               FROM exercises WHERE lower(target_muscle) = lower(?)
               ORDER BY exercise_name ASC LIMIT 50`;
  db.all(sql, [target], (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json(rows);
  });
});

// Optional: list muscles present
router.get('/exercises/muscles', verifyToken, (req, res) => {
  db.all(`SELECT DISTINCT target_muscle FROM exercises WHERE target_muscle IS NOT NULL AND target_muscle <> '' ORDER BY target_muscle`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json(rows.map(r => r.target_muscle));
  });
});

module.exports = router;
