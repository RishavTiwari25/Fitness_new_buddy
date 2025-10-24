const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, '..', 'db.sqlite');
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Failed to open DB:', err.message);
    process.exit(1);
  }
});

db.serialize(() => {
  console.log('Users:');
  db.all('SELECT id, name, email, role, gym_id FROM users', [], (err, rows) => {
    if (err) console.error('Users query error', err);
    else console.log(rows);

    console.log('\nGyms:');
    db.all('SELECT * FROM gyms', [], (err2, gyms) => {
      if (err2) console.error('Gyms query error', err2);
      else console.log(gyms);

      console.log('\nEquipment:');
      db.all('SELECT * FROM equipment', [], (err3, eq) => {
        if (err3) console.error('Equipment query error', err3);
        else console.log(eq);

        db.close();
      });
    });
  });
});
