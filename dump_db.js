const { connectToMongo, closeConnection, getDb } = require('./src/config/db');
const Admin = require('./src/models/Admin');
const Like = require('./src/models/Like');
const User = require('./src/models/User');
const fs = require('fs');
const path = require('path');

const DUMP_DIR = 'dumps';

async function dumpDatabase() {
  try {
    if (!fs.existsSync(DUMP_DIR)) {
      fs.mkdirSync(DUMP_DIR);
    }

    await connectToMongo();
    const db = getDb();

    const collections = {
      admins: Admin.find({}).lean(),
      likes: Like.find({}).lean(),
      users: User.find({}).lean(),
      tweets: db.collection('tweets').find({}).toArray(),
    };

    for (const [name, data] of Object.entries(collections)) {
      const dumpFile = path.join(DUMP_DIR, `${name}.json`);
      fs.writeFileSync(dumpFile, JSON.stringify(await data, null, 2));
      console.log(`Collection '${name}' dumped to ${dumpFile}`);
    }

  } catch (error) {
    console.error('Error dumping database:', error);
  } finally {
    await closeConnection();
  }
}

dumpDatabase();