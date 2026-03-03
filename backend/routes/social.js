const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');
const db = require('../db');
const mongo = require('../lib/mongo');
const { toObjectId } = mongo;
const { verifyToken } = require('../middleware/auth');
const router = express.Router();

// Optional Cloudinary uploads (if CLOUDINARY_URL is set). Falls back to disk.
const useCloudinary = !!process.env.CLOUDINARY_URL;
if (useCloudinary) {
  // CLOUDINARY_URL is auto-parsed by SDK; secure URLs enabled
  cloudinary.config({ secure: true });
}

// Ensure uploads dir exists for disk storage fallback
// Keep default aligned with backend static uploads path
const uploadsDir = process.env.UPLOADS_DIR || path.resolve(__dirname, '..', 'uploads');
try { fs.mkdirSync(uploadsDir, { recursive: true }); } catch (_) {}

const storage = useCloudinary
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, uploadsDir),
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname || '') || '.bin';
        const name = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2) + ext.toLowerCase();
        cb(null, name);
      }
    });
const upload = multer({ storage });

function normalizeMediaPath(p) {
  if (!p || typeof p !== 'string') return null;
  let v = p.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  v = v.replace(/\\/g, '/');
  if (v.startsWith('/uploads/')) return v;
  if (v.startsWith('uploads/')) return '/' + v;
  const uploadsIndex = v.toLowerCase().indexOf('/uploads/');
  if (uploadsIndex >= 0) return v.slice(uploadsIndex);
  const fileName = path.basename(v);
  if (!fileName) return null;
  return '/uploads/' + fileName;
}

// Upload avatar
router.post('/profile/avatar', verifyToken, upload.single('avatar'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const userId = req.user.id;
  try {
    let url;
    if (useCloudinary) {
      try {
        url = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream({ folder: 'fitness-buddy/avatars' }, (err, result) => {
            if (err) return reject(err);
            resolve(result.secure_url);
          });
          streamifier.createReadStream(req.file.buffer).pipe(stream);
        });
      } catch (e) {
        // Fallback to disk if Cloudinary fails
        const ext = path.extname(req.file.originalname || '') || '.bin';
        const name = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2) + ext.toLowerCase();
        const filePath = path.join(uploadsDir, name);
        fs.writeFileSync(filePath, req.file.buffer);
        url = '/uploads/' + name;
      }
    } else {
      const relPath = '/uploads/' + path.basename(req.file.path);
      url = relPath;
    }
    if (mongo.isEnabled()) {
      await mongo.connect();
      const Users = mongo.collection('users');
      await Users.updateOne({ _id: toObjectId(userId) }, { $set: { avatar_url: url } });
      return res.json({ avatar_url: url });
    } else {
      db.run(`UPDATE users SET avatar_url = ? WHERE id = ?`, [url, userId], function (err) {
        if (err) return res.status(500).json({ error: 'Failed to save avatar' });
        res.json({ avatar_url: url });
      });
    }
  } catch (e) {
    res.status(500).json({ error: 'Avatar upload failed' });
  }
});

// List members of my gym with follow status
router.get('/gym/members', verifyToken, async (req, res) => {
  const userId = req.user.id;
  if (mongo.isEnabled()) {
    try {
      await mongo.connect();
      const Users = mongo.collection('users');
      const Follows = mongo.collection('follows');
      const Gyms = mongo.collection('gyms');
      const me = await Users.findOne({ _id: toObjectId(userId) }, { projection: { gym_id: 1 } });
      if (!me || !me.gym_id) return res.json([]);
      const owner = await Gyms.findOne({ _id: me.gym_id }, { projection: { owner_id: 1 } });
      const ownerId = owner?.owner_id?.toString();
      const members = await Users.find({
        $and: [
          { _id: { $ne: toObjectId(userId) } },
          { $or: [ { gym_id: me.gym_id }, ownerId ? { _id: toObjectId(ownerId) } : { _id: { $exists: true } } ] }
        ]
      }, { projection: { name: 1, avatar_url: 1 } }).toArray();
      const followDocs = await Follows.find({ follower_id: toObjectId(userId) }).project({ followee_id: 1 }).toArray();
      const followingSet = new Set(followDocs.map(f => f.followee_id.toString()));
      const resp = members.map(u => ({ id: u._id.toString(), name: u.name, avatar_url: normalizeMediaPath(u.avatar_url), is_following: followingSet.has(u._id.toString()) }));
      return res.json(resp);
    } catch (e) {
      return res.status(500).json({ error: 'DB error' });
    }
  } else {
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
        res.json(rows.map(r => ({ ...r, avatar_url: normalizeMediaPath(r.avatar_url), is_following: !!r.is_following })));
      });
    });
  }
});

