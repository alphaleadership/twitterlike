const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGO_URI;
const dbName = 'twitter_db';

let client;
let db;

async function connectToMongo() {
  if (!client) {
    client = new MongoClient(uri);
    try {
      await client.connect();
      db = client.db(dbName);
      console.log('Connected to MongoDB');
    } catch (e) {
      console.error('Failed to connect to MongoDB', e);
      process.exit(1);
    }
  }
  return { db, client };
}

function getDb() {
  if (!db) {
    throw new Error('Database not connected. Call connectToMongo first.');
  }
  return db;
}

async function closeConnection() {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

module.exports = {
  connectToMongo,
  getDb,
  closeConnection
};
