const accountService = require('../services/accountService');

const accountController = {
  async getAccounts(req, res) {
    try {
      const accounts = await accountService.getAccounts();
      res.json(accounts);
    } catch (error) {
      console.error('Error getting accounts:', error);
      res.status(500).json({ error: 'Error fetching accounts' });
    }
  },

  async hideAccount(req, res) {
    try {
      const { username } = req.params;
      await accountService.hideAccount(username);
      res.json({ success: true });
    } catch (error) {
      console.error('Error hiding account:', error);
      res.status(500).json({ error: 'Error hiding account' });
    }
  },

  async showAccount(req, res) {
    try {
      const { username } = req.params;
      await accountService.showAccount(username);
      res.json({ success: true });
    } catch (error) {
      console.error('Error showing account:', error);
      res.status(500).json({ error: 'Error showing account' });
    }
  },

  async addFavoriteAccount(req, res) {
    try {
      const { username } = req.params;
      await accountService.addFavoriteAccount(username);
      res.json({ success: true });
    } catch (error) {
      console.error('Error adding favorite account:', error);
      res.status(500).json({ error: 'Error adding favorite account' });
    }
  },

  async removeFavoriteAccount(req, res) {
    try {
      const { username } = req.params;
      await accountService.removeFavoriteAccount(username);
      res.json({ success: true });
    } catch (error) {
      console.error('Error removing favorite account:', error);
      res.status(500).json({ error: 'Error removing favorite account' });
    }
  }
};

module.exports = accountController;
