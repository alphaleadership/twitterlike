
const fs = require('fs');
const path = require('path');

const tweetsFilePath = path.join(__dirname, 'tweet.json');

fs.readFile(tweetsFilePath, 'utf8', (err, data) => {
    if (err) {
        console.error('Error reading tweet.json:', err);
        return;
    }

    try {
        let tweets = JSON.parse(data);

        tweets.forEach(tweet => {
            if (tweet.media && Array.isArray(tweet.media)) {
                tweet.media.forEach(mediaItem => {
                    if (mediaItem.lien && mediaItem.lien.endsWith('.jpg')) {
                        mediaItem.lien=mediaItem.lien.replace("images//","images/")
                        mediaItem.type = 'photo';
                    }
                });
            }
        });

        fs.writeFile(tweetsFilePath, JSON.stringify(tweets, null, 2), 'utf8', (err) => {
            if (err) {
                console.error('Error writing tweet.json:', err);
            } else {
                console.log('Successfully updated media types in tweet.json');
            }
        });

    } catch (parseErr) {
        console.error('Error parsing tweet.json:', parseErr);
    }
});
