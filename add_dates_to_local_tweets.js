require('dotenv').config(); // Pour charger les variables d'environnement depuis un fichier .env
const fs = require('fs').promises;
const puppeteer = require('puppeteer-core');
const metascraper = require('metascraper')([require('metascraper-date')()]);

// !!! IMPORTANT !!!
// 1. Assurez-vous d'avoir un fichier .env à la racine du projet avec votre clé API :
//    BROWSERLESS_API_KEY=VOTRE_CLE_API
// 2. Remplacez cette variable par le chemin d'accès correct vers votre fichier JSON de tweets.
const TWEET_INPUT_FILE_PATH = './tweet.json'; 
const TWEET_OUTPUT_FILE_PATH = './tweets_with_dates.json';

const getHTML = require('html-get')

/**
 * `browserless` will be passed to `html-get`
 * as driver for getting the rendered HTML.
 */
const browserless = require('browserless')()

const getContent = async url => {
  // create a browser context inside the main Chromium process
  const browserContext = browserless.createContext()
  const promise = getHTML(url, { getBrowserless: () => browserContext })
  // close browser resources before return the result
  promise.then(() => browserContext).then(browser => browser.destroyContext())
  return promise
}
async function getBrowser() {
  if (!BROWSERLESS_API_KEY) {
    throw new Error('La variable d\'environnement BROWSERLESS_API_KEY est manquante.');
  }
  console.log('Connexion à Browserless...');
  return puppeteer.connect({
    browserWSEndpoint: `wss://chrome.browserless.io?token=${BROWSERLESS_API_KEY}`,
  });
}

async function addDatesToTweets() {
  let browser;
  try {
    // 1. Lire le fichier JSON local
    let tweets;
    try {
      const fileContent = await fs.readFile(TWEET_INPUT_FILE_PATH, 'utf8');
      tweets = JSON.parse(fileContent);
    } catch (error) {
      console.error(`Erreur : Impossible de lire le fichier d'entrée : ${TWEET_INPUT_FILE_PATH}`);
      console.error('Veuillez vérifier que la variable TWEET_INPUT_FILE_PATH est correctement configurée.');
      return;
    }

    if (!Array.isArray(tweets)) {
      console.error("Erreur : Le fichier JSON ne contient pas un tableau de tweets.");
      return;
    }

   
    const updatedTweets = [];
    console.log(`Début du traitement de ${tweets.length} tweets...`);

    // 2. Parcourir chaque tweet pour y ajouter la date
    for (const [index, tweet] of tweets.entries()) {
      if (tweet.date) {
        updatedTweets.push(tweet);
        continue;
      }

      const url = tweet.lien;
      if (!url) {
        console.log(`Tweet ignoré (index ${index}) car il manque le champ "lien".`);
        updatedTweets.push(tweet);
        continue;
      }

      let page;
      try {

        console.log(`(${index + 1}/${tweets.length}) Navigation vers : ${url}`);
        const html = await getContent(url);
        const metadata = await metascraper({ html, url });

        console.log(metadata);
        if (metadata.date) {
          const newTweet = { ...tweet, date: new Date(metadata.date) };
          updatedTweets.push(newTweet);
          console.log(`Date ajoutée pour le tweet ${url}: ${metadata.date}`);
        } else {
          console.log(`Impossible de trouver la date pour le tweet ${url}`);
          updatedTweets.push(tweet);
        }
      } catch (error) {
        console.error(`Échec du traitement du tweet ${url}:`, error.message);
        updatedTweets.push(tweet);
      } finally {
        if (page) await page.close();
      }
    }

    // 3. Écrire le résultat dans un nouveau fichier JSON
    await fs.writeFile(TWEET_OUTPUT_FILE_PATH, JSON.stringify(updatedTweets, null, 2));
    console.log(`Traitement terminé. Les tweets mis à jour ont été sauvegardés dans : ${TWEET_OUTPUT_FILE_PATH}`);

  } catch (error) {
    console.error('Une erreur générale est survenue :', error.message);
  } finally {
    if (browser) {
      await browser.close();
      console.log('Déconnexion de Browserless.');
    }
  }
}

addDatesToTweets();