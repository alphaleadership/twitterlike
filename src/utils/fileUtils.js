const fs = require('fs');
const path = require('path');
const axios = require('axios');


const readJsonFile = (filePath) => {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // If file doesn't exist or is empty, return an empty array
    if (error.code === 'ENOENT' || data === '') {
      return [];
    }
    console.error(`Error reading file ${filePath}:`, error);
    return [];
  }
};

const writeJsonFile = (filePath, data) => {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error(`Error writing to file ${filePath}:`, error);
    return false;
  }
};

const getHiddenAccounts = () => {
  const hiddenAccountsPath = path.join(__dirname, '../../hidden_accounts.json');
  return readJsonFile(hiddenAccountsPath);
};

const getHiddenTweets = () => {
  const hiddenTweetsPath = path.join(__dirname, '../../hidden_tweets.json');
  return readJsonFile(hiddenTweetsPath);
};

const getFavorites = () => {
  const favoritesPath = path.join(__dirname, '../../favorites.json');
  return readJsonFile(favoritesPath);
};

const getFavoriteAccounts = () => {
  const favoriteAccountsPath = path.join(__dirname, '../../favorite_accounts.json');
  return readJsonFile(favoriteAccountsPath);
};

const updateFavoriteAccounts = (username, action = 'add') => {
  const favoriteAccountsPath = path.join(__dirname, '../../favorite_accounts.json');
  let accounts = getFavoriteAccounts();
  
  if (action === 'add' && !accounts.includes(username)) {
    accounts.push(username);
  } else if (action === 'remove') {
    accounts = accounts.filter(account => account !== username);
  }
  
  return writeJsonFile(favoriteAccountsPath, accounts);
};

const updateHiddenAccounts = (username, action = 'add') => {
  const hiddenAccountsPath = path.join(__dirname, '../../hidden_accounts.json');
  let accounts = getHiddenAccounts();
  
  if (action === 'add' && !accounts.includes(username)) {
    accounts.push(username);
  } else if (action === 'remove') {
    accounts = accounts.filter(account => account !== username);
  }
  
  return writeJsonFile(hiddenAccountsPath, accounts);
};

const updateFavorites = (tweetId, action = 'add') => {
  const favoritesPath = path.join(__dirname, '../../favorites.json');
  let favorites = getFavorites();
  
  if (action === 'add' && !favorites.includes(tweetId)) {
    favorites.push(tweetId);
  } else if (action === 'remove') {
    favorites = favorites.filter(id => id !== tweetId);
  }
  
  return writeJsonFile(favoritesPath, favorites);
};

const updateHiddenTweets = (tweetId, action = 'add') => {
  const hiddenTweetsPath = path.join(__dirname, '../../hidden_tweets.json');
  let hiddenTweets = getHiddenTweets();
  
  if (action === 'add' && !hiddenTweets.includes(tweetId)) {
    hiddenTweets.push(tweetId);
  } else if (action === 'remove') {
    hiddenTweets = hiddenTweets.filter(id => id !== tweetId);
  }
  
  return writeJsonFile(hiddenTweetsPath, hiddenTweets);
};
const accountsFilePath = path.join(__dirname, '../../../accounts.txt');
console.log(accountsFilePath)
const appendAccountToFile = (username) => {


  try {
    fs.appendFileSync(accountsFilePath, username + '\n');
    console.log(`Appended ${username} to accounts.txt`);
  } catch (error) {
    console.error(`Error appending account to file ${accountsFilePath}:`, error);
  }
};



const downloadProfilePicture = async (username) => {
  console.log(username)
  const imageUrl = `http://localhost:3031/twitter/${username.account}`;
  const imagePath = path.join(__dirname, '../public/images/profiles', `${username.account}.png`);

  // Check if the file already exists
  if (fs.existsSync(imagePath)) {
    console.log(`Profile picture for ${username.account} already exists. Skipping download.`);
    return true;
  }

  try {
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    if (response.status !== 200) {
      console.warn(`Could not download profile picture for ${username.account}:`);
      return false;
    }
    fs.writeFileSync(imagePath, response.data);
    console.log(`Downloaded profile picture for ${username.account}`);
    return true;
  } catch (error) {
    console.error(`Error downloading profile picture for ${username.account}:`);
    return false;
  }
};

module.exports = {
  getHiddenAccounts,
  getHiddenTweets,
  getFavorites,
  getFavoriteAccounts,
  updateFavoriteAccounts,
  updateHiddenAccounts,
  updateFavorites,
  updateHiddenTweets,
  readJsonFile,
  writeJsonFile,
  appendAccountToFile,
  downloadProfilePicture
};