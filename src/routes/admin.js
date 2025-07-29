const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const adminAuth = require('../middleware/adminAuth');

// Admin Login Routes
router.get('/login', adminController.renderLogin);
router.post('/login', adminController.login);
router.post('/logout', adminController.logout);

// Admin Dashboard (protected)
router.get('/', adminAuth, adminController.renderDashboard);

// Admin Accounts Management (protected)
router.get('/accounts', adminAuth, adminController.renderAccounts);
router.post('/accounts/unhide/:username', adminAuth, adminController.unhideAccount);
router.post('/accounts/hide/:username', adminAuth, adminController.hideAccount);

// Admin Tweets Management (protected)
router.get('/tweets', adminAuth, adminController.renderTweets);
router.post('/tweets/unhide/:id', adminAuth, adminController.unhideTweet);

// Admin User Management (protected)
router.get('/users', adminAuth, adminController.renderUsers);
router.get('/users/add', adminAuth, adminController.renderAddUser);
router.post('/users/add', adminAuth, adminController.addUser);
router.get('/users/edit/:id', adminAuth, adminController.renderEditUser);
router.post('/users/edit/:id', adminAuth, adminController.editUser);
router.post('/users/delete/:id', adminAuth, adminController.deleteUser);

module.exports = router;