// Follow
router.post('/follow/:userId', verifyToken, async (req, res) => {
  const followerId = req.user.id;
  const followeeId = parseInt(req.params.userId, 10);
  if (mongo.isEnabled()) {
    try {
      await mongo.connect();
      const Users = mongo.collection('users');
      const Follows = mongo.collection('follows');
      const me = await Users.findOne({ _id: toObjectId(followerId) }, { projection: { gym_id: 1 } });
      const other = await Users.findOne({ _id: toObjectId(req.params.userId) }, { projection: { gym_id: 1 } });
      if (!me || !other || !me.gym_id || !other.gym_id || me.gym_id.toString() !== other.gym_id.toString()) {
        return res.status(400).json({ error: 'Can only follow members of your gym' });
      }
      await Follows.updateOne(
        { follower_id: toObjectId(followerId), followee_id: toObjectId(req.params.userId) },
        { $setOnInsert: { follower_id: toObjectId(followerId), followee_id: toObjectId(req.params.userId), created_at: new Date() } },
        { upsert: true }
      );
      return res.json({ success: true });
    } catch (e) { return res.status(500).json({ error: 'Failed to follow' }); }
  } else {
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
  }
});

// Unfollow
router.post('/unfollow/:userId', verifyToken, async (req, res) => {
  const followerId = req.user.id;
  const followeeId = parseInt(req.params.userId, 10);
  if (mongo.isEnabled()) {
    try {
      await mongo.connect();
      const Follows = mongo.collection('follows');
      await Follows.deleteOne({ follower_id: toObjectId(followerId), followee_id: toObjectId(req.params.userId) });
      return res.json({ success: true });
    } catch (e) {
      return res.status(500).json({ error: 'Failed to unfollow' });
    }
  } else {
    db.run(`DELETE FROM follows WHERE follower_id = ? AND followee_id = ?`, [followerId, followeeId], function (err) {
      if (err) return res.status(500).json({ error: 'Failed to unfollow' });
      res.json({ success: true });
    });
  }
});

// Remove a follower (block): remove row where they follow me
router.post('/me/followers/:userId/remove', verifyToken, async (req, res) => {
  const me = req.user.id;
  const followerId = parseInt(req.params.userId, 10);
  if (!followerId) return res.status(400).json({ error: 'Invalid user' });
  if (mongo.isEnabled()) {
    try {
      await mongo.connect();
      const Follows = mongo.collection('follows');
      await Follows.deleteOne({ follower_id: toObjectId(req.params.userId), followee_id: toObjectId(me) });
      return res.json({ success: true });
    } catch (e) { return res.status(500).json({ error: 'Failed to remove follower' }); }
  } else {
    db.run(`DELETE FROM follows WHERE follower_id = ? AND followee_id = ?`, [followerId, me], function (err) {
      if (err) return res.status(500).json({ error: 'Failed to remove follower' });
      res.json({ success: true });
    });
  }
});

// Create a post (image optional)
router.post('/posts', verifyToken, upload.single('image'), async (req, res) => {
  const userId = req.user.id;
  const text = (req.body && req.body.text) ? String(req.body.text).slice(0, 500) : '';
  try {
    let imageUrl = null;
    if (req.file) {
      if (useCloudinary) {
        try {
          imageUrl = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream({ folder: 'fitness-buddy/posts' }, (err, result) => {
              if (err) return reject(err);
              resolve(result.secure_url);
            });
            streamifier.createReadStream(req.file.buffer).pipe(stream);
          });
        } catch (e) {
          // Fallback to disk if Cloudinary fails
          const ext = path.extname(req.file.originalname || '') || '.bin';
          const name = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2) + ext.toLowerCase();
          const filePath = path.join(uploadsDir, name);
          fs.writeFileSync(filePath, req.file.buffer);
          imageUrl = '/uploads/' + name;
        }
      } else {
        imageUrl = '/uploads/' + path.basename(req.file.path);
      }
    }
    if (mongo.isEnabled()) {
      await mongo.connect();
      const Posts = mongo.collection('posts');
      const doc = { user_id: toObjectId(userId), image_path: imageUrl, text, created_at: new Date() };
      const ins = await Posts.insertOne(doc);
      return res.json({ id: ins.insertedId.toString(), user_id: userId, image_path: imageUrl, text });
    } else {
      db.run(`INSERT INTO posts (user_id, image_path, text) VALUES (?, ?, ?)`, [userId, imageUrl, text], function (err) {
        if (err) return res.status(500).json({ error: 'Failed to create post' });
        res.json({ id: this.lastID, user_id: userId, image_path: imageUrl, text });
      });
    }
  } catch (e) {
    res.status(500).json({ error: 'Post upload failed' });
  }
});

