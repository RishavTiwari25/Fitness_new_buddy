const db = require('../db');
const mongo = require('../lib/mongo');

async function migrate() {
  console.log('Migrating approval status for existing users...');
  
  if (mongo.isEnabled()) {
    console.log('Migrating MongoDB users...');
    try {
      await mongo.connect();
      const Memberships = mongo.collection('memberships');
      // Create memberships for users who have a gym_id but no membership
      const Users = mongo.collection('users');
      const usersWithGym = await Users.find({ gym_id: { $exists: true, $ne: null } }).toArray();
      
      for (const u of usersWithGym) {
        // Upsert membership as approved
        await Memberships.updateOne(
          { user_id: u._id },
          { 
            $set: { gym_id: u.gym_id, status: 'approved' },
            $setOnInsert: { created_at: new Date() }
          },
          { upsert: true }
        );
      }
      console.log('MongoDB migration completed.');
    } catch (e) {
      console.error('Mongo migration failed:', e);
    }
  }

  console.log('Migrating SQLite users...');
  
  // Create memberships for any user with a gym_id that doesn't have one
  const sql = `
    INSERT INTO memberships (user_id, gym_id, status)
    SELECT id, gym_id, 'approved'
    FROM users 
    WHERE gym_id IS NOT NULL
      AND id NOT IN (SELECT user_id FROM memberships)
  `;
  
  db.run(sql, [], (err) => {
    if (err) {
      console.error('SQLite insert failed:', err);
    } else {
      console.log('SQLite missing memberships created.');
    }
    
    // Ensure all existing memberships are approved
    db.run(`UPDATE memberships SET status = 'approved' WHERE status IS NULL OR status != 'approved'`, [], (err2) => {
      if (err2) console.error('SQLite update failed:', err2);
      else console.log('SQLite update completed.');
      console.log('Migration finished successfully.');
      process.exit(0);
    });
  });
}

// Allow time for DB connection
setTimeout(migrate, 1000);
