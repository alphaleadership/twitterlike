require('dotenv').config();
const { MongoClient } = require('mongodb');
const { getSnowflakeDate, resolveTweetDate } = require('./src/utils/dateUtils');

async function patchDates() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('Erreur: MONGO_URI n\'est pas défini dans le fichier .env');
    process.exit(1);
  }

  console.log('Connexion à MongoDB...');
  const client = new MongoClient(uri);
  await client.connect();
  console.log('Connecté à MongoDB avec succès.');

  const db = client.db('twitter_db');
  const collection = db.collection('tweets');

  const totalTweets = await collection.countDocuments();
  console.log(`Analyse de ${totalTweets} tweets dans la collection "tweets"...`);

  const cursor = collection.find(
    {},
    { projection: { _id: 1, id: 1, date: 1, lien: 1 } }
  );

  let batch = [];
  const BATCH_SIZE = 1000;
  let countSnowflake = 0;
  let countNormalized = 0;
  let countAlreadyOk = 0;
  let totalProcessed = 0;

  const isIsoDate = (str) => typeof str === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(str);

  while (await cursor.hasNext()) {
    const tweet = await cursor.next();
    totalProcessed++;

    let targetDate = null;
    let fromSnowflake = false;

    if (!tweet.date || tweet.date === 'Invalid Date' || tweet.date === '') {
      const d = resolveTweetDate(tweet);
      targetDate = d.toISOString();
      fromSnowflake = true;
    } else if (!isIsoDate(tweet.date)) {
      const parsed = new Date(tweet.date);
      if (!isNaN(parsed.getTime())) {
        targetDate = parsed.toISOString();
      } else {
        const d = resolveTweetDate(tweet);
        targetDate = d.toISOString();
        fromSnowflake = true;
      }
    }

    if (targetDate && targetDate !== tweet.date) {
      if (fromSnowflake) {
        countSnowflake++;
      } else {
        countNormalized++;
      }

      batch.push({
        updateOne: {
          filter: { _id: tweet._id },
          update: { $set: { date: targetDate } }
        }
      });
    } else {
      countAlreadyOk++;
    }

    if (batch.length >= BATCH_SIZE) {
      await collection.bulkWrite(batch, { ordered: false });
      process.stdout.write(`\rMise à jour en cours : ${totalProcessed} / ${totalTweets} traités...`);
      batch = [];
    }
  }

  if (batch.length > 0) {
    await collection.bulkWrite(batch, { ordered: false });
    batch = [];
  }

  console.log(`\n\n--- Rapport du patch automatique des dates ---`);
  console.log(`Total de tweets analysés       : ${totalProcessed}`);
  console.log(`Dates manquantes restaurées   : ${countSnowflake} (via Twitter Snowflake)`);
  console.log(`Dates existantes normalisées  : ${countNormalized} (format ISO 8601)`);
  console.log(`Dates déjà conformes          : ${countAlreadyOk}`);

  console.log('\nCréation/vérification de l\'index sur { date: -1 }...');
  await collection.createIndex({ date: -1 });
  console.log('Index { date: -1 } vérifié avec succès.');

  await client.close();
  console.log('Terminé avec succès.');
}

if (require.main === module) {
  patchDates().catch((err) => {
    console.error('Erreur lors du patch des dates :', err);
    process.exit(1);
  });
}

module.exports = { patchDates };