// Feed for current user: own posts + followed users
router.get('/feed', verifyToken, async (req, res) => {
  const userId = req.user.id;
  if (mongo.isEnabled()) {
    try {
      await mongo.connect();
      const Posts = mongo.collection('posts');
      const Users = mongo.collection('users');
      const Likes = mongo.collection('post_likes');
      const Follows = mongo.collection('follows');
      const followees = await Follows.find({ follower_id: toObjectId(userId) }).project({ followee_id: 1 }).toArray();
      const ids = [toObjectId(userId), ...followees.map(f => f.followee_id)];
      const posts = await Posts.find({ user_id: { $in: ids } }).sort({ created_at: -1 }).limit(200).toArray();
      const authorIds = [...new Set(posts.map(p => p.user_id.toString()))].map(toObjectId);
      const authors = await Users.find({ _id: { $in: authorIds } }).project({ name: 1, avatar_url: 1 }).toArray();
      const authorMap = new Map(authors.map(a => [a._id.toString(), a]));
      const postIds = posts.map(p => p._id);
      const likeAgg = await Likes.aggregate([
        { $match: { post_id: { $in: postIds } } },
        { $group: { _id: '$post_id', cnt: { $sum: 1 }, me: { $sum: { $cond: [{ $eq: ['$user_id', toObjectId(userId)] }, 1, 0] } } } }
      ]).toArray();
      const likeMap = new Map(likeAgg.map(l => [l._id.toString(), l]));
      const result = posts.map(p => {
        const a = authorMap.get(p.user_id.toString());
        const l = likeMap.get(p._id.toString());
        return {
          id: p._id.toString(),
          user_id: p.user_id.toString(),
          image_path: normalizeMediaPath(p.image_path),
          text: p.text,
          created_at: p.created_at,
          author_name: a?.name || 'User',
          author_avatar: normalizeMediaPath(a?.avatar_url || null),
          like_count: l?.cnt || 0,
          liked_by_me: (l?.me || 0) > 0,
        };
      });
      return res.json(result);
    } catch (e) { return res.status(500).json({ error: 'DB error' }); }
  } else {
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
      res.json(rows.map(r => ({
        ...r,
        image_path: normalizeMediaPath(r.image_path),
        author_avatar: normalizeMediaPath(r.author_avatar),
        liked_by_me: !!r.liked_by_me
      })));
    });
  }
});

router.post('/posts/:id/like', verifyToken, async (req, res) => {
  const userId = req.user.id;
  const postId = parseInt(req.params.id, 10);
  if (mongo.isEnabled()) {
    try {
      await mongo.connect();
      const Likes = mongo.collection('post_likes');
      await Likes.updateOne(
        { post_id: toObjectId(req.params.id), user_id: toObjectId(userId) },
        { $setOnInsert: { post_id: toObjectId(req.params.id), user_id: toObjectId(userId), created_at: new Date() } },
        { upsert: true }
      );
      return res.json({ success: true });
    } catch (e) { return res.status(500).json({ error: 'Failed to like' }); }
  } else {
    if (!postId) return res.status(400).json({ error: 'Invalid post id' });
    db.run(`INSERT OR IGNORE INTO post_likes (post_id, user_id) VALUES (?, ?)`, [postId, userId], function (err) {
      if (err) return res.status(500).json({ error: 'Failed to like' });
      res.json({ success: true });
    });
  }
});

router.post('/posts/:id/unlike', verifyToken, async (req, res) => {
  const userId = req.user.id;
  const postId = parseInt(req.params.id, 10);
  if (mongo.isEnabled()) {
    try {
      await mongo.connect();
      const Likes = mongo.collection('post_likes');
      await Likes.deleteOne({ post_id: toObjectId(req.params.id), user_id: toObjectId(userId) });
      return res.json({ success: true });
    } catch (e) { return res.status(500).json({ error: 'Failed to unlike' }); }
  } else {
    db.run(`DELETE FROM post_likes WHERE post_id = ? AND user_id = ?`, [postId, userId], function (err) {
      if (err) return res.status(500).json({ error: 'Failed to unlike' });
      res.json({ success: true });
    });
  }
});

