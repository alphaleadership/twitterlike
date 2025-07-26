const { getDb } = require('../config/db');
const { getHiddenAccounts, getFavorites, getFavoriteAccounts, updateFavorites, appendAccountToFile, getHiddenTweets, updateHiddenTweets } = require('../utils/fileUtils');
const { enrichTweet, videofilter } = require('../utils/mediaUtils');

class TweetService {
  constructor() {
    this.collectionName = 'tweets';
    this.tweetsPerPage = 10;
    this.mediaPerPage = 14;
    this.videosPerPage = 14;
  }

  async getCollection() {
    const db = getDb();
    return db.collection(this.collectionName);
  }

  async getAllTweets(filterHidden = true) {
    try {
      const collection = await this.getCollection();
      let tweets = await collection.find({}).toArray();
      
      if (filterHidden) {
        const hiddenAccounts = getHiddenAccounts();
        const hiddenTweets = getHiddenTweets();
        tweets = tweets.filter(tweet => !hiddenAccounts.includes(tweet.compte) && !hiddenTweets.includes(tweet.id));
      }
      
      const favorites = getFavorites();
      const favoriteAccounts = getFavoriteAccounts();
      
      return tweets.map(tweet => 
        enrichTweet(tweet, favorites, favoriteAccounts)
      );
    } catch (error) {
      console.error('Error getting all tweets:', error);
      throw error;
    }
  }

  async getTweetById(tweetId, formatTweetText) {
    try {
      const collection = await this.getCollection();
      let tweet = await collection.findOne({ id: tweetId });
      if (tweet) {
        const favorites = getFavorites();
        const favoriteAccounts = getFavoriteAccounts();
        tweet = enrichTweet(tweet, favorites, favoriteAccounts, formatTweetText, this);
      }
      return tweet;
    } catch (error) {
      console.error(`Error getting tweet by ID ${tweetId}:`, error);
      throw error;
    }
  }

  async getTweetByIdRaw(tweetId) {
    try {
      const collection = await this.getCollection();
      return await collection.findOne({ id: tweetId });
    } catch (error) {
      console.error(`Error getting raw tweet by ID ${tweetId}:`, error);
      throw error;
    }
  }

  async getTweetsByUsername(username, page = 1, pageSize = 10, formatTweetText, tweetServiceInstance, searchQuery = '') {
    try {
      const collection = await this.getCollection();
      let query = { compte: username };
      if (searchQuery) {
        query.texte = { $regex: searchQuery, $options: 'i' };
      }
      const allTweets = await collection.find(query).toArray();
      
      allTweets.sort((a, b) => new Date(b.date) - new Date(a.date));
      
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedTweets = allTweets.slice(startIndex, endIndex);
      
      const favorites = getFavorites();
      const favoriteAccounts = getFavoriteAccounts();
      const enrichedTweets = paginatedTweets.map(tweet => 
        enrichTweet(tweet, favorites, favoriteAccounts, formatTweetText, tweetServiceInstance)
      );
      
      return {
        tweets: enrichedTweets,
        currentPage: page,
        totalPages: Math.ceil(allTweets.length / pageSize),
        totalTweets: allTweets.length
      };
    } catch (error) {
      console.error(`Error getting tweets for user ${username}:`, error);
      throw error;
    }
  }

  async searchTweets(query, page = 1, pageSize = 10, formatTweetText) {
    try {
      const collection = await this.getCollection();
      const searchRegex = new RegExp(query, 'i');
      
      const allResults = await collection.find({
        $or: [
          { texte: { $regex: searchRegex } },
          { 'hashtags.text': { $regex: searchRegex } },
          { compte: { $regex: searchRegex } }
        ]
      }).toArray();

      const hiddenAccounts = getHiddenAccounts();
      const hiddenTweets = getHiddenTweets();
      const filteredResults = allResults.filter(tweet => !hiddenAccounts.includes(tweet.compte) && !hiddenTweets.includes(tweet.id));
      
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedResults = filteredResults.slice(startIndex, endIndex);
      
      const favorites = getFavorites();
      const favoriteAccounts = getFavoriteAccounts();
      const enrichedResults = paginatedResults.map(tweet => 
        enrichTweet(tweet, favorites, favoriteAccounts, formatTweetText)
      );
      
      return {
        tweets: enrichedResults,
        currentPage: page,
        totalPages: Math.ceil(filteredResults.length / pageSize),
        totalResults: filteredResults.length
      };
    } catch (error) {
      console.error('Error searching tweets:', error);
      throw error;
    }
  }

