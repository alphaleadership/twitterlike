const { getHiddenAccounts, getFavoriteAccounts, updateHiddenAccounts, updateFavoriteAccounts } = require('../utils/fileUtils');

class AccountService {
  async getAccounts() {
    try {
      const hiddenAccounts = getHiddenAccounts();
      const favoriteAccounts = getFavoriteAccounts();
      
      return {
        hidden: hiddenAccounts,
        favorites: favoriteAccounts
      };
    } catch (error) {
      console.error('Error getting accounts:', error);
      throw error;
    }
  }

  async hideAccount(username) {
    try {
      return await updateHiddenAccounts(username, 'add');
    } catch (error) {
      console.error(`Error hiding account ${username}:`, error);
      throw error;
    }
  }

  async showAccount(username) {
    try {
      return await updateHiddenAccounts(username, 'remove');
    } catch (error) {
      console.error(`Error showing account ${username}:`, error);
      throw error;
    }
  }

  async addFavoriteAccount(username) {
    try {
      return await updateFavoriteAccounts(username, 'add');
    } catch (error) {
      console.error(`Error adding favorite account ${username}:`, error);
      throw error;
    }
  }

  async removeFavoriteAccount(username) {
    try {
      return await updateFavoriteAccounts(username, 'remove');
    } catch (error) {
      console.error(`Error removing favorite account ${username}:`, error);
      throw error;
    }
  }
}

module.exports = new AccountService();