const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../db');
const { verifyToken } = require('../middleware/auth');
const router = express.Router();

// Ensure we preserve the original file extension so browsers can render the image type correctly
const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads');
try { fs.mkdirSync(uploadsDir, { recursive: true }); } catch (_) {}
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '') || '.bin';
    const name = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2) + ext.toLowerCase();
    cb(null, name);
  }
});
const upload = multer({ storage });

// Upload avatar
router.post('/profile/avatar', verifyToken, upload.single('avatar'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const userId = req.user.id;
  const relPath = '/uploads/' + path.basename(req.file.path);
  db.run(`UPDATE users SET avatar_url = ? WHERE id = ?`, [relPath, userId], function (err) {
    if (err) return res.status(500).json({ error: 'Failed to save avatar' });
    res.json({ avatar_url: relPath });
  });
});

// List members of my gym with follow status
router.get('/gym/members', verifyToken, (req, res) => {
  const userId = req.user.id;
  db.get(`SELECT gym_id FROM users WHERE id = ?`, [userId], (err, me) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (!me || !me.gym_id) return res.json([]);
    const sql = `SELECT u.id, u.name, u.avatar_url,
                        CASE WHEN f.id IS NULL THEN 0 ELSE 1 END AS is_following
                 FROM users u
                 LEFT JOIN follows f ON f.follower_id = ? AND f.followee_id = u.id
                 WHERE (u.gym_id = ? OR u.id IN (SELECT owner_id FROM gyms WHERE id = ?))
                   AND u.id <> ?
                 ORDER BY u.name COLLATE NOCASE ASC`;
    db.all(sql, [userId, me.gym_id, me.gym_id, userId], (err2, rows) => {
      if (err2) return res.status(500).json({ error: 'DB error' });
      res.json(rows.map(r => ({ ...r, is_following: !!r.is_following })));
    });
  });
});

// Follow
router.post('/follow/:userId', verifyToken, (req, res) => {
  const followerId = req.user.id;
  const followeeId = parseInt(req.params.userId, 10);
  if (!followeeId || followeeId === followerId) return res.status(400).json({ error: 'Invalid user' });
  // Ensure same gym
  db.get(`SELECT a.gym_id as g1, b.gym_id as g2 FROM users a, users b WHERE a.id = ? AND b.id = ?`, [followerId, followeeId], (err, row) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (!row || !row.g1 || row.g1 !== row.g2) return res.status(400).json({ error: 'Can only follow members of your gym' });
    db.run(`INSERT OR IGNORE INTO follows (follower_id, followee_id) VALUES (?, ?)`, [followerId, followeeId], function (err2) {
      if (err2) return res.status(500).json({ error: 'Failed to follow' });
      res.json({ success: true });
    });
  });
});

// Unfollow
router.post('/unfollow/:userId', verifyToken, (req, res) => {
  const followerId = req.user.id;
  const followeeId = parseInt(req.params.userId, 10);
  db.run(`DELETE FROM follows WHERE follower_id = ? AND followee_id = ?`, [followerId, followeeId], function (err) {
    if (err) return res.status(500).json({ error: 'Failed to unfollow' });
    res.json({ success: true });
  });
});

// Remove a follower (block): remove row where they follow me
router.post('/me/followers/:userId/remove', verifyToken, (req, res) => {
  const me = req.user.id;
  const followerId = parseInt(req.params.userId, 10);
  if (!followerId) return res.status(400).json({ error: 'Invalid user' });
  db.run(`DELETE FROM follows WHERE follower_id = ? AND followee_id = ?`, [followerId, me], function (err) {
    if (err) return res.status(500).json({ error: 'Failed to remove follower' });
    res.json({ success: true });
  });
});

