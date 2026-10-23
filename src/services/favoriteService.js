const Like = require('../models/Like');

class FavoriteService {
  async getFavorites(userId) {
    try {
      if (!userId) return [];
      return await Like.find({ userId, tweetId: { $exists: true } }).distinct('tweetId');
    } catch (error) {
      console.error('Error getting favorites:', error);
      throw error;
    }
  }

  async addFavorite(userId, tweetId) {
    try {
      if (!userId) throw new Error('User ID is required');
      await Like.findOneAndUpdate(
        { userId, tweetId },
        { $set: { userId, tweetId } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      return true;
    } catch (error) {
      console.error(`Error adding favorite ${tweetId}:`, error);
      throw error;
    }
  }

  async removeFavorite(userId, tweetId) {
    try {
      if (!userId) throw new Error('User ID is required');
      await Like.deleteOne({ userId, tweetId });
      return true;
    } catch (error) {
      console.error(`Error removing favorite ${tweetId}:`, error);
      throw error;
    }
  }

  async isFavorite(userId, tweetId) {
    try {
      if (!userId) return false;
      const favorite = await Like.findOne({ userId, tweetId });
      return !!favorite;
    } catch (error) {
      console.error(`Error checking if ${tweetId} is favorite:`, error);
      throw error;
    }
  }
}

module.exports = new FavoriteService();
