const tweetService = require('../services/tweetService');
const accountService = require('../services/accountService');
const fileUtils = require('../utils/fileUtils');

const formatTweetText = (text) => {
  let formattedText = text.replace(/@(\w+)/g, '<a href="/profile/$1">@$1</a>');
  formattedText = formattedText.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');
  return formattedText;
};

const webController = {
  async renderIndex(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const { tweets, currentPage, totalPages, allAccounts, favoriteAccounts } = await tweetService.getPaginatedTweets(page);
      res.render('index', {
        tweets,
        currentPage,
        totalPages,
        formatTweetText,
        allAccounts,
        favoriteAccounts
      });
    } catch (error) {
      console.error('Error rendering index page:', error);
      res.status(500).send('Error rendering index page');
    }
  },

  async renderFavorites(req, res) {
    try {
      const { tweets, favoriteAccounts } = await tweetService.getFavoriteTweets();
      const allAccounts = await tweetService.getUniqueAccounts();
      res.render('favorites', { tweets, formatTweetText, favoriteAccounts, allAccounts });
    } catch (error) {
      console.error('Error rendering favorites page:', error);
      res.status(500).send('Error rendering favorites page');
    }
  },

  async renderFavoriteAccountsTweets(req, res) {
    try {
      const { tweets, favoriteAccounts, allAccounts } = await tweetService.getFavoriteAccountsTweets();
      res.render('favorite_accounts_tweets', { tweets, formatTweetText, favoriteAccounts, allAccounts });
    } catch (error) {
      console.error('Error rendering favorite accounts tweets page:', error);
      res.status(500).send('Error rendering favorite accounts tweets page');
    }
  },

  async renderSearchResults(req, res) {
    try {
      const query = req.query.q || '';
      const { tweets, allAccounts, favoriteAccounts } = await tweetService.searchTweetsAndRender(query);
      res.render('search_results', {
        tweets,
        formatTweetText,
        query,
        favoriteAccounts,
        allAccounts
      });
    } catch (error) {
      console.error('Error rendering search results page:', error);
      res.status(500).send('Error rendering search results page');
    }
  },

  async renderProfileMedia(req, res) {
    try {
      const username = req.params.username;
      const page = parseInt(req.query.page) || 1;
      const { user, media, currentPage, totalPages } = await tweetService.getProfileMedia(username, page);
      const allAccounts = await tweetService.getUniqueAccounts();
      const { favorites: favoriteAccounts } = await accountService.getAccounts();
      if (user) {
        res.render('profile_media', {
          user,
          media,
          currentPage,
          totalPages,
          allAccounts,
          favoriteAccounts
        });
      } else {
        fileUtils.appendAccountToFile(username);
        res.status(404).send('User not found');
      }
    } catch (error) {
      console.error('Error rendering profile media page:', error);
      res.status(500).send('Error rendering profile media page');
    }
  },

  async renderProfileVideos(req, res) {
    try {
      const username = req.params.username;
      const page = parseInt(req.query.page) || 1;
      const { user, videos, currentPage, totalPages } = await tweetService.getProfileVideos(username, page);
      const allAccounts = await tweetService.getUniqueAccounts();
      const { favorites: favoriteAccounts } = await accountService.getAccounts();
      if (user) {
        res.render('profile_videos', {
          user,
          videos,
          currentPage,
          totalPages,
          allAccounts,
          favoriteAccounts
        });
      } else {
        fileUtils.appendAccountToFile(username);
        res.status(404).send('User not found');
      }
    } catch (error) {
      console.error('Error rendering profile videos page:', error);
      res.status(500).send('Error rendering profile videos page');
    }
  },

  async renderProfile(req, res) {
    try {
      const username = req.params.username;
      const page = parseInt(req.query.page) || 1;
      const { user, tweets, media, topRetweetedAccounts, topMentionedAccounts, currentPage, totalPages } = await tweetService.getProfileData(username, page);
      const allAccounts = await tweetService.getUniqueAccounts();
      const { favorites: favoriteAccounts } = await accountService.getAccounts();
      if (user) {
        res.render('profile', {
          user,
          tweets,
          media,
          topRetweetedAccounts,
          topMentionedAccounts,
          formatTweetText,
          currentPage,
          totalPages,
          allAccounts,
          favoriteAccounts
        });
      } else {
        fileUtils.appendAccountToFile(username);
        res.status(404).send('User not found');
      }
    } catch (error) {
      console.error('Error rendering profile page:', error);
      res.status(500).send('Error rendering profile page');
    }
  },

  async renderTweetDetail(req, res) {
    try {
      const tweetId = req.params.id;
      const tweet = await tweetService.getTweetById(tweetId);
      if (tweet) {
        res.render('tweet_detail', { tweet, formatTweetText });
      } else {
        res.status(404).send('Tweet not found');
      }
    } catch (error) {
      console.error('Error rendering tweet detail page:', error);
      res.status(500).send('Error rendering tweet detail page');
    }
  },

  async renderAllMedia(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const { media, currentPage, totalPages } = await tweetService.getAllMedia(page);
      res.render('all_media', {
        media,
        currentPage,
        totalPages
      });
    } catch (error) {
      console.error('Error rendering all media page:', error);
      res.status(500).send('Error rendering all media page');
    }
  },

  async hideAccount(req, res) {
    try {
      const username = req.params.username;
      await accountService.hideAccount(username);
      res.redirect('/');
    } catch (error) {
      console.error('Error hiding account:', error);
      res.status(500).send('Error hiding account');
    }
  },

  async addFavorite(req, res) {
    try {
      const tweetId = req.params.id;
      await tweetService.addFavorite(tweetId);
      res.redirect('back');
    } catch (error) {
      console.error('Error adding favorite:', error);
      res.status(500).send('Error adding favorite');
    }
  },

  async removeFavorite(req, res) {
    try {
      const tweetId = req.params.id;
      await tweetService.removeFavorite(tweetId);
      res.redirect('back');
    } catch (error) {
      console.error('Error removing favorite:', error);
      res.status(500).send('Error removing favorite');
    }
  },

  async addFavoriteAccount(req, res) {
    try {
      const username = req.params.username;
      await accountService.addFavoriteAccount(username);
      res.redirect('back');
    } catch (error) {
      console.error('Error adding favorite account:', error);
      res.status(500).send('Error adding favorite account');
    }
  },

  async removeFavoriteAccount(req, res) {
    try {
      const username = req.params.username;
      await accountService.removeFavoriteAccount(username);
      res.redirect('back');
    } catch (error) {
      console.error('Error removing favorite account:', error);
      res.status(500).send('Error removing favorite account');
    }
  }
};

module.exports = webController;