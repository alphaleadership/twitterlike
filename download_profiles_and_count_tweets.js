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

    // Get all tweets from MongoDB
    const allTweets = await tweetService.getAllTweets(false); // Get all tweets, don't filter hidden
    
    // Use a Set to get unique account names
    const uniqueAccounts = new Set();
    allTweets.forEach(tweet => {
      uniqueAccounts.add(tweet.compte);
    });
    const allAccounts = Array.from(uniqueAccounts);

    console.log(`Found ${allAccounts.length} unique accounts from MongoDB.`);
    for (const account of allAccounts) {
      await fileUtils.downloadProfilePicture({account: account});
    }
    console.log("All profile pictures processed.");
  
    const totalTweets = allTweets.length;
    console.log(`Total number of tweets: ${totalTweets}`);
    const outputPath = path.join(__dirname, "total_tweets.txt");
    fs.writeFileSync(
      outputPath,
      `Total Tweets: ${totalTweets}
`
    );
    console.log(`Total tweets written to ${outputPath}`);
  } catch (error) {
    console.error("An error occurred:", error);
  }
  process.exit(0);
}
runProfileDownloadAndCount();
