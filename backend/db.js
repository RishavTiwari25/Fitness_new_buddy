/**
 * =============================================
 * SQLite DATABASE INITIALIZATION (db.js)
 * =============================================
 * Sets up the SQLite database with all required tables
 * and initial schema. Acts as the primary database
 * when MongoDB is not configured.
 */

// Import SQLite driver
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// ===== DATABASE FILE CONFIGURATION =====
// Determine the database file location:
// - If DB_FILE env var is set, use that path
// - Otherwise, use db.sqlite in the backend directory
const dbPath = process.env.DB_FILE
  ? path.resolve(process.cwd(), process.env.DB_FILE)
  : path.resolve(__dirname, 'db.sqlite');

// ===== DATABASE CONNECTION =====
// Open/create the SQLite database file
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    // If database cannot be opened, log error and exit
    console.error('Failed to open DB', err);
    process.exit(1);
  }
});

// ===== DATABASE SCHEMA INITIALIZATION =====
// All tables are created inside this serialize block to ensure they're created in order
db.serialize(() => {
  // Enable foreign key constraints for data integrity
  db.run(`PRAGMA foreign_keys = ON`);

  // ===== CORE TABLES =====
  
  // USERS TABLE: Stores user account information
  // Roles: 'member' (regular user), 'trainer' (fitness coach), 'owner' (gym owner)
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT UNIQUE,
    password TEXT,
    role TEXT DEFAULT 'member',
    gym_id INTEGER
  )`);

  // GYMS TABLE: Stores gym/facility information
  // Each gym has an owner (typically a user with 'owner' role)
  db.run(`CREATE TABLE IF NOT EXISTS gyms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER,
    name TEXT,
    location TEXT,
    description TEXT,
    timings TEXT,
    contact_info TEXT,
    amenities TEXT,
    FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE SET NULL
  )`);

  // EQUIPMENT TABLE: Stores equipment available in each gym
  // quantity: Number of this equipment item available in the gym
  db.run(`CREATE TABLE IF NOT EXISTS equipment (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gym_id INTEGER,
    name TEXT,
    notes TEXT,
    quantity INTEGER DEFAULT 1,
    FOREIGN KEY(gym_id) REFERENCES gyms(id) ON DELETE CASCADE
  )`);

  // PRESENCE TABLE: Tracks gym check-in and check-out times
  // Used for attendance tracking and gym analytics
  db.run(`CREATE TABLE IF NOT EXISTS presence (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gym_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    checkin_at TEXT DEFAULT (datetime('now')), -- Auto-set to current time when checked in
    checkout_at TEXT,
    active INTEGER DEFAULT 1,
    FOREIGN KEY(gym_id) REFERENCES gyms(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  // EQUIPMENT_BOOKING TABLE: Tracks real-time equipment usage
  // When a user starts using equipment, an entry is created with active=1
  // When they finish, checkout time is recorded and active becomes 0
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

  // FOOD_LOGS TABLE: Stores daily dietary intake records
  // Users can log meals with nutrition information
  // items_text: Text representation of food items
  // items_json: Structured JSON data for food items
  // calories, protein, carbs, fat: Calculated nutritional values
  // image_path: Optional photo of the meal for reference
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

  // EXERCISES TABLE: Master list of exercises with alternatives
  // Used to provide exercise recommendations and form guidance
  db.run(`CREATE TABLE IF NOT EXISTS exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exercise_name TEXT NOT NULL,
    target_muscle TEXT,
    equipment_needed TEXT,
    instructions TEXT,
    media_url TEXT
  )`);

  // BOOKINGS TABLE: Advanced booking system with time slots
  // Users can book equipment for specific time slots with main, alternate, or waitlist options
  // booking_type: 'MAIN' (primary slot), 'ALTERNATE' (backup option), 'WAITLIST' (waiting for slot)
  // status: 'ACTIVE' (current booking) or 'COMPLETED' (finished)
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

  // ===== SOCIAL FEATURES TABLES =====
  
  // Add optional profile columns to users table for social networking
  // avatar_url: User's profile picture
  // bio: User's about/description text
  // allow_calorie_share: Permission flag for sharing diet data with followers
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

  // FOLLOWS TABLE: Stores follower/following relationships
  // Users can follow each other to see updates
  db.run(`CREATE TABLE IF NOT EXISTS follows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    follower_id INTEGER NOT NULL,
    followee_id INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(follower_id, followee_id), -- Prevent duplicate follows
    FOREIGN KEY(follower_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(followee_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  // POSTS TABLE: Stores user social media posts (fitness updates, achievements, etc.)
  // image_path: Optional photo attachment for the post
  // text: Text content of the post
  db.run(`CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    image_path TEXT,
    text TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  // POST_LIKES TABLE: Tracks which users have liked which posts
  db.run(`CREATE TABLE IF NOT EXISTS post_likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(post_id, user_id), -- Prevent duplicate likes from same user
    FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  // ===== ENGAGEMENT & REWARDS SYSTEM =====
  
  // Add points column to users table for tracking engagement points
  // Points are earned through activities like gym visits, completing workouts, etc.
  db.get(`PRAGMA table_info(users)`, (err, rows) => {
    if (!err) {
      const checkGymsColumns = () => {
        db.all("PRAGMA table_info(gyms)", (err, columns) => {
          if (!err && columns) {
            const colNames = columns.map(c => c.name);
            if (!colNames.includes('description')) {
              db.run('ALTER TABLE gyms ADD COLUMN description TEXT', (err) => { if (err) console.error(err) });
            }
            if (!colNames.includes('timings')) {
              db.run('ALTER TABLE gyms ADD COLUMN timings TEXT', (err) => { if (err) console.error(err) });
            }
            if (!colNames.includes('contact_info')) {
              db.run('ALTER TABLE gyms ADD COLUMN contact_info TEXT', (err) => { if (err) console.error(err) });
            }
            if (!colNames.includes('amenities')) {
              db.run('ALTER TABLE gyms ADD COLUMN amenities TEXT', (err) => { if (err) console.error(err) });
            }
          }
        });
      };
      checkGymsColumns();
      const hasPoints = Array.isArray(rows) && rows.some(r => r.name === 'points');
      if (!hasPoints) {
        db.run(`ALTER TABLE users ADD COLUMN points INTEGER DEFAULT 0`, () => {});
      }
    }
  });

  // REWARDS TABLE: Available rewards that users can redeem with their points
  // Each gym can offer different rewards to its members
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

  // USER_POINTS_LOG TABLE: Audit trail of all points earned/spent by users
  // Tracks the history of user engagement points for transparency
  db.run(`CREATE TABLE IF NOT EXISTS user_points_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    reason TEXT NOT NULL, -- Why points were added/removed
    points INTEGER NOT NULL, -- Positive for earning, negative for spending
    meta TEXT, -- Additional metadata about the transaction
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  // REWARD_REDEMPTIONS TABLE: Records when users redeem rewards with their points
  db.run(`CREATE TABLE IF NOT EXISTS reward_redemptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    reward_id INTEGER NOT NULL,
    redeemed_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(reward_id) REFERENCES rewards(id) ON DELETE CASCADE
  )`);

  // ===== MEMBERSHIP & PAYMENT SYSTEM =====
  
  // MEMBERSHIPS TABLE: Associates users with gyms and tracks fees
  db.run(`CREATE TABLE IF NOT EXISTS memberships (
    user_id INTEGER PRIMARY KEY,
    gym_id INTEGER NOT NULL,
    status TEXT DEFAULT 'approved', -- 'pending' or 'approved'
    monthly_fee REAL,
    next_due_date TEXT, -- When the next payment is due
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(gym_id) REFERENCES gyms(id) ON DELETE CASCADE
  )`);

  // Ensure status column exists in existing deployments
  db.get(`PRAGMA table_info(memberships)`, (err, rows) => {
    if (!err && Array.isArray(rows)) {
      if (!rows.some(r => r.name === 'status')) {
        db.run(`ALTER TABLE memberships ADD COLUMN status TEXT DEFAULT 'approved'`, () => {});
      }
    }
  });

  // PAYMENTS TABLE: Records all payment transactions
  // Tracks membership fees, reward redemptions, etc.
  db.run(`CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    gym_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    method TEXT, -- Payment method (e.g., 'card', 'UPI', etc.)
    txn_ref TEXT, -- Transaction reference ID
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(gym_id) REFERENCES gyms(id) ON DELETE CASCADE
  )`);

  // NOTIFICATIONS TABLE: Stores notifications for users
  // Notifies users about gym updates, booking confirmations, payment reminders, etc.
  db.run(`CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT,
    message TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    read INTEGER DEFAULT 0, -- 1 = read, 0 = unread
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  // TRAINER_CLIENTS TABLE: Associates trainers with their client members
  // Allows trainers to manage and track their assigned clients
  db.run(`CREATE TABLE IF NOT EXISTS trainer_clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trainer_id INTEGER NOT NULL,
    member_id INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(trainer_id, member_id), -- Prevent duplicate trainer-client relationships
    FOREIGN KEY(trainer_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(member_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  // --- Management (Feature 8) ---
  // Add optional trainer access flag on users
  // This allows members to grant permission for trainers to view their data
  db.get(`PRAGMA table_info(users)`, (err, rows) => {
    if (!err) {
      const hasTrainer = Array.isArray(rows) && rows.some(r => r.name === 'allow_trainer_access');
      if (!hasTrainer) db.run(`ALTER TABLE users ADD COLUMN allow_trainer_access INTEGER DEFAULT 0`, () => {});
    }
  });

  // MEMBER_BILLING TABLE: Tracks billing information for gym members
  // Separate from memberships table for more detailed billing management
  db.run(`CREATE TABLE IF NOT EXISTS member_billing (
    user_id INTEGER PRIMARY KEY,
    gym_id INTEGER NOT NULL,
    monthly_fee REAL NOT NULL,
    next_due_date TEXT,
    last_paid_at TEXT, -- Last successful payment date
    status TEXT DEFAULT 'ACTIVE', -- ACTIVE, SUSPENDED, CANCELLED
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(gym_id) REFERENCES gyms(id) ON DELETE CASCADE
  )`);

  // REMINDERS TABLE: Simple reminders/notifications for users
  // Can be used for payment reminders, appointment reminders, etc.
  db.run(`CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    message TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    read INTEGER DEFAULT 0,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

});

// ===== DEMO DATA SEEDING =====
// Seed a demo gym and equipment if the database is empty
// This helps first-time users see content without creating a gym first
try {
  db.get('SELECT COUNT(*) AS c FROM gyms', (err, row) => {
    if (!err && row && row.c === 0) {
      // Insert a demo gym if no gyms exist
      db.run('INSERT INTO gyms (owner_id, name, location) VALUES (NULL, ?, ?)', ['Demo Gym', 'Downtown'], function (e1) {
        if (e1) return; // best-effort seed - don't fail if demo gym already exists
        const demoGymId = this.lastID;
        // Insert sample equipment for the demo gym
        const stmt = db.prepare('INSERT INTO equipment (gym_id, name, notes, quantity) VALUES (?, ?, ?, ?)');
        stmt.run(demoGymId, 'Treadmill', 'Cardio machine', 4); // 4 treadmills available
        stmt.run(demoGymId, 'Bench Press', 'Barbell bench', 2); // 2 bench press stations
        stmt.run(demoGymId, 'Lat Pulldown', 'Back machine', 1); // 1 lat pulldown machine
        stmt.finalize();
      });
    }
  });
} catch (_) {
  // Ignore seeding errors - DB might already have data
}

// ===== EXPORT DATABASE CONNECTION =====
// Export the database connection for use in route handlers
module.exports = db;
