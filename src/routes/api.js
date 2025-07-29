const express = require('express');
const router = express.Router();
const tweetController = require('../controllers/tweetController');
const accountController = require('../controllers/accountController');
const favoriteController = require('../controllers/favoriteController');

// Tweet routes
router.get('/tweets', tweetController.getTweets);
router.post('/tweets', tweetController.createTweet);
router.get('/search', tweetController.searchTweets);

// Profile routes
// More specific routes first
router.get('/profile/:username/media', tweetController.getProfileMedia);
router.get('/profile/:username/videos', tweetController.getProfileVideos);
// More general route last
router.get('/profile/:username', tweetController.getTweetsByUsername);

// Media routes
router.get('/media', tweetController.getTweetsWithMedia);
router.get('/videos', tweetController.getTweetsWithVideos);

// Account routes
router.get('/accounts', accountController.getAccounts);
router.post('/hide/:username', accountController.hideAccount);
router.post('/show/:username', accountController.showAccount);
router.post('/favorite_account/:username', accountController.addFavoriteAccount);
router.post('/unfavorite_account/:username', accountController.removeFavoriteAccount);

// Favorite routes
router.get('/favorites', favoriteController.getFavorites);
router.post('/favorite/:id', favoriteController.addFavorite);
router.post('/unfavorite/:id', favoriteController.removeFavorite);
router.get('/favorite/:id', favoriteController.checkFavorite);

module.exports = router;