// Create a post (image optional)
router.post('/posts', verifyToken, upload.single('image'), (req, res) => {
  const userId = req.user.id;
  const text = (req.body && req.body.text) ? String(req.body.text).slice(0, 500) : '';
  const imagePath = req.file ? ('/uploads/' + path.basename(req.file.path)) : null;
  db.run(`INSERT INTO posts (user_id, image_path, text) VALUES (?, ?, ?)`, [userId, imagePath, text], function (err) {
    if (err) return res.status(500).json({ error: 'Failed to create post' });
    res.json({ id: this.lastID, user_id: userId, image_path: imagePath, text });
  });
});

// Feed for current user: own posts + followed users
router.get('/feed', verifyToken, (req, res) => {
  const userId = req.user.id;
  const sql = `
    SELECT p.*, u.name as author_name, u.avatar_url as author_avatar,
           COALESCE(lc.cnt, 0) as like_count,
           CASE WHEN lm.user_id IS NULL THEN 0 ELSE 1 END as liked_by_me
    FROM posts p
    JOIN users u ON u.id = p.user_id
    LEFT JOIN (
      SELECT post_id, COUNT(*) as cnt FROM post_likes GROUP BY post_id
    ) lc ON lc.post_id = p.id
    LEFT JOIN post_likes lm ON lm.post_id = p.id AND lm.user_id = ?
    WHERE p.user_id = ? OR p.user_id IN (SELECT followee_id FROM follows WHERE follower_id = ?)
    ORDER BY datetime(p.created_at) DESC
    LIMIT 200
  `;
  db.all(sql, [userId, userId, userId], (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json(rows.map(r => ({ ...r, liked_by_me: !!r.liked_by_me })));
  });
});

router.post('/posts/:id/like', verifyToken, (req, res) => {
  const userId = req.user.id;
  const postId = parseInt(req.params.id, 10);
  if (!postId) return res.status(400).json({ error: 'Invalid post id' });
  db.run(`INSERT OR IGNORE INTO post_likes (post_id, user_id) VALUES (?, ?)`, [postId, userId], function (err) {
    if (err) return res.status(500).json({ error: 'Failed to like' });
    res.json({ success: true });
  });
});

router.post('/posts/:id/unlike', verifyToken, (req, res) => {
  const userId = req.user.id;
  const postId = parseInt(req.params.id, 10);
  db.run(`DELETE FROM post_likes WHERE post_id = ? AND user_id = ?`, [postId, userId], function (err) {
    if (err) return res.status(500).json({ error: 'Failed to unlike' });
    res.json({ success: true });
  });
});

// Followers list for current user
router.get('/me/followers', verifyToken, (req, res) => {
  const userId = req.user.id;
  const sql = `
    SELECT u.id, COALESCE(u.name, 'User #' || u.id) AS name, u.avatar_url
    FROM follows f
    JOIN users u ON u.id = f.follower_id
    WHERE f.followee_id = ?
    ORDER BY u.name COLLATE NOCASE ASC
  `;
  db.all(sql, [userId], (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json(rows || []);
  });
});

// Following list for current user
router.get('/me/following', verifyToken, (req, res) => {
  const userId = req.user.id;
  const sql = `
    SELECT u.id, COALESCE(u.name, 'User #' || u.id) AS name, u.avatar_url
    FROM follows f
    JOIN users u ON u.id = f.followee_id
    WHERE f.follower_id = ?
    ORDER BY u.name COLLATE NOCASE ASC
  `;
  db.all(sql, [userId], (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json(rows || []);
  });
});

// Compute simple streak: consecutive days with presence or food log, counting back from today
router.get('/me/streak', verifyToken, (req, res) => {
  const userId = req.user.id;
  const sql = `
    SELECT DISTINCT date(checkin_at) as d FROM presence WHERE user_id = ? AND active = 0
    UNION
    SELECT DISTINCT date(date) as d FROM food_logs WHERE user_id = ?
  `;
  db.all(sql, [userId, userId], (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    const days = new Set((rows || []).map(r => r.d));
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      const key = d.toISOString().slice(0,10);
      if (days.has(key)) streak++; else break;
    }
    res.json({ streak });
  });
});

module.exports = router;
