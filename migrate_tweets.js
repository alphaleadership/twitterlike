const { MongoClient, ServerApiVersion } = require('mongodb');
const fs = require('fs');
const { parser } = require('stream-json');
const { streamArray } = require('stream-json/streamers/StreamArray');
const { chain } = require('stream-chain');
require("dotenv").config();

async function migrateTweets() {
  const uri = process.env.MONGO_URI;
  console.log(ServerApiVersion);
  const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: false,
    deprecationErrors: false,
  },family: 4
});
console.log('Connecting to MongoDB...');
  try {
    await client.connect().catch(err => {
        console.error('Connection error:', err);
        
    });
    console.log('Connected to MongoDB.');
    await client.db("admin").command({ ping: 1 });
    const database = client.db('twitter_db');
    const tweetsCollection = database.collection('tweets');

    console.log('Clearing existing tweets...');
    await tweetsCollection.deleteMany({});
    console.log('Existing tweets cleared.');

    const filePath = 'tweets_with_local_media.json';
    if (!fs.existsSync(filePath)) {
        console.error(`File ${filePath} not found.`);
        return;
    }

    const pipeline = chain([
      fs.createReadStream(filePath),
      parser(),
      streamArray()
    ]);

    let buffer = [];
    const BATCH_SIZE = 100;
    let count = 0;

    console.log('Starting migration...');

    pipeline.on('data', async (data) => {
        const tweet = data.value;
        buffer.push(tweet);

        if (buffer.length >= BATCH_SIZE) {
            pipeline.pause(); // Pause reading while inserting
            try {
                await tweetsCollection.insertMany(buffer);
                count += buffer.length;
                console.log(`Inserted ${count} tweets...`);
                buffer = [];
            } catch (err) {
                console.error('Error inserting batch:', err);
            } finally {
                pipeline.resume();
            }
        }
    });

    pipeline.on('end', async () => {
        if (buffer.length > 0) {
            try {
                await tweetsCollection.insertMany(buffer);
                count += buffer.length;
                console.log(`Inserted remaining ${buffer.length} tweets.`);
            } catch (err) {
                console.error('Error inserting final batch:', err);
            }
        }
        console.log(`Migration completed. Total tweets: ${count}`);
        await client.close();
    });

    pipeline.on('error', (err) => {
        console.error('Stream error:', err);
        client.close();
    });

  } catch (e) {
    console.error('Error connecting to DB:', e);
    if (client) await client.close();
  }
}

migrateTweets();
