const { MongoClient } = require('mongodb');
const mongoose = require('mongoose');
const sseService = require('../services/sseService');
require('dotenv').config();

const uri = process.env.MONGO_URI;
const dbName = 'twitter_db';

let client;
let db;
let reconnectTimer = null;
let isReconnecting = false;

async function connectToMongo() {
  if (!uri) {
    const error = new Error('MONGO_URI is not defined');
    scheduleReconnect();
    throw error;
  }

  if (!client) {
    client = new MongoClient(uri, { serverSelectionTimeoutMS: 3000 });
  }

  try {
    await client.connect();
    db = client.db(dbName);
    await mongoose.connect(uri, { dbName, serverSelectionTimeoutMS: 3000 });
    console.log('[MongoDB] Connecté avec succès');
    return { db, client };
  } catch (e) {
    db = null;
    try {
      if (client) {
        await client.close().catch(() => {});
        client = null;
      }
    } catch (_) {}
    scheduleReconnect();
    throw e;
  }
}

function scheduleReconnect(delay = 5000) {
  if (reconnectTimer || isReconnecting) return;
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    if (!uri) return;
    isReconnecting = true;
    let connected = false;
    try {
      console.log(`[MongoDB] [${new Date().toISOString()}] Tentative de reconnexion en arrière-plan...`);
      sseService.notifyDbStatus('reconnecting', { attemptTime: new Date().toISOString() });
      const newClient = new MongoClient(uri, { serverSelectionTimeoutMS: 3000 });
      await newClient.connect();
      client = newClient;
      db = client.db(dbName);
      if (mongoose.connection.readyState !== 1) {
        await mongoose.connect(uri, { dbName, serverSelectionTimeoutMS: 3000 });
      }
      console.log(`[MongoDB] [${new Date().toISOString()}] Reconnecté avec succès ! Mode CDN désactivé.`);
      sseService.notifyDbStatus('connected', { cdnMode: false });
      connected = true;
    } catch (err) {
      console.warn(`[MongoDB] [${new Date().toISOString()}] Échec reconnexion : ${err.message}`);
      sseService.notifyDbStatus('reconnect_failed', { error: err.message, retryInMs: delay });
    } finally {
      isReconnecting = false;
    }

    if (!connected) {
      scheduleReconnect(delay);
    }
  }, delay);
}

function getDb() {
  if (!db) {
    throw new Error('Database not connected. Call connectToMongo first.');
  }
  return db;
}

function getClient() {
  return client;
}

function isMongoConnected() {
  return Boolean(db && mongoose.connection.readyState === 1);
}

async function closeConnection() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (client) {
    await client.close().catch(() => {});
    client = null;
    db = null;
  }
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect().catch(() => {});
  }
}

module.exports = {
  connectToMongo,
  getDb,
  getClient,
  isMongoConnected,
  closeConnection,
  mongoose
};

