
const fs = require('fs');
const path = require('path');
const https = require('https'); // Use https module
const os = require('os');
const sqlite3 = require('sqlite3').verbose();
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

// Fonction pour récupérer les cookies du dernier profil Firefox utilisé
const getFirefoxCookies = () => {
    return new Promise((resolve) => {
        try {
            const profilesDir = path.join(os.homedir(), 'AppData', 'Roaming', 'Mozilla', 'Firefox', 'Profiles');
            if (!fs.existsSync(profilesDir)) {
                return resolve('');
            }

            const profiles = fs.readdirSync(profilesDir);
            let latestDb = null;
            let latestTime = 0;

            for (const profile of profiles) {
                const dbPath = path.join(profilesDir, profile, 'cookies.sqlite');
                if (fs.existsSync(dbPath)) {
                    const stat = fs.statSync(dbPath);
                    if (stat.mtimeMs > latestTime) {
                        latestTime = stat.mtimeMs;
                        latestDb = dbPath;
                    }
                }
            }

            if (!latestDb) {
                return resolve('');
            }

            // Copie temporaire du fichier SQLite pour éviter tout verrouillage par Firefox
            const tempDbPath = path.join(os.tmpdir(), `firefox_cookies_${Date.now()}.sqlite`);
            fs.copyFileSync(latestDb, tempDbPath);

            const db = new sqlite3.Database(tempDbPath, sqlite3.OPEN_READONLY, (err) => {
                if (err) {
                    fs.unlink(tempDbPath, () => {});
                    return resolve('');
                }
            });

            db.all('SELECT host, name, value FROM moz_cookies', [], (err, rows) => {
                db.close();
                fs.unlink(tempDbPath, () => {});

                if (err || !rows) {
                    return resolve({});
                }

                // Organiser les cookies par domaine
                const cookiesByHost = {};
                for (const row of rows) {
                    const hostKey = row.host.startsWith('.') ? row.host.substring(1) : row.host;
                    if (!cookiesByHost[hostKey]) {
                        cookiesByHost[hostKey] = [];
                    }
                    cookiesByHost[hostKey].push(`${row.name}=${row.value}`);
                }

                resolve(cookiesByHost);
            });
        } catch (error) {
            console.warn('Impossible de lire les cookies Firefox :', error.message);
            resolve({});
        }
    });
};

const getCookieHeaderForUrl = (targetUrl, cookiesByHost) => {
    if (!cookiesByHost || typeof cookiesByHost !== 'object') return '';
    try {
        const hostname = new URL(targetUrl).hostname;
        const matchingCookies = [];

        // Domaines associés (Twitter/X CDN et domaines principaux)
        const isTwimg = hostname.endsWith('twimg.com');

        for (const [domain, cookies] of Object.entries(cookiesByHost)) {
            if (
                hostname === domain || 
                hostname.endsWith('.' + domain) ||
                (isTwimg && (domain.includes('twitter.com') || domain.includes('x.com')))
            ) {
                matchingCookies.push(...cookies);
            }
        }

        return matchingCookies.join('; ');
    } catch {
        return '';
    }
};

const downloadMedia = (mediaItem, cookiesByHost) => {
    return new Promise((resolve) => {
        if (!mediaItem || !mediaItem.lien || !mediaItem.lien.startsWith('https')) {
           // return resolve();
        }

        const mediaUrl = mediaItem.media_object.media_url;
        const fileName = path.basename(new URL(mediaUrl).pathname);
        const localPath = path.join(MEDIA_DIR, fileName);

        // Vérifier si le fichier existe déjà
        if (fs.existsSync(localPath)) {
            console.log(`File already exists: ${fileName}, skipping download`);
            mediaItem.locallien = `http://localhost:3002/public/images/tweet_media/${fileName}`;
            return resolve();
        }

        const fileStream = fs.createWriteStream(localPath);
        const cookieHeader = getCookieHeaderForUrl(mediaUrl, cookiesByHost);

        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
                ...(cookieHeader ? { 'Cookie': cookieHeader } : {})
            }
        };

        https.get(mediaUrl, options, (response) => {
            // Handle redirects
            if (response.statusCode > 300 && response.statusCode < 400 && response.headers.location) {
                console.log(`Redirecting from ${mediaUrl} to ${response.headers.location}`);
                mediaItem.lien = response.headers.location;
                downloadMedia(mediaItem, cookiesByHost).then(resolve);
                return;
            }

            if (response.statusCode !== 200) {
                if(response.statusCode !== 404){
                    console.error(`Failed to download ${mediaUrl}: Status Code ${response.statusCode}`);
                }
                
                fs.unlink(localPath, () => {}); // Clean up the empty file
                return resolve(); // Don't reject, just move on
            }

            response.pipe(fileStream);

            fileStream.on('finish', () => {
                fileStream.close(() => {
                    mediaItem.locallien = `http://localhost:3002/public/images/tweet_media/${fileName}`;
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
    console.log('Chargement des cookies de la dernière session Firefox...');
    const cookiesByHost = await getFirefoxCookies();
    const domainCount = Object.keys(cookiesByHost).length;
    console.log(`Cookies Firefox chargés pour ${domainCount} domaines.`);

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
        if(tweet._id){
            delete tweet._id
        }
        if (tweet.media && Array.isArray(tweet.media)) {
            for (const mediaItem of tweet.media) {
                await downloadMedia(mediaItem, cookiesByHost);
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

