const tweetService = require("./src/services/tweetService");
const { connectToMongo, closeConnection } = require("./src/config/db");
const User = require("./src/models/User");
const fs = require("fs");
const path = require("path");

// Function to generate a random password
function generateRandomPassword(length = 12) {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*\"";
    let password = "";
    for (let i = 0, n = charset.length; i < length; ++i) {
        password += charset.charAt(Math.floor(Math.random() * n));
    }
    return password;
}

async function createLocalUsers() {
    let createdUsers = [];
    try {
        console.log("Connecting to database...");
        await connectToMongo();
        console.log("Database connected.");

        console.log("Getting unique accounts from tweets...");
        const allTweets = await tweetService.getAllTweets(false);
        const uniqueAccounts = new Set();
        allTweets.forEach(tweet => {
            uniqueAccounts.add(tweet.compte);
        });
        const allAccounts = Array.from(uniqueAccounts);
        console.log(`Found ${allAccounts.length} unique accounts.`);

        for (const account of allAccounts) {
            const existingUser = await User.findOne({ username: account });
            if (!existingUser) {
                const password = generateRandomPassword();
                const user = new User({ username: account, password: password });
                await user.save();
                console.log(`User ${account} created.`);
                createdUsers.push({ username: account, password: password });
            } else {
                console.log(`User ${account} already exists.`);
            }
        }

        if (createdUsers.length > 0) {
            const csvData = createdUsers.map(user => `${user.username},${user.password}`).join("\n");
            const outputPath = path.join(__dirname, "new_users.csv");
            fs.writeFileSync(outputPath, "username,password\n" + csvData);
            console.log(`Created user credentials saved to ${outputPath}`);
        }

    } catch (error) {
        console.error("An error occurred:", error);
    } finally {
        await closeConnection();
        process.exit(0);
    }
}

createLocalUsers();
