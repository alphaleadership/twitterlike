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
    this._cachedTotalTweets = null;
    this._cachedTotalTweetsTime = 0;
  }

  async getTotalTweetsCount(collection, query, searchQuery = '') {
    const now = Date.now();
    if (!searchQuery && this._cachedTotalTweets && (now - this._cachedTotalTweetsTime < 120000)) {
      return this._cachedTotalTweets;
    }
    const count = await collection.countDocuments(query);
    if (!searchQuery) {
      this._cachedTotalTweets = count;
      this._cachedTotalTweetsTime = now;
    }
    return count;
  }


  async getCollection() {
    const db = getDb();
    return db.collection(this.collectionName);
  }

  async getAllTweets(filterHidden = true, userId = null) {
    try {
      const collection = await this.getCollection();
      let tweets = await collection.find({}).sort({ date: -1 }).toArray();

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
                const words = searchQuery.trim().split(/\s+/).filter(word => word.length > 0);
                if (words.length > 0) {
                  const searchQueries = words.map(word => {
                    const searchRegex = new RegExp(word, 'i');
                    return {
                                  $or: [
                                    { texte: { $regex: searchRegex } },
                                    { 'hashtags.text': { $regex: searchRegex } },
                                    { 'retweeted_status.texte': { $regex: searchRegex } },
                                    { 'retweeted_status.compte': { $regex: searchRegex } }
                                  ]                    };
                  });
                  query.$and = [...(query.$and || []), ...searchQueries];
                }
              }      const totalTweets = await this.getTotalTweetsCount(collection, query, searchQuery);
      const totalPages = Math.ceil(totalTweets / pageSize);
      const skip = (page - 1) * pageSize;

      const paginatedTweets = await collection.find(query)
        .sort({ date: -1 })
        .skip(skip)
        .limit(pageSize)
        .toArray();
      
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
        totalPages: totalPages || 1,
        totalTweets: totalTweets
      };
    } catch (error) {
      console.error(`Error getting tweets for user ${username}:`, error);
      throw error;
    }
  }

  async searchTweets(query, page = 1, pageSize = 10, formatTweetText, userId = null) {
    try {
      const collection = await this.getCollection();
      const hiddenAccounts = getHiddenAccounts();
      const hiddenTweets = getHiddenTweets();
      
      const words = query.trim().split(/\s+/).filter(word => word.length > 0);
      const searchQueries = words.map(word => {
        const searchRegex = new RegExp(word, 'i');
        return {
          $or: [
            { texte: { $regex: searchRegex } },
            { 'hashtags.text': { $regex: searchRegex } },
            { compte: { $regex: searchRegex } },
            { 'retweeted_status.texte': { $regex: searchRegex } },
            { 'retweeted_status.compte': { $regex: searchRegex } }
          ]
        };
      });

      const dbQuery = {
        $and: [
          ...(searchQueries.length > 0 ? searchQueries : [{}]),
          { compte: { $nin: hiddenAccounts } },
          { id: { $nin: hiddenTweets } }
        ]
      };

      const totalResults = await collection.countDocuments(dbQuery);
      const totalPages = Math.ceil(totalResults / pageSize);
      const skip = (page - 1) * pageSize;

      const results = await collection.find(dbQuery)
        .sort({ date: -1 })
        .skip(skip)
        .limit(pageSize)
        .toArray();
      
      let userLikes = [];
      let userLikedAccounts = [];
      if (userId) {
        userLikes = await Like.find({ userId, tweetId: { $exists: true } }).distinct('tweetId');
        userLikedAccounts = await Like.find({ userId, accountUsername: { $exists: true } }).distinct('accountUsername');
      }
      const enrichedResults = results.map(tweet => 
        enrichTweet(tweet, userLikes, userLikedAccounts, formatTweetText)
      );
      
      // Lightweight aggregation for sidebar stats
      const accountStats = await collection.aggregate([
        { $match: dbQuery },
        { $group: { _id: "$compte", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 50 }
      ]).toArray();
  
      const sortedAccounts = accountStats.map(s => ({ account: s._id, count: s.count }));

      return {
        tweets: enrichedResults,
        currentPage: page,
        totalPages: totalPages || 1,
        totalResults: totalResults,
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
      const collection = await this.getCollection();
      const hiddenAccounts = getHiddenAccounts();
      const hiddenTweets = getHiddenTweets();

      const query = {
        reply: { $ne: true },
        reply_to: { $ne: true },
        compte: { $nin: hiddenAccounts },
        id: { $nin: hiddenTweets }
      };

      if (searchQuery) {
        const words = searchQuery.trim().split(/\s+/).filter(word => word.length > 0);
        if (words.length > 0) {
          const searchQueries = words.map(word => {
            const searchRegex = new RegExp(word, 'i');
            return {
              $or: [
                { compte: { $regex: searchRegex } },
                { texte: { $regex: searchRegex } },
                { 'hashtags.text': { $regex: searchRegex } },
                { 'retweeted_status.texte': { $regex: searchRegex } },
                { 'retweeted_status.compte': { $regex: searchRegex } }
              ]
            };
          });
          query.$and = [...(query.$and || []), ...searchQueries];
        }
      }

      const totalTweets = await this.getTotalTweetsCount(collection, query, searchQuery);
      const totalPages = Math.ceil(totalTweets / this.tweetsPerPage);
      const skip = (page - 1) * this.tweetsPerPage;

      const tweets = await collection.find(query)
        .sort({ date: -1 })
        .skip(skip)
        .limit(this.tweetsPerPage)
        .toArray();

      let userLikedAccounts = [];
      let userLikes = [];
      if (userId) {
        userLikes = await Like.find({ userId, tweetId: { $exists: true } }).distinct('tweetId');
        userLikedAccounts = await Like.find({ userId, accountUsername: { $exists: true } }).distinct('accountUsername');
      }

      const enrichedTweets = tweets.map(tweet =>
        enrichTweet(tweet, userLikes, userLikedAccounts, formatTweetText, this)
      );

      // We don't return allAccounts here anymore as it's heavy and handled separately by getUniqueAccounts
      return {
        tweets: enrichedTweets,
        currentPage: page,
        totalPages: totalPages || 1,
        allAccounts: [],
        favoriteAccounts: userLikedAccounts
      };
    } catch (error) {
      console.error('Error getting paginated tweets:', error);
      throw error;
    }
  }

  async getTweetsCursor(page = 1, searchQuery = '', pageSize = this.tweetsPerPage) {
    try {
      const collection = await this.getCollection();
      const hiddenAccounts = getHiddenAccounts();
      const hiddenTweets = getHiddenTweets();

      const query = {
        reply: { $ne: true },
        reply_to: { $ne: true },
        compte: { $nin: hiddenAccounts },
        id: { $nin: hiddenTweets }
      };

      if (searchQuery) {
        const words = searchQuery.trim().split(/\s+/).filter(word => word.length > 0);
        if (words.length > 0) {
          const searchQueries = words.map(word => {
            const searchRegex = new RegExp(word, 'i');
            return {
              $or: [
                { compte: { $regex: searchRegex } },
                { texte: { $regex: searchRegex } },
                { 'hashtags.text': { $regex: searchRegex } },
                { 'retweeted_status.texte': { $regex: searchRegex } },
                { 'retweeted_status.compte': { $regex: searchRegex } }
              ]
            };
          });
          query.$and = [...(query.$and || []), ...searchQueries];
        }
      }

      const totalTweets = await collection.countDocuments(query);
      const totalPages = Math.ceil(totalTweets / pageSize);
      const skip = (page - 1) * pageSize;

      const cursor = collection.find(query)
        .sort({ date: -1 })
        .skip(skip)
        .limit(pageSize);

      return { cursor, totalTweets, totalPages, currentPage: page };
    } catch (error) {
      console.error('Error getting tweets cursor:', error);
      throw error;
    }
  }

  async getUniqueAccounts(userId = null) {
    try {
      const collection = await this.getCollection();
      const hiddenAccounts = getHiddenAccounts();

      const pipeline = [
        { $match: { compte: { $nin: hiddenAccounts } } },
        { $group: { _id: "$compte", count: { $sum: 1 } } },
        { $match: { count: { $gt: 10 } } },
        { $sort: { count: -1 } }
      ];

      const results = await collection.aggregate(pipeline).toArray();

      return results.map(r => ({ account: r._id, count: r.count }));

    } catch (error) {
      console.error('Error getting unique accounts:', error);
      throw error;
    }
  }

  async getTweetsWithMedia(page = 1, userId = null) {
    try {
      const collection = await this.getCollection();
      const hiddenAccounts = getHiddenAccounts();
      const hiddenTweets = getHiddenTweets();

      const query = {
        $and: [
          {
            $or: [
              { "media.0": { $exists: true } },
              { "video.0": { $exists: true } }
            ]
          },
          { compte: { $nin: hiddenAccounts } },
          { id: { $nin: hiddenTweets } }
        ]
      };

      const totalMedia = await collection.countDocuments(query);
      const totalPages = Math.ceil(totalMedia / this.mediaPerPage);
      const skip = (page - 1) * this.mediaPerPage;

      const tweets = await collection.find(query)
        .sort({ date: -1 })
        .skip(skip)
        .limit(this.mediaPerPage)
        .toArray();
      
      let userLikes = [];
      let userLikedAccounts = [];
      if (userId) {
        userLikes = await Like.find({ userId, tweetId: { $exists: true } }).distinct('tweetId');
        userLikedAccounts = await Like.find({ userId, accountUsername: { $exists: true } }).distinct('accountUsername');
      }

      const enrichedTweets = tweets.map(tweet => 
        enrichTweet(tweet, userLikes, userLikedAccounts, null, this)
      );
      
      return {
        tweets: enrichedTweets,
        currentPage: page,
        totalPages: totalPages || 1,
        totalMedia: totalMedia
      };
    } catch (error) {
      console.error('Error getting tweets with media:', error);
      throw error;
    }
  }

  async getTweetsWithVideos(page = 1, userId = null) {
    try {
      const collection = await this.getCollection();
      const hiddenAccounts = getHiddenAccounts();
      const hiddenTweets = getHiddenTweets();

      const query = {
        $and: [
          { "video.0": { $exists: true } },
          { compte: { $nin: hiddenAccounts } },
          { id: { $nin: hiddenTweets } }
        ]
      };

      const totalVideos = await collection.countDocuments(query);
      const totalPages = Math.ceil(totalVideos / this.videosPerPage);
      const skip = (page - 1) * this.videosPerPage;

      const tweets = await collection.find(query)
        .sort({ date: -1 })
        .skip(skip)
        .limit(this.videosPerPage)
        .toArray();
      
      let userLikes = [];
      let userLikedAccounts = [];
      if (userId) {
        userLikes = await Like.find({ userId, tweetId: { $exists: true } }).distinct('tweetId');
        userLikedAccounts = await Like.find({ userId, accountUsername: { $exists: true } }).distinct('accountUsername');
      }

      const enrichedTweets = tweets.map(tweet => 
        enrichTweet(tweet, userLikes, userLikedAccounts, null, this)
      );
      
      return {
        tweets: enrichedTweets,
        currentPage: page,
        totalPages: totalPages || 1,
        totalVideos: totalVideos
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
      favoriteTweets.sort((a, b) => {
        if (!a.date) return 1;
        if (!b.date) return -1;
        return new Date(b.date) - new Date(a.date);
      });
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