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
      // Initialize session counter if it doesn't exist
      if (!req.session.pageViews) {
        req.session.pageViews = 0;
      }
      // Increment the counter
      req.session.pageViews++;

      const page = parseInt(req.query.page) || 1;
      const searchQuery = req.query.search || '';
      const { tweets, currentPage, totalPages, allAccounts, favoriteAccounts } = await tweetService.getPaginatedTweets(page, formatTweetText, searchQuery);
      res.render('index', {
        tweets,
        currentPage,
        totalPages,
        formatTweetText,
        allAccounts,
        favoriteAccounts,
        searchQuery,
        pageViews: req.session.pageViews // Pass pageViews to the template
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
      const favoriteAccountsWithCounts = allAccounts.filter(account => favoriteAccounts.includes(account));
      res.render('favorite_accounts_tweets', { tweets, formatTweetText, favoriteAccounts, allAccounts: favoriteAccounts });
    } catch (error) {
      console.error('Error rendering favorite accounts tweets page:', error);
      res.status(500).send('Error rendering favorite accounts tweets page');
    }
  },

  async renderSearchResults(req, res) {
    try {
      const query = req.query.query || '';
      console.log(query)
      const page = parseInt(req.query.page) || 1;
      const { tweets, currentPage, totalPages, allAccounts, favoriteAccounts } = await tweetService.searchTweets(query, page);
      res.render('search_results', {
        tweets,
        formatTweetText,
        query,
        currentPage,
        totalPages,
        favoriteAccounts:favoriteAccounts||[] ,
        allAccounts:allAccounts||[]
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
      console.log('Media data for profile_media.ejs:', media);
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
        res.redirect(`https://twitter.com/${username}`);
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

      // Download profile pictures for all accounts
      for (const account of allAccounts) {
        await fileUtils.downloadProfilePicture(account);
      }

      console.log('Video data for profile_videos.ejs:', videos);
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
        res.redirect(`https://twitter.com/${username}`);
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
      const searchQuery = req.query.search || '';
      const { user, tweets, media, topRetweetedAccounts, topMentionedAccounts, currentPage, totalPages } = await tweetService.getProfileData(username, page, searchQuery);
      const allAccounts = await tweetService.getUniqueAccounts();
      const { favorites: favoriteAccounts } = await accountService.getAccounts();

      // Download profile pictures for all accounts
      for (const account of allAccounts) {
        await fileUtils.downloadProfilePicture(account);
      }

      // Download profile pictures for mentioned accounts
      if (topMentionedAccounts && topMentionedAccounts.length > 0) {
        for (const item of topMentionedAccounts) {
          await fileUtils.downloadProfilePicture(item.account);
        }
      }

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
          favoriteAccounts,
          searchQuery
        });
      } else {
        fileUtils.appendAccountToFile(username);
        res.redirect(`https://twitter.com/${username}`);
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
      const allAccounts = await tweetService.getUniqueAccounts();
      const { favorites: favoriteAccounts } = await accountService.getAccounts();

      if (tweet) {
        // Récupérer d'autres tweets du même compte
        const { tweets: userTweets } = await tweetService.getTweetsByUsername(tweet.compte, 1, 50); // Prend jusqu'à 50 tweets
        
        // Mélanger et prendre quelques suggestions, en excluant le tweet actuel
        const randomTweets = userTweets
          .filter(t => t.id !== tweet.id)
          .sort(() => 0.5 - Math.random())
          .slice(0, 5); // Prend 5 tweets au hasard

        res.render('tweet_detail', { 
          tweet, 
          formatTweetText, 
          allAccounts, 
          favoriteAccounts, 
          randomTweets
        });
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
      const prevUrl = req.session.previousUrls && req.session.previousUrls[1];
      res.redirect(prevUrl || '/');
    } catch (error) {
      console.error('Error hiding account:', error);
      res.status(500).send('Error hiding account');
    }
  },

  async addFavorite(req, res) {
    try {
      const tweetId = req.params.id;
      await tweetService.addFavorite(tweetId);
      const prevUrl = req.session.previousUrls && req.session.previousUrls[1];
      res.redirect(prevUrl || '/');
    } catch (error) {
      console.error('Error adding favorite:', error);
      res.status(500).send('Error adding favorite');
    }
  },

  async removeFavorite(req, res) {
    try {
      const tweetId = req.params.id;
      await tweetService.removeFavorite(tweetId);
      const prevUrl = req.session.previousUrls && req.session.previousUrls[1];
      res.redirect(prevUrl || '/');
    } catch (error) {
      console.error('Error removing favorite:', error);
      res.status(500).send('Error removing favorite');
    }
  },

  async addFavoriteAccount(req, res) {
    try {
      const username = req.params.username;
      await accountService.addFavoriteAccount(username);
      const prevUrl = req.session.previousUrls && req.session.previousUrls[1];
      res.redirect(prevUrl || '/');
    } catch (error) {
      console.error('Error adding favorite account:', error);
      res.status(500).send('Error adding favorite account');
    }
  },

  async removeFavoriteAccount(req, res) {
    try {
      const username = req.params.username;
      await accountService.removeFavoriteAccount(username);
      const prevUrl = req.session.previousUrls && req.session.previousUrls[1];
      res.redirect(prevUrl || '/');
    } catch (error) {
      console.error('Error removing favorite account:', error);
      res.status(500).send('Error removing favorite account');
    }
  },

  async addAllTweetsToFavorites(req, res) {
    try {
      const username = req.params.username;
      const { tweets } = await tweetService.getTweetsByUsername(username, 1, 99999); // Get all tweets
      const tweetIds = tweets.map(tweet => tweet.id);
      await tweetService.addMultipleFavorites(tweetIds);
      const prevUrl = req.session.previousUrls && req.session.previousUrls[1];
      res.redirect(prevUrl || '/');
    } catch (error) {
      console.error('Error adding all tweets to favorites:', error);
      res.status(500).send('Error adding all tweets to favorites');
    }
  },

  async addAllMediaTweetsToFavorites(req, res) {
    try {
      const username = req.params.username;
      const { tweets } = await tweetService.getTweetsWithMediaByUsername(username, 1, 99999); // Get all media tweets
      const tweetIds = tweets.map(tweet => tweet.id);
      await tweetService.addMultipleFavorites(tweetIds);
      const prevUrl = req.session.previousUrls && req.session.previousUrls[1];
      res.redirect(prevUrl || '/');
    } catch (error) {
      console.error('Error adding all media tweets to favorites:', error);
      res.status(500).send('Error adding all media tweets to favorites');
    }
  },

  async hideTweet(req, res) {
    try {
      const tweetId = req.params.id;
      await tweetService.hideTweet(tweetId);
      const prevUrl = req.session.previousUrls && req.session.previousUrls[1];
      res.redirect(prevUrl || '/');
    } catch (error) {
      console.error('Error hiding tweet:', error);
      res.status(500).send('Error hiding tweet');
    }
  }
};

module.exports = webController;
