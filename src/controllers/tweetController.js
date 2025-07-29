const tweetService = require('../services/tweetService');
const accountService = require('../services/accountService');
const favoriteService = require('../services/favoriteService');

const tweetController = {
  async getTweets(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const userId = req.user ? req.user.id : null; // Assuming req.user is populated by authentication middleware
      const { tweets, currentPage, totalPages, totalTweets } = await tweetService.getPaginatedTweets(page, null, null, userId);
      const allAccounts = await tweetService.getUniqueAccounts();
      const favoriteAccounts = (await accountService.getAccounts()).favorites;
      
      res.json({
        tweets,
        currentPage,
        totalPages,
        totalTweets,
        allAccounts,
        favoriteAccounts
      });
    } catch (error) {
      console.error('Error in getTweets:', error);
      res.status(500).json({ error: 'Error fetching tweets' });
    }
  },

  async searchTweets(req, res) {
    try {
      const query = req.query.q || '';
      const page = parseInt(req.query.page) || 1;
      
      if (!query.trim()) {
        return res.json({ 
          tweets: [],
          currentPage: 1,
          totalPages: 0,
          totalResults: 0
        });
      }
      
      const { tweets, currentPage, totalPages, totalResults } = await tweetService.searchTweets(query, page);
      res.json({ 
        tweets, 
        currentPage, 
        totalPages, 
        totalResults 
      });
    } catch (error) {
      console.error('Error in searchTweets:', error);
      res.status(500).json({ error: 'Error searching tweets' });
    }
  },

  async getTweetsByUsername(req, res) {
    try {
      const username = req.params.username;
      const page = parseInt(req.query.page) || 1;
      
      const { tweets, currentPage, totalPages, totalTweets } = await tweetService.getTweetsByUsername(username, page);
      res.json({ 
        tweets, 
        currentPage, 
        totalPages, 
        totalTweets 
      });
    } catch (error) {
      console.error(`Error getting tweets for user ${req.params.username}:`, error);
      res.status(500).json({ error: 'Error fetching user tweets' });
    }
  },

  async getTweetsWithMedia(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const { tweets, currentPage, totalPages, totalMedia } = await tweetService.getTweetsWithMedia(page);
      
      res.json({ 
        tweets, 
        currentPage, 
        totalPages, 
        totalMedia 
      });
    } catch (error) {
      console.error('Error in getTweetsWithMedia:', error);
      res.status(500).json({ error: 'Error fetching tweets with media' });
    }
  },

  async getTweetsWithVideos(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const { tweets, currentPage, totalPages, totalVideos } = await tweetService.getTweetsWithVideos(page);
      
      res.json({ 
        tweets, 
        currentPage, 
        totalPages, 
        totalVideos 
      });
    } catch (error) {
      console.error('Error in getTweetsWithVideos:', error);
      res.status(500).json({ error: 'Error fetching tweets with videos' });
    }
  },

  async getProfileTweets(req, res) {
    try {
      const username = req.params.username;
      const page = parseInt(req.query.page) || 1;
      
      const { tweets, currentPage, totalPages, totalTweets } = await tweetService.getTweetsByUsername(username, page);
      res.json({ 
        tweets, 
        currentPage, 
        totalPages, 
        totalTweets 
      });
    } catch (error) {
      console.error(`Error getting profile tweets for ${req.params.username}:`, error);
      res.status(500).json({ error: 'Error fetching profile tweets' });
    }
  },

  async getProfileMedia(req, res) {
    try {
      const username = req.params.username;
      const page = parseInt(req.query.page) || 1;
      const pageSize = 14; // Même valeur que pour les autres médias
      
      const tweets = await tweetService.getTweetsByUsername(username, 1, 1000); // Récupération de tous les tweets
      const mediaTweets = tweets.tweets.filter(tweet => 
        (tweet.media && tweet.media.length > 0) || 
        (tweet.video && tweet.video.length > 0)
      );
      
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedTweets = mediaTweets.slice(startIndex, endIndex);
      
      res.json({ 
        tweets: paginatedTweets,
        currentPage: page,
        totalPages: Math.ceil(mediaTweets.length / pageSize),
        totalMedia: mediaTweets.length
      });
    } catch (error) {
      console.error(`Error getting profile media for ${req.params.username}:`, error);
      res.status(500).json({ error: 'Error fetching profile media' });
    }
  },

  async getProfileVideos(req, res) {
    try {
      const username = req.params.username;
      const page = parseInt(req.query.page) || 1;
      const pageSize = 14; // Même valeur que pour les autres vidéos
      
      const tweets = await tweetService.getTweetsByUsername(username, 1, 1000); // Récupération de tous les tweets
      const videoTweets = tweets.tweets.filter(tweet => 
        tweet.video && tweet.video.length > 0
      );
      
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedTweets = videoTweets.slice(startIndex, endIndex);
      
      res.json({ 
        tweets: paginatedTweets,
        currentPage: page,
        totalPages: Math.ceil(videoTweets.length / pageSize),
        totalVideos: videoTweets.length
      });
    } catch (error) {
      console.error(`Error getting profile videos for ${req.params.username}:`, error);
      res.status(500).json({ error: 'Error fetching profile videos' });
    }
  },

  async createTweet(req, res) {
    try {
      const tweet = await tweetService.createTweet(req.body);
      res.status(201).json(tweet);
    } catch (error) {
      console.error('Error in createTweet:', error);
      res.status(500).json({ error: 'Error creating tweet' });
    }
  },

  async getFavoriteAccountsMedia(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const userId = req.user ? req.user.id : null;
      const { tweets, currentPage, totalPages, totalMedia } = await tweetService.getFavoriteAccountsMedia(userId, page);
      res.json({
        tweets,
        currentPage,
        totalPages,
        totalMedia
      });
    } catch (error) {
      console.error('Error in getFavoriteAccountsMedia:', error);
      res.status(500).json({ error: 'Error fetching favorite accounts media' });
    }
  }
};

module.exports = tweetController;
