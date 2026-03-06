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

        console.log("Getting unique accounts from tweets via aggregation...");
        
        const collection = await tweetService.getCollection();
        const accountsCursor = collection.aggregate([
            { $group: { _id: "$compte" } }
        ]);
        
        let count = 0;
        let createdCount = 0;

        const outputPath = path.join(__dirname, "new_users.csv");
        // Initialize CSV file
        fs.writeFileSync(outputPath, "username,password\n");

        for await (const doc of accountsCursor) {
            const account = doc._id;
            if (!account) continue;

            const existingUser = await User.findOne({ username: account });
            if (!existingUser) {
                const password = generateRandomPassword();
                const user = new User({ username: account, password: password });
                await user.save();
                
                // Append directly to file to avoid memory bloat
                fs.appendFileSync(outputPath, `${account},${password}\n`);
                createdCount++;
            } 
            
            count++;
            if (count % 100 === 0) process.stdout.write(`\rChecked ${count} accounts...`);
        }
        
        console.log(`\nProcess completed.`);
        console.log(`Checked ${count} accounts.`);
        console.log(`Created ${createdCount} new users.`);
        console.log(`Credentials saved to ${outputPath}`);

    } catch (error) {
        console.error("An error occurred:", error);
    } finally {
        await closeConnection();
        process.exit(0);
    }
}

createLocalUsers();