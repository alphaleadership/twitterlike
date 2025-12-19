const { getDb } = require('../config/db');
const { getHiddenAccounts, getFavorites, getFavoriteAccounts, updateFavorites, appendAccountToFile, getHiddenTweets, updateHiddenTweets } = require('../utils/fileUtils');
const { enrichTweet, videofilter } = require('../utils/mediaUtils');
const Like = require('../models/Like');

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

  async getAllTweets(filterHidden = true, userId = null) {
    try {
      const collection = await this.getCollection();
      let tweets = await collection.find({}).toArray();

      // Masquer les réponses du flux principal (uniquement côté back)
      tweets = tweets.filter(tweet => !tweet.reply && !tweet.reply_to);

      if (filterHidden) {
        const hiddenAccounts = getHiddenAccounts();
        const hiddenTweets = getHiddenTweets();
        tweets = tweets.filter(tweet => !hiddenAccounts.includes(tweet.compte) && !hiddenTweets.includes(tweet.id));
      }

      let userLikes = [];
      let userLikedAccounts = [];
      if (userId) {
        userLikes = await Like.find({ userId, tweetId: { $exists: true } }).distinct('tweetId');
        userLikedAccounts = await Like.find({ userId, accountUsername: { $exists: true } }).distinct('accountUsername');
      }

      return tweets.map(tweet => 
        enrichTweet(tweet, userLikes, userLikedAccounts)
      );
    } catch (error) {
      console.error('Error getting all tweets:', error);
      throw error;
    }
  }

  async getTweetById(tweetId, formatTweetText, userId = null) {
    try {
      const collection = await this.getCollection();
      let tweet = await collection.findOne({ id: tweetId });
      if (tweet) {
        let userLikes = [];
        let userLikedAccounts = [];
        if (userId) {
          userLikes = await Like.find({ userId, tweetId: { $exists: true } }).distinct('tweetId');
          userLikedAccounts = await Like.find({ userId, accountUsername: { $exists: true } }).distinct('accountUsername');
        }
        tweet = enrichTweet(tweet, userLikes, userLikedAccounts, formatTweetText, this);
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

  async getTweetsByUsername(username, page = 1, pageSize = 10, formatTweetText, tweetServiceInstance, searchQuery = '', userId = null) {
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
      
      let userLikes = [];
      let userLikedAccounts = [];
      if (userId) {
        userLikes = await Like.find({ userId, tweetId: { $exists: true } }).distinct('tweetId');
        userLikedAccounts = await Like.find({ userId, accountUsername: { $exists: true } }).distinct('accountUsername');
      }
      const enrichedTweets = paginatedTweets.map(tweet => 
        enrichTweet(tweet, userLikes, userLikedAccounts, formatTweetText, tweetServiceInstance)
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

  async searchTweets(query, page = 1, pageSize = 10, formatTweetText, userId = null) {
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

      // Trier les résultats par date (du plus récent au plus ancien)
      filteredResults.sort((a, b) => {
        if (!a.date) return 1;
        if (!b.date) return -1;
        return new Date(b.date) - new Date(a.date);
      });
      
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedResults = filteredResults.slice(startIndex, endIndex);
      
      let userLikes = [];
      let userLikedAccounts = [];
      if (userId) {
        userLikes = await Like.find({ userId, tweetId: { $exists: true } }).distinct('tweetId');
        userLikedAccounts = await Like.find({ userId, accountUsername: { $exists: true } }).distinct('accountUsername');
      }
      const enrichedResults = paginatedResults.map(tweet => 
        enrichTweet(tweet, userLikes, userLikedAccounts, formatTweetText)
      );
      
      const uniqueAccounts = {};
      filteredResults.forEach(tweet => {
        if (!hiddenAccounts.includes(tweet.compte)) {
          uniqueAccounts[tweet.compte] = (uniqueAccounts[tweet.compte] || 0) + 1;
        }
      });
  
      const sortedAccounts = Object.entries(uniqueAccounts)
        .map(([account, count]) => ({ account, count }))
        .sort((a, b) => b.count - a.count)

      return {
        tweets: enrichedResults,
        currentPage: page,
        totalPages: Math.ceil(filteredResults.length / pageSize),
        totalResults: filteredResults.length,
        allAccounts: sortedAccounts,
        favoriteAccounts: userLikedAccounts
      };
    } catch (error) {
      console.error('Error searching tweets:', error);
      throw error;
    }
  }

  async getPaginatedTweets(page = 1, formatTweetText, searchQuery = '', userId) {
    try {
      let allTweets = await this.getAllTweets(true, userId);

      // Masquer les réponses ici aussi pour garantir la cohérence
      allTweets = allTweets.filter(tweet => !tweet.reply && !tweet.reply_to);

      if (searchQuery) {
        const searchRegex = new RegExp(searchQuery, 'i');
        allTweets = allTweets.filter(tweet => searchRegex.test(tweet.compte));
      }

      const startIndex = (page - 1) * this.tweetsPerPage;
      const endIndex = startIndex + this.tweetsPerPage;

      // Trier les tweets par date (du plus récent au plus ancien)
      allTweets.sort((a, b) => {
        if (!a.date) return 1;
        if (!b.date) return -1;
        return new Date(b.date) - new Date(a.date);
      });
      
      const hiddenAccounts = getHiddenAccounts();
      let userLikedAccounts = [];
      if (userId) {
        userLikedAccounts = await Like.find({ userId, accountUsername: { $exists: true } }).distinct('accountUsername');
      }
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
        tweets: allTweets.slice(startIndex, endIndex),
        currentPage: page,
        totalPages: Math.ceil(allTweets.length / this.tweetsPerPage),
        allAccounts: sortedAccounts,
        favoriteAccounts: userLikedAccounts
      };
    } catch (error) {
      console.error('Error getting paginated tweets:', error);
      throw error;
    }
  }

  async getUniqueAccounts(userId = null) {
    try {
      const allTweets = await this.getAllTweets(true, userId);
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

  async getTweetsWithMedia(page = 1, userId = null) {
    try {
      const allTweets = await this.getAllTweets(true, userId);
      
      const mediaTweets = allTweets.filter(tweet => 
        (tweet.media && tweet.media.length > 0) || 
        (tweet.video && tweet.video.length > 0)
      );
      
      mediaTweets.sort((a, b) => {
        if (!a.date) return 1;
        if (!b.date) return -1;
        return new Date(b.date) - new Date(a.date);
      });
      
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

  async getTweetsWithVideos(page = 1, userId = null) {
    try {
      const allTweets = await this.getAllTweets(true, userId);
      
      const videoTweets = allTweets.filter(tweet => 
        tweet.video && tweet.video.length > 0
      );
      
      videoTweets.sort((a, b) => {
        if (!a.date) return 1;
        if (!b.date) return -1;
        return new Date(b.date) - new Date(a.date);
      });
      
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

  async getFavoriteTweets(userId) {
    try {
      const allTweets = await this.getAllTweets(false, userId); // Do not filter hidden accounts here
      const userLikes = await Like.find({ userId, tweetId: { $exists: true } }).distinct('tweetId');
      const favoriteTweets = allTweets.filter(tweet => userLikes.includes(tweet.id));
      const favoriteAccounts = await Like.find({ userId, accountUsername: { $exists: true } }).distinct('accountUsername');
      return { tweets: favoriteTweets, favoriteAccounts: favoriteAccounts };
    } catch (error) {
      console.error('Error getting favorite tweets:', error);
      throw error;
    }
  }

  async getFavoriteAccountsTweets(userId) {
    try {
      const allTweets = await this.getAllTweets(false, userId); // Do not filter hidden accounts here
      const favoriteAccounts = await Like.find({ userId, accountUsername: { $exists: true } }).distinct('accountUsername');
      let favoriteAccountTweets = allTweets.filter(tweet => favoriteAccounts.includes(tweet.compte));
      
      // Trier les tweets par date (du plus récent au plus ancien)
      favoriteAccountTweets.sort((a, b) => {
        if (!a.date) return 1;
        if (!b.date) return -1;
        return new Date(b.date) - new Date(a.date);
      });
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

  async searchTweetsAndRender(query, userId = null) {
    try {
      const allTweets = await this.getAllTweets(true, userId);
      const searchResults = allTweets.filter(tweet => {
        const tweetText = tweet.texte ? tweet.texte.toLowerCase() : '';
        const hashtags = tweet.hashtags ? tweet.hashtags.map(tag => tag.text.toLowerCase()) : [];
        
        return tweetText.includes(query.toLowerCase()) || hashtags.some(tag => tag.includes(query.toLowerCase()));
      });
      const favoriteAccounts = await Like.find({ userId, accountUsername: { $exists: true } }).distinct('accountUsername');
      const uniqueAccounts = allTweets.map(tweet => tweet.compte).filter((value, index, self) => self.indexOf(value) === index).sort();
      return { tweets: searchResults, allAccounts: uniqueAccounts, favoriteAccounts: favoriteAccounts };
    } catch (error) {
      console.error('Error searching tweets for rendering:', error);
      throw error;
    }
  }

  async getProfileMedia(username, page = 1, formatTweetText, tweetServiceInstance, userId = null) {
    try {
      let userTweets = await this.getTweetsByUsername(username, 1, 1000, formatTweetText, tweetServiceInstance, '', userId); // Get all tweets for user
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

  async getProfileVideos(username, page = 1, userId = null) {
    try {
      let userTweets = await this.getTweetsByUsername(username, 1, 1000, null, null, '', userId); // Get all tweets for user
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

  async getProfileData(username, page = 1, searchQuery = '', userId = null) {
    try {
      let userTweets = await this.getTweetsByUsername(username, 1, 1000, null, null, searchQuery, userId); // Get all tweets for user
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

  async getAllMedia(page = 1, userId = null) {
    try {
      const allTweets = await this.getAllTweets(true, userId);

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
    throw new Error('addFavorite is deprecated. Use addLike instead.');
  }

  async removeFavorite(tweetId) {
    throw new Error('removeFavorite is deprecated. Use removeLike instead.');
  }

  async addMultipleFavorites(tweetIds) {
    throw new Error('addMultipleFavorites is deprecated. Use addMultipleLikes instead.');
  }

  async getTweetsWithMediaByUsername(username, page = 1, pageSize = 10, userId = null) {
    try {
      const { tweets } = await this.getTweetsByUsername(username, page, pageSize, null, null, '', userId); // Get all tweets for user
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

  async addLike(userId, tweetId = null, accountUsername = null) {
    try {
      if (tweetId) {
        await Like.findOneAndUpdate(
          { userId, tweetId },
          { $set: { userId, tweetId } },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      } else if (accountUsername) {
        await Like.findOneAndUpdate(
          { userId, accountUsername },
          { $set: { userId, accountUsername } },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      }
      return true;
    } catch (error) {
      console.error('Error adding like:', error);
      throw error;
    }
  }

  async removeLike(userId, tweetId = null, accountUsername = null) {
    try {
      if (tweetId) {
        await Like.deleteOne({ userId, tweetId });
      } else if (accountUsername) {
        await Like.deleteOne({ userId, accountUsername });
      }
      return true;
    } catch (error) {
      console.error('Error removing like:', error);
      throw error;
    }
  }

  async addMultipleLikes(userId, tweetIds) {
    try {
      const likes = tweetIds.map(tweetId => ({ userId, tweetId }));
      await Like.insertMany(likes, { ordered: false });
      return true;
    } catch (error) {
      console.error('Error adding multiple likes:', error);
      throw error;
    }
  }

  async createTweet(tweetData) {
    try {
      const collection = await this.getCollection();
      const newTweet = {
        id: new Date().getTime().toString(),
        ...tweetData,
        date: new Date().toISOString(),
      };
      await collection.insertOne(newTweet);
      return newTweet;
    } catch (error) {
      console.error('Error creating tweet:', error);
      throw error;
    }
  }

  async getFavoriteAccountsMedia(userId, page = 1) {
    try {
      const allTweets = await this.getAllTweets(false, userId); // Do not filter hidden accounts here
      const favoriteAccounts = await Like.find({ userId, accountUsername: { $exists: true } }).distinct('accountUsername');
      let favoriteAccountTweets = allTweets.filter(tweet => favoriteAccounts.includes(tweet.compte));

      const mediaTweets = favoriteAccountTweets.filter(tweet => 
        (tweet.media && tweet.media.length > 0) || 
        (tweet.video && tweet.video.length > 0)
      );

      mediaTweets.sort((a, b) => {
        if (!a.date) return 1;
        if (!b.date) return -1;
        return new Date(b.date) - new Date(a.date);
      });

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
      console.error('Error getting favorite accounts media:', error);
      throw error;
    }
  }
}

module.exports = new TweetService();