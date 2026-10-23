const { getHiddenAccounts, updateHiddenAccounts } = require('../utils/fileUtils');
const Like = require('../models/Like');

class AccountService {
  async getAccounts(userId = null) {
    try {
      const hiddenAccounts = getHiddenAccounts();
      let favoriteAccounts = [];
      
      if (userId) {
        favoriteAccounts = await Like.find({ userId, accountUsername: { $exists: true } }).distinct('accountUsername');
      }
      
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

  async addFavoriteAccount(userId, username) {
    try {
      if (!userId) throw new Error('User ID is required to add favorite account');
      await Like.findOneAndUpdate(
        { userId, accountUsername: username },
        { $set: { userId, accountUsername: username } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      return true;
    } catch (error) {
      console.error(`Error adding favorite account ${username}:`, error);
      throw error;
    }
  }

  async removeFavoriteAccount(userId, username) {
    try {
      if (!userId) throw new Error('User ID is required to remove favorite account');
      await Like.deleteOne({ userId, accountUsername: username });
      return true;
    } catch (error) {
      console.error(`Error removing favorite account ${username}:`, error);
      throw error;
    }
  }
}

module.exports = new AccountService();