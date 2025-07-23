const { getDb } = require('../config/db');
const { getHiddenAccounts, getFavorites, getFavoriteAccounts, updateFavorites, appendAccountToFile } = require('../utils/fileUtils');
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
        tweets = tweets.filter(tweet => !hiddenAccounts.includes(tweet.compte));
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

  async getTweetById(tweetId) {
    try {
      const collection = await this.getCollection();
      let tweet = await collection.findOne({ id: tweetId });
      if (tweet) {
        const favorites = getFavorites();
        const favoriteAccounts = getFavoriteAccounts();
        tweet = enrichTweet(tweet, favorites, favoriteAccounts);
      }
      return tweet;
    } catch (error) {
      console.error(`Error getting tweet by ID ${tweetId}:`, error);
      throw error;
    }
  }

  async getTweetsByUsername(username, page = 1, pageSize = 10) {
    try {
      const collection = await this.getCollection();
      const allTweets = await collection.find({ compte: username }).toArray();
      
      allTweets.sort((a, b) => new Date(b.date) - new Date(a.date));
      
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedTweets = allTweets.slice(startIndex, endIndex);
      
      const favorites = getFavorites();
      const favoriteAccounts = getFavoriteAccounts();
      const enrichedTweets = paginatedTweets.map(tweet => 
        enrichTweet(tweet, favorites, favoriteAccounts)
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

  async searchTweets(query, page = 1, pageSize = 10) {
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
      
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedResults = allResults.slice(startIndex, endIndex);
      
      const favorites = getFavorites();
      const favoriteAccounts = getFavoriteAccounts();
      const enrichedResults = paginatedResults.map(tweet => 
        enrichTweet(tweet, favorites, favoriteAccounts)
      );
      
      return {
        tweets: enrichedResults,
        currentPage: page,
        totalPages: Math.ceil(allResults.length / pageSize),
        totalResults: allResults.length
      };
    } catch (error) {
      console.error('Error searching tweets:', error);
      throw error;
    }
  }

  async getPaginatedTweets(page = 1) {
    try {
      const allTweets = await this.getAllTweets();
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
        .sort((a, b) => b.count - a.count).map(account => account.account);

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
        .map(([account, count]) => ({ account, count }))
        .sort((a, b) => b.count - a.count)
        .map(item => item.account);
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
      const uniqueAccounts = allTweets.map(tweet => tweet.compte).filter((value, index, self) => self.indexOf(value) === index).sort();
      return { tweets: favoriteAccountTweets, favoriteAccounts: favoriteAccounts, allAccounts: uniqueAccounts };
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

  async getProfileMedia(username, page = 1) {
    try {
      let userTweets = await this.getTweetsByUsername(username, 1, 1000); // Get all tweets for user
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

  async getProfileData(username, page = 1) {
    try {
      let userTweets = await this.getTweetsByUsername(username, 1, 1000); // Get all tweets for user
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
}

module.exports = new TweetService();