// Followers list for current user
router.get('/me/followers', verifyToken, async (req, res) => {
  const userId = req.user.id;
  if (mongo.isEnabled()) {
    try {
      await mongo.connect();
      const Follows = mongo.collection('follows');
      const Users = mongo.collection('users');
      const followerLinks = await Follows.find({ followee_id: toObjectId(userId) }).project({ follower_id: 1 }).toArray();
      const ids = followerLinks.map(l => l.follower_id);
      const users = ids.length ? await Users.find({ _id: { $in: ids } }).project({ name: 1, avatar_url: 1 }).sort({ name: 1 }).toArray() : [];
      return res.json(users.map(u => ({ id: u._id.toString(), name: u.name || `User #${u._id.toString().slice(-4)}`, avatar_url: u.avatar_url })));
    } catch (e) { return res.status(500).json({ error: 'DB error' }); }
  } else {
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
  }
});

// Following list for current user
router.get('/me/following', verifyToken, async (req, res) => {
  const userId = req.user.id;
  if (mongo.isEnabled()) {
    try {
      await mongo.connect();
      const Follows = mongo.collection('follows');
      const Users = mongo.collection('users');
      const links = await Follows.find({ follower_id: toObjectId(userId) }).project({ followee_id: 1 }).toArray();
      const ids = links.map(l => l.followee_id);
      const users = ids.length ? await Users.find({ _id: { $in: ids } }).project({ name: 1, avatar_url: 1 }).sort({ name: 1 }).toArray() : [];
      return res.json(users.map(u => ({ id: u._id.toString(), name: u.name || `User #${u._id.toString().slice(-4)}`, avatar_url: u.avatar_url })));
    } catch (e) { return res.status(500).json({ error: 'DB error' }); }
  } else {
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
  }
});

// Compute simple streak: consecutive days with presence or food log, counting back from today
router.get('/me/streak', verifyToken, async (req, res) => {
  const userId = req.user.id;
  if (mongo.isEnabled()) {
    try {
      await mongo.connect();
      const Presence = mongo.collection('presence');
      const Food = mongo.collection('food_logs');
      const presenceDays = await Presence.aggregate([
        { $match: { user_id: toObjectId(userId), active: false } },
        { $project: { d: { $dateToString: { format: '%Y-%m-%d', date: '$checkout_at' } } } },
        { $group: { _id: '$d' } }
      ]).toArray();
      const foodDays = await Food.aggregate([
        { $match: { user_id: toObjectId(userId) } },
        { $project: { d: { $dateToString: { format: '%Y-%m-%d', date: '$date' } } } },
        { $group: { _id: '$d' } }
      ]).toArray();
      const days = new Set([...presenceDays, ...foodDays].map(r => r._id));
      let streak = 0;
      const today = new Date();
      for (let i = 0; i < 365; i++) {
        const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
        const key = d.toISOString().slice(0,10);
        if (days.has(key)) streak++; else break;
      }
      return res.json({ streak });
    } catch (e) { return res.status(500).json({ error: 'DB error' }); }
  } else {
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
  }
});

module.exports = router;

// Uploads status endpoint to verify Cloudinary configuration and disk fallback
router.get('/uploads/status', async (req, res) => {
  const status = { cloudinary: { enabled: useCloudinary, ok: false, error: null }, uploadsDir };
  if (useCloudinary) {
    try {
      // Admin ping requires proper CLOUDINARY_URL (api_key/secret)
      const result = await new Promise((resolve, reject) => {
        cloudinary.api.ping((err, res) => err ? reject(err) : resolve(res));
      });
      status.cloudinary.ok = !!result?.status;
    } catch (e) {
      status.cloudinary.error = e.message || String(e);
    }
  }
  try {
    // Verify disk path is writable
    const testFile = path.join(uploadsDir, '.healthcheck');
    fs.writeFileSync(testFile, String(Date.now()));
    fs.unlinkSync(testFile);
    status.diskWritable = true;
  } catch (_) {
    status.diskWritable = false;
  }
  res.json(status);
});
