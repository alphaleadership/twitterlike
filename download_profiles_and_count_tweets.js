const tweetService = require("./src/services/tweetService");
const fileUtils = require("./src/utils/fileUtils");
const { connectToMongo } = require("./src/config/db");
const fs = require("fs");
const path = require("path");

async function runProfileDownloadAndCount() {
  try {
    console.log("Connecting to database...");
    await connectToMongo();
    console.log("Database connected.");

    console.log("Starting profile picture download and tweet count...");

    const collection = await tweetService.getCollection();

    // Use aggregation to get unique accounts without loading all tweets
    console.log("Fetching unique accounts...");
    const accountsCursor = collection.aggregate([
      { $group: { _id: "$compte" } }
    ]);

    let processedCount = 0;
    for await (const doc of accountsCursor) {
        const account = doc._id;
        if (account) {
            await fileUtils.downloadProfilePicture({account: account});
            processedCount++;
            if (processedCount % 100 === 0) {
                console.log(`Processed ${processedCount} accounts...`);
            }
        }
    }

    console.log(`All profile pictures processed. Total accounts: ${processedCount}`);
  
    const totalTweets = await collection.countDocuments({});
    console.log(`Total number of tweets: ${totalTweets}`);
    const outputPath = path.join(__dirname, "total_tweets.txt");
    fs.writeFileSync(
      outputPath,
      `Total Tweets: ${totalTweets}\n`
    );
    console.log(`Total tweets written to ${outputPath}`);
  } catch (error) {
    console.error("An error occurred:", error);
  }
  process.exit(0);
}
runProfileDownloadAndCount();