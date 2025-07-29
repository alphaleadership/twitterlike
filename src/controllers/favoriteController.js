const tweetService = require('../services/tweetService');

const favoriteController = {
  async getFavorites(req, res) {
    try {
      const favorites = await tweetService.getFavoriteTweets(req.user.id);
      res.json({ favorites });
    } catch (error) {
      console.error('Error getting favorites:', error);
      res.status(500).json({ error: 'Error fetching favorites' });
    }
  },

  async addFavorite(req, res) {
    try {
      const { id } = req.params;
      await tweetService.addLike(req.user.id, id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error adding favorite:', error);
      res.status(500).json({ error: 'Error adding favorite' });
    }
  },

  async removeFavorite(req, res) {
    try {
      const { id } = req.params;
      await tweetService.removeLike(req.user.id, id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error removing favorite:', error);
      res.status(500).json({ error: 'Error removing favorite' });
    }
  }
};

module.exports = favoriteController;
