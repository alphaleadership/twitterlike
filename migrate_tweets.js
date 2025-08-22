const { MongoClient } = require('mongodb');
const fs = require('fs');
require("dotenv").config();
async function migrateTweets() {
  const uri = process.env.MONGO_URI;
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const database = client.db('twitter_db');
    const tweetsCollection = database.collection('tweets');

    const tweetsData = JSON.parse(fs.readFileSync('tweets_with_local_media.json', 'utf8'));

    // Clear existing data before inserting new data (optional, but good for migration scripts)
    await tweetsCollection.deleteMany({});
    console.log('Existing tweets cleared from MongoDB.');

    await tweetsCollection.insertMany(tweetsData);
    console.log('Tweets migrated successfully to MongoDB.');
  } catch (e) {
    console.error('Error migrating tweets:', e);
  } finally {
    await client.close();
  }
}

migrateTweets();