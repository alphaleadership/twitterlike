
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

const resolveVideoUrlWithFxTwitter = (expandedUrl) => {
    return new Promise((resolve) => {
        if (!expandedUrl) return resolve(null);
        try {
            const urlObj = new URL(expandedUrl);
            const pathParts = urlObj.pathname.split('/').filter(Boolean);
            const statusIndex = pathParts.indexOf('status');
            if (statusIndex === -1 || !pathParts[statusIndex + 1]) {
                console.error(`[Erreur Format URL] URL vidéo invalide : ${expandedUrl}`);
                return resolve(null);
            }

            const user = pathParts[0];
            const tweetId = pathParts[statusIndex + 1];
            const apiUrl = `https://api.fxtwitter.com/status/${tweetId}`;

            const options = {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'application/json'
                }
            };

            https.get(apiUrl, options, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    if (res.statusCode !== 200) {
                        console.error(`[Échec API FxTwitter HTTP ${res.statusCode}] ${apiUrl}`);
                        return resolve(null);
                    }
                    try {
                        const data = JSON.parse(body);
                        if (data && data.code && data.code !== 200) {
                            console.error(`[Échec API FxTwitter Code ${data.code}] ${data.message || 'Erreur API'}`);
                            return resolve(null);
                        }
                        if (data && data.tweet && data.tweet.media && data.tweet.media.videos && data.tweet.media.videos.length > 0) {
                            const video = data.tweet.media.videos[0];
                            if (video.url) return resolve(video.url);
                        }
                        console.error(`[Échec MP4] Aucune vidéo/variant MP4 trouvée dans la réponse API pour ${apiUrl}`);
                        resolve(null);
                    } catch (e) {
                        console.error(`[Erreur Parsing JSON API] ${apiUrl} : ${e.message}`);
                        resolve(null);
                    }
                });
            }).on('error', (err) => {
                console.error(`[Erreur Réseau API] ${apiUrl} : ${err.message}`);
                resolve(null);
            });
        } catch (e) {
            console.error(`[Erreur Traitement MP4] ${expandedUrl} : ${e.message}`);
            resolve(null);
        }
    });
};

const downloadFileFromUrl = (targetUrl, localPath, cookiesByHost) => {
    return new Promise((resolve) => {
        const fileStream = fs.createWriteStream(localPath);
        const cookieHeader = getCookieHeaderForUrl(targetUrl, cookiesByHost);

        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
                ...(cookieHeader ? { 'Cookie': cookieHeader } : {})
            }
        };

        https.get(targetUrl, options, (response) => {
            if (response.statusCode > 300 && response.statusCode < 400 && response.headers.location) {
                downloadFileFromUrl(response.headers.location, localPath, cookiesByHost).then(resolve);
                return;
            }

            if (response.statusCode !== 200) {
                console.error(`[Échec HTTP ${response.statusCode}] Impossible de télécharger depuis ${targetUrl}`);
                fs.unlink(localPath, () => {});
                return resolve(false);
            }

            response.pipe(fileStream);
            fileStream.on('finish', () => {
                fileStream.close(() => resolve(true));
            });
        }).on('error', (err) => {
            console.error(`[Erreur réseau/téléchargement] ${targetUrl} : ${err.message}`);
            fs.unlink(localPath, () => {});
            resolve(false);
        });
    });
};

const downloadMedia = async (mediaItem, cookiesByHost) => {
    if (!mediaItem || !mediaItem.media_object) return;

    const isVideo = mediaItem.type === 'video' || mediaItem.type === 'animated_gif' || mediaItem.media_object.type === 'video' || mediaItem.media_object.type === 'animated_gif';
    
    // Déterminer le nom de fichier cible local (.mp4 pour les vidéos/GIFs, sinon extension originale)
    let fileName = mediaItem.file;
    if (!fileName && mediaItem.media_object.media_url) {
        fileName = path.basename(new URL(mediaItem.media_object.media_url).pathname);
    }
    if (isVideo && fileName && !fileName.endsWith('.mp4')) {
        fileName = fileName.replace(/\.[^/.]+$/, '') + '.mp4';
    }
    if (!fileName) return;

    const localPath = path.join(MEDIA_DIR, fileName);

    // Vérification : Ne pas télécharger si la vidéo ou le fichier existe déjà
    if (fs.existsSync(localPath)) {
        //console.log(`File already exists: ${fileName}, skipping download`);
        mediaItem.locallien = `http://localhost:3002/public/images/tweet_media/${fileName}`;
        return;
    }

    // Traitement 1 : Téléchargement Vidéo / GIF
    if (isVideo) {
        const expandedUrl = mediaItem.media_object.expanded_url;
        console.log(`Résolution vidéo pour ${fileName} via FxTwitter API...`);
        const videoMp4Url = await resolveVideoUrlWithFxTwitter(expandedUrl);

        if (videoMp4Url) {
            console.log(`Téléchargement de la vidéo MP4 : ${videoMp4Url}`);
            const success = await downloadFileFromUrl(videoMp4Url, localPath, cookiesByHost);
            if (success) {
                mediaItem.locallien = `http://localhost:3002/public/images/tweet_media/${fileName}`;
                console.log(`Vidéo téléchargée avec succès : ${fileName}`);
                return;
            }
        }

        // Tente de secourir en fallback avec l'URL media_url miniature si le téléchargement vidéo échoue
        console.warn(`[Échec MP4] Impossible de résoudre la vidéo pour ${fileName}, fallback image miniature...`);
    }

    // Traitement 2 : Téléchargement Image standard / Fallback
    const mediaUrl = mediaItem.media_object.media_url;
    if (!mediaUrl) return;

    const imgFileName = path.basename(new URL(mediaUrl).pathname);
    const imgLocalPath = path.join(MEDIA_DIR, imgFileName);

    // Vérifier si l'image existe déjà avant téléchargement
    if (fs.existsSync(imgLocalPath)) {
       // console.log(`Image already exists: ${imgFileName}, skipping download`);
        mediaItem.locallien = `http://localhost:3002/public/images/tweet_media/${imgFileName}`;
        return;
    }

    const success = await downloadFileFromUrl(mediaUrl, imgLocalPath, cookiesByHost);
    if (success) {
        mediaItem.locallien = `http://localhost:3002/public/images/tweet_media/${imgFileName}`;
        console.log(`Downloaded image to ${mediaItem.locallien}`);
    }
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


