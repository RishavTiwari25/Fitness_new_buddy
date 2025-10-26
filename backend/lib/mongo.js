const { MongoClient } = require('mongodb');

let client;
let db;

function isEnabled() {
  return !!process.env.MONGODB_URI;
}

async function connect() {
  if (!isEnabled()) return null;
  if (db) return db;
  const uri = process.env.MONGODB_URI;
  const clientOptions = {
    // Default timeouts to avoid long hangs
    connectTimeoutMS: 10000,
    serverSelectionTimeoutMS: 10000,
    // Let the driver pick TLS from the URI
  };
  client = new MongoClient(uri, clientOptions);
  await client.connect();
  // Database name can be embedded in URI; the driver will choose it via client.db()
  // If none present, fallback to 'fitness_buddy'
  const dbName = (client.options?.dbName) || 'fitness_buddy';
  db = client.db(dbName);
  return db;
}

function getDb() {
  if (!db) throw new Error('MongoDB not connected. Call connect() first.');
  return db;
}

function collection(name) {
  return getDb().collection(name);
}

async function health() {
  if (!isEnabled()) return { enabled: false, connected: false };
  try {
    await connect();
    await db.command({ ping: 1 });
    return { enabled: true, connected: true };
  } catch (e) {
    return { enabled: true, connected: false, error: e.message };
  }
}

module.exports = { isEnabled, connect, getDb, collection, health };
