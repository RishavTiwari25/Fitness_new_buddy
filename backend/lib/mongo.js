/**
 * =============================================
 * MONGODB CONNECTION & UTILITIES (mongo.js)
 * =============================================
 * Handles MongoDB connection management
 * Provides helper functions to interact with MongoDB
 * Falls back to SQLite if MongoDB is not configured
 */

// Import MongoDB driver components
const { MongoClient, ObjectId } = require('mongodb');

// ===== MODULE-LEVEL VARIABLES =====
// These maintain state across function calls
let client; // MongoDB client instance
let db; // MongoDB database instance

// ===== MONGODB STATUS CHECK =====
// Returns true if MongoDB is configured via environment variable
function isEnabled() {
  return !!process.env.MONGODB_URI;
}

// ===== MONGODB CONNECTION FUNCTION =====
// Establishes connection to MongoDB if not already connected
// Returns the database instance for querying
async function connect() {
  if (!isEnabled()) return null; // Skip if MongoDB is not configured
  if (db) return db; // Return existing connection if already connected
  
  // Get MongoDB connection URI from environment
  const uri = process.env.MONGODB_URI;
  
  // Configure connection options
  const clientOptions = {
    // Timeouts to prevent long hangs if MongoDB is unreachable
    connectTimeoutMS: 10000, // 10 second timeout for initial connection
    serverSelectionTimeoutMS: 10000, // 10 second timeout for server selection
    // TLS is handled automatically based on the URI
  };
  
  // Create and connect MongoDB client
  client = new MongoClient(uri, clientOptions);
  await client.connect();
  
  // Get database name from URI or use default 'fitness_buddy'
  const dbName = (client.options?.dbName) || 'fitness_buddy';
  db = client.db(dbName);
  
  return db;
}

// ===== GET DATABASE INSTANCE =====
// Returns the connected MongoDB database instance
// Throws error if connect() hasn't been called first
function getDb() {
  if (!db) throw new Error('MongoDB not connected. Call connect() first.');
  return db;
}

// ===== GET COLLECTION =====
// Shorthand to get a specific collection from the database
// Example: collection('users') returns the users collection
function collection(name) {
  return getDb().collection(name);
}

// ===== HEALTH CHECK =====
// Checks if MongoDB is enabled and connected
// Returns status object with connectivity information
async function health() {
  if (!isEnabled()) return { enabled: false, connected: false }; // MongoDB not configured
  try {
    await connect(); // Try to connect if not already connected
    await db.command({ ping: 1 }); // Send ping command to verify connection
    return { enabled: true, connected: true };
  } catch (e) {
    // Connection failed
    return { enabled: true, connected: false, error: e.message };
  }
}

// ===== HELPER FUNCTION: CONVERT TO OBJECTID =====
// Converts a string ID to MongoDB ObjectId
// Used for querying documents by _id
function toObjectId(id) {
  if (id instanceof ObjectId) return id; // Already an ObjectId
  try { 
    return new ObjectId(String(id)); // Convert string to ObjectId
  } catch (_) { 
    return null; // Invalid ID format
  }
}

// ===== EXPORTS =====
// Export all public functions and utilities
module.exports = { isEnabled, connect, getDb, collection, health };
module.exports.toObjectId = toObjectId;
module.exports.ObjectId = ObjectId;
