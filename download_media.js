
const fs = require('fs');
const path = require('path');
const https = require('https'); // Use https module
const { parser } = require('stream-json');
const { streamArray } = require('stream-json/streamers/StreamArray');
const { chain } = require('stream-chain');

const TWEET_INPUT_FILE_PATH = './tweet.json';
const TWEET_OUTPUT_FILE_PATH = './tweets_with_local_media.json';
const MEDIA_DIR = path.join(__dirname, 'src', 'public', 'images', 'tweet_media');

// Ensure the media directory exists
if (!fs.existsSync(MEDIA_DIR)) {
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
}

const downloadMedia = (mediaItem) => {
    return new Promise((resolve) => {
        if (!mediaItem || !mediaItem.lien || !mediaItem.lien.startsWith('http')) {
            return resolve();
        }

        const mediaUrl = mediaItem.lien;
        const fileName = path.basename(new URL(mediaUrl).pathname);
        const localPath = path.join(MEDIA_DIR, fileName);

        const fileStream = fs.createWriteStream(localPath);

        https.get(mediaUrl, (response) => {
            // Handle redirects
            if (response.statusCode > 300 && response.statusCode < 400 && response.headers.location) {
                console.log(`Redirecting from ${mediaUrl} to ${response.headers.location}`);
                mediaItem.lien = response.headers.location;
                downloadMedia(mediaItem).then(resolve);
                return;
            }

            if (response.statusCode !== 200) {
                console.error(`Failed to download ${mediaUrl}: Status Code ${response.statusCode}`);
                fs.unlink(localPath, () => {}); // Clean up the empty file
                return resolve(); // Don't reject, just move on
            }

            response.pipe(fileStream);

            fileStream.on('finish', () => {
                fileStream.close(() => {
                    mediaItem.lien = `/images/tweet_media/${fileName}`;
                    console.log(`Downloaded and updated to ${mediaItem.lien}`);
                    resolve();
                });
            });

        }).on('error', (err) => {
            console.error(`Error downloading media ${mediaUrl}:`, err.message);
            fs.unlink(localPath, () => {}); // Clean up
            resolve(); // Don't reject, just move on
        });
    });
};


const processTweets = async () => {
    console.log('Starting tweet processing...');

    const pipeline = chain([
        fs.createReadStream(TWEET_INPUT_FILE_PATH),
        parser(),
        streamArray()
    ]);

    const outputStream = fs.createWriteStream(TWEET_OUTPUT_FILE_PATH);
    outputStream.write('[');

    let first = true;

    pipeline.on('data', async ({ value: tweet }) => {
        pipeline.pause(); // Pause the stream to process the current tweet

        if (tweet.media && Array.isArray(tweet.media)) {
            for (const mediaItem of tweet.media) {
                await downloadMedia(mediaItem);
            }
        }

        if (!first) {
            outputStream.write(',');
        }
        outputStream.write(JSON.stringify(tweet, null, 2));
        first = false;

        pipeline.resume(); // Resume the stream for the next tweet
    });

    pipeline.on('end', () => {
        outputStream.write(']');
        outputStream.end();
        console.log('Finished processing tweets.');
        console.log(`Updated tweets saved to ${TWEET_OUTPUT_FILE_PATH}`);
    });

    pipeline.on('error', (err) => {
        console.error('Error processing stream:', err);
        // Clean up output file on error
        outputStream.end();
        fs.unlink(TWEET_OUTPUT_FILE_PATH, () => {});
    });
};

processTweets();