  async getPaginatedTweets(page = 1, formatTweetText, searchQuery = '') {
    try {
      let allTweets = await this.getAllTweets();

      if (searchQuery) {
        const searchRegex = new RegExp(searchQuery, 'i');
        allTweets = allTweets.filter(tweet => searchRegex.test(tweet.compte));
      }

      const startIndex = (page - 1) * this.tweetsPerPage;
      const endIndex = startIndex + this.tweetsPerPage;
      
      const shuffledTweets = [...allTweets].sort(() => Math.random() - 0.5);
      
      const hiddenAccounts = getHiddenAccounts();
      const favoriteAccounts = getFavoriteAccounts();
      const uniqueAccounts = {};
      allTweets.forEach(tweet => {
        if (!hiddenAccounts.includes(tweet.compte)) {
          uniqueAccounts[tweet.compte] = (uniqueAccounts[tweet.compte] || 0) + 1;
        }
      });
  
      const sortedAccounts = Object.entries(uniqueAccounts)
        .map(([account, count]) => ({ account, count }))
        .sort((a, b) => b.count - a.count)

      return {
        tweets: shuffledTweets.slice(startIndex, endIndex),
        currentPage: page,
        totalPages: Math.ceil(allTweets.length / this.tweetsPerPage),
        allAccounts: sortedAccounts,
        favoriteAccounts: favoriteAccounts
      };
    } catch (error) {
      console.error('Error getting paginated tweets:', error);
      throw error;
    }
  }

  async getUniqueAccounts() {
    try {
      const allTweets = await this.getAllTweets();
      const accountCounts = {};
      
      allTweets.forEach(tweet => {
        accountCounts[tweet.compte] = (accountCounts[tweet.compte] || 0) + 1;
      });
      
      return Object.entries(accountCounts)
        .filter(([account, count]) => count > 10) // Filter accounts with more than 10 tweets
        .map(([account, count]) => ({ account, count }))
        .sort((a, b) => b.count - a.count)
        
    } catch (error) {
      console.error('Error getting unique accounts:', error);
      throw error;
    }
  }

  async getTweetsWithMedia(page = 1) {
    try {
      const allTweets = await this.getAllTweets();
      
      const mediaTweets = allTweets.filter(tweet => 
        (tweet.media && tweet.media.length > 0) || 
        (tweet.video && tweet.video.length > 0)
      );
      
      mediaTweets.sort((a, b) => new Date(b.date) - new Date(a.date));
      
      const startIndex = (page - 1) * this.mediaPerPage;
      const endIndex = startIndex + this.mediaPerPage;
      const paginatedTweets = mediaTweets.slice(startIndex, endIndex);
      
      return {
        tweets: paginatedTweets,
        currentPage: page,
        totalPages: Math.ceil(mediaTweets.length / this.mediaPerPage),
        totalMedia: mediaTweets.length
      };
    } catch (error) {
      console.error('Error getting tweets with media:', error);
      throw error;
    }
  }

  async getTweetsWithVideos(page = 1) {
    try {
      const allTweets = await this.getAllTweets();
      
      const videoTweets = allTweets.filter(tweet => 
        tweet.video && tweet.video.length > 0
      );
      
      videoTweets.sort((a, b) => new Date(b.date) - new Date(a.date));
      
      const startIndex = (page - 1) * this.videosPerPage;
      const endIndex = startIndex + this.videosPerPage;
      const paginatedTweets = videoTweets.slice(startIndex, endIndex);
      
      return {
        tweets: paginatedTweets,
        currentPage: page,
        totalPages: Math.ceil(videoTweets.length / this.videosPerPage),
        totalVideos: videoTweets.length
      };
    } catch (error) {
      console.error('Error getting tweets with videos:', error);
      throw error;
    }
  }

  async getFavoriteTweets() {
    try {
      const allTweets = await this.getAllTweets(false); // Do not filter hidden accounts here
      const favorites = getFavorites();
      const favoriteTweets = allTweets.filter(tweet => favorites.includes(tweet.id));
      const favoriteAccounts = getFavoriteAccounts();
      return { tweets: favoriteTweets, favoriteAccounts: favoriteAccounts };
    } catch (error) {
      console.error('Error getting favorite tweets:', error);
      throw error;
    }
  }

