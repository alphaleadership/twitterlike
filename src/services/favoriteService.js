const { getFavorites, updateFavorites } = require('../utils/fileUtils');

class FavoriteService {
  async getFavorites() {
    try {
      return getFavorites();
    } catch (error) {
      console.error('Error getting favorites:', error);
      throw error;
    }
  }

  async addFavorite(tweetId) {
    try {
      return await updateFavorites(tweetId, 'add');
    } catch (error) {
      console.error(`Error adding favorite ${tweetId}:`, error);
      throw error;
    }
  }

  async removeFavorite(tweetId) {
    try {
      return await updateFavorites(tweetId, 'remove');
    } catch (error) {
      console.error(`Error removing favorite ${tweetId}:`, error);
      throw error;
    }
  }

  async isFavorite(tweetId) {
    try {
      const favorites = await this.getFavorites();
      return favorites.includes(tweetId);
    } catch (error) {
      console.error(`Error checking if ${tweetId} is favorite:`, error);
      throw error;
    }
  }
}

module.exports = new FavoriteService();
