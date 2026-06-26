const path = require('path');
const dotenv = require('dotenv');
const { MongoClient } = require('mongodb');

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.log('No MONGODB_URI found, skipping MongoDB migration.');
  process.exit(0);
}

const client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });

async function run() {
  try {
    await client.connect();
    const db = client.db();
    const Users = db.collection('users');
    
    const result = await Users.updateMany(
      { role: { $in: ['owner', 'trainer'] } },
      { $set: { role: 'manager' } }
    );
    
    console.log(`MongoDB Migration successful! Updated ${result.modifiedCount} users to 'manager'.`);
  } catch (e) {
    console.error('MongoDB Migration failed:', e);
  } finally {
    await client.close();
  }
}

run();