  async getFavoriteAccountsTweets() {
    try {
      const allTweets = await this.getAllTweets(false); // Do not filter hidden accounts here
      const favoriteAccounts = getFavoriteAccounts();
      let favoriteAccountTweets = allTweets.filter(tweet => favoriteAccounts.includes(tweet.compte));
      favoriteAccountTweets = favoriteAccountTweets.sort(() => Math.random() - 0.5); // Randomize the tweets
      const uniqueAccounts = allTweets.map(tweet => tweet.compte).filter((value, index, self) => self.indexOf(value) === index).sort()
      .map(account => ({
        account,
        count: allTweets.filter(tweet => tweet.compte === account).length
      }))
      .sort((a, b) => b.count - a.count);
      const favoriteAccountsWithCounts = uniqueAccounts.filter(account => favoriteAccounts.includes(account.account));
      return { tweets: favoriteAccountTweets, favoriteAccounts: favoriteAccountsWithCounts, allAccounts: uniqueAccounts };
    } catch (error) {
      console.error('Error getting favorite accounts tweets:', error);
      throw error;
    }
  }

  async searchTweetsAndRender(query) {
    try {
      const allTweets = await this.getAllTweets();
      const searchResults = allTweets.filter(tweet => {
        const tweetText = tweet.texte ? tweet.texte.toLowerCase() : '';
        const hashtags = tweet.hashtags ? tweet.hashtags.map(tag => tag.text.toLowerCase()) : [];
        
        return tweetText.includes(query.toLowerCase()) || hashtags.some(tag => tag.includes(query.toLowerCase()));
      });
      const favoriteAccounts = getFavoriteAccounts();
      const uniqueAccounts = allTweets.map(tweet => tweet.compte).filter((value, index, self) => self.indexOf(value) === index).sort();
      return { tweets: searchResults, allAccounts: uniqueAccounts, favoriteAccounts: favoriteAccounts };
    } catch (error) {
      console.error('Error searching tweets for rendering:', error);
      throw error;
    }
  }

  async getProfileMedia(username, page = 1, formatTweetText, tweetServiceInstance) {
    try {
      let userTweets = await this.getTweetsByUsername(username, 1, 1000, formatTweetText, tweetServiceInstance); // Get all tweets for user
      const user = userTweets.tweets.length > 0 ? { name: userTweets.tweets[0].compte, username: userTweets.tweets[0].compte } : null;
      
      let allMedia = [];
      userTweets.tweets.forEach(tweet => {
        if (tweet.allMedia) {
          allMedia = allMedia.concat(tweet.allMedia.map(m => ({ ...m, tweetId: tweet.id })));
        }
      });

      const startIndex = (page - 1) * this.mediaPerPage;
      const endIndex = startIndex + this.mediaPerPage;

      const media = allMedia.slice(startIndex, endIndex);
      const totalPages = Math.ceil(allMedia.length / this.mediaPerPage);

      return { user, media, currentPage: page, totalPages };
    } catch (error) {
      console.error(`Error getting profile media for ${username}:`, error);
      throw error;
    }
  }

  async getProfileVideos(username, page = 1) {
    try {
      let userTweets = await this.getTweetsByUsername(username, 1, 1000); // Get all tweets for user
      const user = userTweets.tweets.length > 0 ? { name: userTweets.tweets[0].compte, username: userTweets.tweets[0].compte } : null;

      let allVideos = [];
      userTweets.tweets.forEach(tweet => {
        if (tweet.allMedia) {
          allVideos = allVideos.concat(tweet.allMedia.filter(m => m.type === 'video').map(v => ({ ...v, tweetId: tweet.id })));
        }
      });

      const startIndex = (page - 1) * this.videosPerPage;
      const endIndex = startIndex + this.videosPerPage;

      const videos = allVideos.slice(startIndex, endIndex);
      const totalPages = Math.ceil(allVideos.length / this.videosPerPage);

      return { user, videos, currentPage: page, totalPages };
    } catch (error) {
      console.error(`Error getting profile videos for ${username}:`, error);
      throw error;
    }
  }

