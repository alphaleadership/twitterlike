const { MongoClient } = require('mongodb');
const fs = require('fs');

async function migrateTweets() {
  const uri = 'mongodb+srv://thomasiniguez:YdHoz8PjNexzRyJW@cluster0.fzqc47r.mongodb.net/';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const database = client.db('twitter_db');
    const tweetsCollection = database.collection('tweets');

    const tweetsData = JSON.parse(fs.readFileSync('tweet.json', 'utf8'));

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