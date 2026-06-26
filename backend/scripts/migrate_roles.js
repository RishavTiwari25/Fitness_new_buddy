const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const dbPath = path.join(__dirname, '../', process.env.DB_FILE || 'db.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to database:', err);
    process.exit(1);
  }
  console.log('Connected to SQLite database at', dbPath);
});

db.serialize(() => {
  db.run(`UPDATE users SET role = 'manager' WHERE role IN ('owner', 'trainer')`, function(err) {
    if (err) {
      console.error('Migration failed:', err);
    } else {
      console.log(`Migration successful! Updated ${this.changes} users to 'manager'.`);
    }
    db.close();
  });
});
