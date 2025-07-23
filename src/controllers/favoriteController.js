const favoriteService = require('../services/favoriteService');

const favoriteController = {
  async getFavorites(req, res) {
    try {
      const favorites = await favoriteService.getFavorites();
      res.json({ favorites });
    } catch (error) {
      console.error('Error getting favorites:', error);
      res.status(500).json({ error: 'Error fetching favorites' });
    }
  },

  async addFavorite(req, res) {
    try {
      const { id } = req.params;
      await favoriteService.addFavorite(id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error adding favorite:', error);
      res.status(500).json({ error: 'Error adding favorite' });
    }
  },

  async removeFavorite(req, res) {
    try {
      const { id } = req.params;
      await favoriteService.removeFavorite(id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error removing favorite:', error);
      res.status(500).json({ error: 'Error removing favorite' });
    }
  },

  async checkFavorite(req, res) {
    try {
      const { id } = req.params;
      const isFavorite = await favoriteService.isFavorite(id);
      res.json({ isFavorite });
    } catch (error) {
      console.error('Error checking favorite status:', error);
      res.status(500).json({ error: 'Error checking favorite status' });
    }
  }
};

module.exports = favoriteController;