  async getProfileData(username, page = 1, searchQuery = '') {
    try {
      let userTweets = await this.getTweetsByUsername(username, 1, 1000, null, null, searchQuery); // Get all tweets for user
      const user = userTweets.tweets.length > 0 ? { name: userTweets.tweets[0].compte, username: userTweets.tweets[0].compte } : null;

      if (!user) {
        appendAccountToFile(username);
        return { user: null };
      }

      let allMedia = [];
      userTweets.tweets.forEach(tweet => {
        if (tweet.allMedia) {
          allMedia = allMedia.concat(tweet.allMedia.map(m => ({ ...m, tweetId: tweet.id })));
        }
      });

      const retweetCounts = {};
      userTweets.tweets.forEach(tweet => {
        if (tweet.retweeted_status && tweet.retweeted_status.user) {
          const retweetedAccount = tweet.retweeted_status.user.screen_name;
          retweetCounts[retweetedAccount] = (retweetCounts[retweetedAccount] || 0) + 1;
        }
      });

      const sortedRetweetedAccounts = Object.entries(retweetCounts)
        .map(([account, count]) => ({ account, count }))
        .sort((a, b) => b.count - a.count)
        .map(account => account.account);

      const mentionCounts = {};
      userTweets.tweets.forEach(tweet => {
        const mentionsInText = tweet.texte.match(/@(\w+)/g);
        if (mentionsInText) {
          mentionsInText.forEach(mention => {
            const mentionedUsername = mention.substring(1); // Remove the '@'
            mentionCounts[mentionedUsername] = (mentionCounts[mentionedUsername] || 0) + 1;
          });
        }
      });

      const sortedMentionedAccounts = Object.entries(mentionCounts)
        .map(([account, count]) => ({ account, count }))
        .sort((a, b) => b.count - a.count);

      const startIndex = (page - 1) * this.tweetsPerPage;
      const endIndex = startIndex + this.tweetsPerPage;

      const paginatedTweets = userTweets.tweets.slice(startIndex, endIndex);
      const totalPages = Math.ceil(userTweets.tweets.length / this.tweetsPerPage);
      
      return {
        user,
        tweets: paginatedTweets,
        media: allMedia,
        topRetweetedAccounts: sortedRetweetedAccounts,
        topMentionedAccounts: sortedMentionedAccounts,
        currentPage: page,
        totalPages
      };
    } catch (error) {
      console.error(`Error getting profile data for ${username}:`, error);
      throw error;
    }
  }

  async getAllMedia(page = 1) {
    try {
      const allTweets = await this.getAllTweets();

      let allMedia = [];
      allTweets.forEach(tweet => {
        if (tweet.allMedia) {
          allMedia = allMedia.concat(tweet.allMedia.map(m => ({ ...m, tweetId: tweet.id, compte: tweet.compte })));
        }
      });

      const startIndex = (page - 1) * this.mediaPerPage;
      const endIndex = startIndex + this.mediaPerPage;

      const media = allMedia.slice(startIndex, endIndex);
      const totalPages = Math.ceil(allMedia.length / this.mediaPerPage);

      return { media, currentPage: page, totalPages };
    } catch (error) {
      console.error('Error getting all media:', error);
      throw error;
    }
  }

  async addFavorite(tweetId) {
    try {
      return updateFavorites(tweetId, 'add');
    } catch (error) {
      console.error(`Error adding favorite for tweet ${tweetId}:`, error);
      throw error;
    }
  }

  async removeFavorite(tweetId) {
    try {
      return updateFavorites(tweetId, 'remove');
    } catch (error) {
      console.error(`Error removing favorite for tweet ${tweetId}:`, error);
      throw error;
    }
  }

  async addMultipleFavorites(tweetIds) {
    try {
      for (const tweetId of tweetIds) {
        await updateFavorites(tweetId, 'add');
      }
      return true;
    } catch (error) {
      console.error(`Error adding multiple favorites:`, error);
      throw error;
    }
  }

  async getTweetsWithMediaByUsername(username, page = 1, pageSize = 10) {
    try {
      const { tweets } = await this.getTweetsByUsername(username, page, pageSize); // Get all tweets for user
      const mediaTweets = tweets.filter(tweet => 
        (tweet.allMedia && tweet.allMedia.length > 0)
      );
      return { tweets: mediaTweets };
    } catch (error) {
      console.error(`Error getting tweets with media for user ${username}:`, error);
      throw error;
    }
  }

  async hideTweet(tweetId) {
    try {
      return updateHiddenTweets(tweetId, 'add');
    } catch (error) {
      console.error(`Error hiding tweet ${tweetId}:`, error);
      throw error;
    }
  }
}

module.exports = new TweetService();