const express = require('express');
const router = express.Router();
const webController = require('../controllers/webController');

router.get('/', webController.renderIndex);
router.get('/favorites', webController.renderFavorites);
router.get('/favorite_accounts_tweets', webController.renderFavoriteAccountsTweets);
router.get('/search', webController.renderSearchResults);
router.get('/profile/:username/media', webController.renderProfileMedia);
router.get('/profile/:username/videos', webController.renderProfileVideos);
router.get('/profile/:username', webController.renderProfile);
router.get('/tweet/:id', webController.renderTweetDetail);
router.get('/all_media', webController.renderAllMedia);

router.post('/hide/:username', webController.hideAccount);
router.post('/like/:id', webController.addFavorite);
router.post('/unlike/:id', webController.removeFavorite);
router.post('/like-account/:username', webController.addFavoriteAccount);
router.post('/unlike-account/:username', webController.removeFavoriteAccount);
router.post('/like-all-tweets/:username', webController.addAllTweetsToFavorites);
router.post('/like-all-media-tweets/:username', webController.addAllMediaTweetsToFavorites);
router.post('/hide-tweet/:id', webController.hideTweet);

module.exports = router;