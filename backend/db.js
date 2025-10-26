const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = process.env.DB_FILE
  ? path.resolve(process.cwd(), process.env.DB_FILE)
  : path.resolve(__dirname, 'db.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to open DB', err);
    process.exit(1);
  }
});

// Initialize schema
db.serialize(() => {
  // Enable foreign keys
  db.run(`PRAGMA foreign_keys = ON`);

  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT UNIQUE,
    password TEXT,
    role TEXT DEFAULT 'member',
    gym_id INTEGER
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS gyms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER,
    name TEXT,
    location TEXT,
    FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE SET NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS equipment (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gym_id INTEGER,
    name TEXT,
    notes TEXT,
    quantity INTEGER DEFAULT 1,
    FOREIGN KEY(gym_id) REFERENCES gyms(id) ON DELETE CASCADE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS presence (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gym_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    checkin_at TEXT DEFAULT (datetime('now')),
    checkout_at TEXT,
    active INTEGER DEFAULT 1,
    FOREIGN KEY(gym_id) REFERENCES gyms(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS equipment_booking (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    equipment_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    started_at TEXT DEFAULT (datetime('now')),
    ended_at TEXT,
    active INTEGER DEFAULT 1,
    FOREIGN KEY(equipment_id) REFERENCES equipment(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS food_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    items_text TEXT,
    items_json TEXT,
    calories REAL,
    protein REAL,
    carbs REAL,
    fat REAL,
    image_path TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  // Exercises for alternatives (Feature 8)
  db.run(`CREATE TABLE IF NOT EXISTS exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exercise_name TEXT NOT NULL,
    target_muscle TEXT,
    equipment_needed TEXT,
    instructions TEXT,
    media_url TEXT
  )`);

  // Advanced bookings (Feature 9) with time slots
  db.run(`CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    equipment_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    slot_time TEXT NOT NULL,
    booking_type TEXT CHECK(booking_type IN ('MAIN','ALTERNATE','WAITLIST')) NOT NULL,
    status TEXT CHECK(status IN ('ACTIVE','COMPLETED')) NOT NULL DEFAULT 'ACTIVE',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(equipment_id) REFERENCES equipment(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  // --- Social / Community (Feature 6) ---
  // Add optional columns to users table for expanded profiles
  const alterUserCols = [
    { name: 'avatar_url', sql: `ALTER TABLE users ADD COLUMN avatar_url TEXT` },
    { name: 'bio', sql: `ALTER TABLE users ADD COLUMN bio TEXT` },
    { name: 'allow_calorie_share', sql: `ALTER TABLE users ADD COLUMN allow_calorie_share INTEGER DEFAULT 0` },
  ];
  alterUserCols.forEach(col => {
    db.get(`PRAGMA table_info(users)`, (err, rows) => {
      if (err) return; // best-effort
      const exists = Array.isArray(rows) && rows.some(r => r.name === col.name);
      if (!exists) {
        db.run(col.sql, () => {}); // ignore errors if already added
      }
    });
  });

  // Follows relation
  db.run(`CREATE TABLE IF NOT EXISTS follows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    follower_id INTEGER NOT NULL,
    followee_id INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(follower_id, followee_id),
    FOREIGN KEY(follower_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(followee_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  // Posts for social feed
  db.run(`CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    image_path TEXT,
    text TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS post_likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(post_id, user_id),
    FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  // --- Engagement (Feature 7) ---
  // Add points column to users if missing
  db.get(`PRAGMA table_info(users)`, (err, rows) => {
    if (!err) {
      const hasPoints = Array.isArray(rows) && rows.some(r => r.name === 'points');
      if (!hasPoints) {
        db.run(`ALTER TABLE users ADD COLUMN points INTEGER DEFAULT 0`, () => {});
      }
    }
  });

  // Rewards available for redemption (per gym)
  db.run(`CREATE TABLE IF NOT EXISTS rewards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gym_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    cost_points INTEGER NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(gym_id) REFERENCES gyms(id) ON DELETE CASCADE
  )`);

  // Audit log for user points (earn/spend)
  db.run(`CREATE TABLE IF NOT EXISTS user_points_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    reason TEXT NOT NULL,
    points INTEGER NOT NULL,
    meta TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  // Reward redemptions
  db.run(`CREATE TABLE IF NOT EXISTS reward_redemptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    reward_id INTEGER NOT NULL,
    redeemed_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(reward_id) REFERENCES rewards(id) ON DELETE CASCADE
  )`);

  // --- Management (Feature 8) ---
  db.run(`CREATE TABLE IF NOT EXISTS memberships (
    user_id INTEGER PRIMARY KEY,
    gym_id INTEGER NOT NULL,
    monthly_fee REAL,
    next_due_date TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(gym_id) REFERENCES gyms(id) ON DELETE CASCADE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    gym_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    method TEXT,
    txn_ref TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(gym_id) REFERENCES gyms(id) ON DELETE CASCADE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT,
    message TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    read INTEGER DEFAULT 0,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS trainer_clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trainer_id INTEGER NOT NULL,
    member_id INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(trainer_id, member_id),
    FOREIGN KEY(trainer_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(member_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  // --- Management (Feature 8) ---
  // Optional trainer access flag on users
  db.get(`PRAGMA table_info(users)`, (err, rows) => {
    if (!err) {
      const hasTrainer = Array.isArray(rows) && rows.some(r => r.name === 'allow_trainer_access');
      if (!hasTrainer) db.run(`ALTER TABLE users ADD COLUMN allow_trainer_access INTEGER DEFAULT 0`, () => {});
    }
  });

  // Membership billing per user
  db.run(`CREATE TABLE IF NOT EXISTS member_billing (
    user_id INTEGER PRIMARY KEY,
    gym_id INTEGER NOT NULL,
    monthly_fee REAL NOT NULL,
    next_due_date TEXT,
    last_paid_at TEXT,
    status TEXT DEFAULT 'ACTIVE',
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(gym_id) REFERENCES gyms(id) ON DELETE CASCADE
  )`);

  // Payment records
  db.run(`CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    gym_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    method TEXT,
    provider TEXT,
    provider_order_id TEXT,
    status TEXT DEFAULT 'SUCCESS',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(gym_id) REFERENCES gyms(id) ON DELETE CASCADE
  )`);

  // Simple reminders/notifications
  db.run(`CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    message TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    read INTEGER DEFAULT 0,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  // Trainer-to-client links
  db.run(`CREATE TABLE IF NOT EXISTS trainer_clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trainer_id INTEGER NOT NULL,
    client_id INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(trainer_id, client_id),
    FOREIGN KEY(trainer_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(client_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
});

// Seed a demo gym and a few equipment items if the database is empty
// This helps first-time users (members) see a gym in the Member page without
// needing an owner account to create one.
try {
  db.get('SELECT COUNT(*) AS c FROM gyms', (err, row) => {
    if (!err && row && row.c === 0) {
      db.run('INSERT INTO gyms (owner_id, name, location) VALUES (NULL, ?, ?)', ['Demo Gym', 'Downtown'], function (e1) {
        if (e1) return; // best-effort seed
        const demoGymId = this.lastID;
        const stmt = db.prepare('INSERT INTO equipment (gym_id, name, notes, quantity) VALUES (?, ?, ?, ?)');
        stmt.run(demoGymId, 'Treadmill', 'Cardio machine', 4);
        stmt.run(demoGymId, 'Bench Press', 'Barbell bench', 2);
        stmt.run(demoGymId, 'Lat Pulldown', 'Back machine', 1);
        stmt.finalize();
      });
    }
  });
} catch (_) {
  // ignore seeding errors
}

module.exports = db;
