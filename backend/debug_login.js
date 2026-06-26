require('dotenv').config();
const { MongoClient } = require('mongodb');

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.log("NO MONGODB_URI");
    return;
  }
  
  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log("Connected to MongoDB!");
    
    const db = client.db('fitness_buddy');
    const user = await db.collection('users').findOne({ email: 'btech10151.23@bitmesra.ac.in' });
    
    console.log("User:", user);
  } catch(e) {
    console.error("Error:", e);
  } finally {
    await client.close();
  }
}

main();
