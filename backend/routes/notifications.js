const express = require('express');
const db = require('../db');
const { verifyToken } = require('../middleware/auth');
const router = express.Router();

// List current user's notifications
router.get('/me/notifications', verifyToken, (req, res) => {
  const userId = req.user.id;
  const limit = Math.min(parseInt(req.query.limit || '20', 10) || 20, 100);
  db.all(
    `SELECT id, type, message, created_at, read FROM notifications 
     WHERE user_id = ? ORDER BY datetime(created_at) DESC LIMIT ?`,
    [userId, limit],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      res.json(rows || []);
    }
  );
});

// Unread count
router.get('/me/notifications/unread-count', verifyToken, (req, res) => {
  const userId = req.user.id;
  db.get(
    `SELECT COUNT(1) as cnt FROM notifications WHERE user_id = ? AND read = 0`,
    [userId],
    (err, row) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      res.json({ unread: row?.cnt || 0 });
    }
  );
});

// Mark one notification as read
router.post('/me/notifications/:id/read', verifyToken, (req, res) => {
  const userId = req.user.id;
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'id required' });
  db.run(
    `UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?`,
    [id, userId],
    function (err) {
      if (err) return res.status(500).json({ error: 'DB error' });
      res.json({ success: true, updated: this.changes || 0 });
    }
  );
});

// Mark all as read
router.post('/me/notifications/read-all', verifyToken, (req, res) => {
  const userId = req.user.id;
  db.run(
    `UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0`,
    [userId],
    function (err) {
      if (err) return res.status(500).json({ error: 'DB error' });
      res.json({ success: true, updated: this.changes || 0 });
    }
  );
});

module.exports = router;
