const tweetService = require('../services/tweetService');
const accountService = require('../services/accountService');
const fileUtils = require('../utils/fileUtils');
const Admin = require('../models/Admin');
const User = require('../models/User'); // Import User model

const adminController = {
    renderLogin(req, res) {
        res.render('admin/login', { title: 'Login', error: req.query.error, layout: false });
    },

    async login(req, res) {
        const { username, password } = req.body;
        try {
            const admin = await Admin.findOne({ username });
            if (!admin) {
                return res.redirect('/admin/login?error=Invalid credentials');
            }

            const isMatch = await admin.comparePassword(password);
            if (!isMatch) {
                return res.redirect('/admin/login?error=Invalid credentials');
            }

            req.session.isAdmin = true;
            res.redirect('/admin');
        } catch (error) {
            console.error('Error during admin login:', error);
            res.status(500).send('Server error during login');
        }
    },

    logout(req, res) {
        req.session.destroy(err => {
            if (err) {
                console.error('Error destroying session:', err);
                return res.status(500).send('Could not log out.');
            }
            res.redirect('/admin/login');
        });
    },

    async renderDashboard(req, res) {
        res.render('admin/dashboard', { title: 'Dashboard', layout: 'layouts/admin' });
    },

    async renderAccounts(req, res) {
        try {
            const allAccounts = await tweetService.getUniqueAccounts();
            const hiddenAccounts = fileUtils.getHiddenAccounts();
            res.render('admin/accounts', { title: 'Manage Accounts', allAccounts, hiddenAccounts, layout: 'layouts/admin' });
        } catch (error) {
            console.error('Error rendering admin accounts page:', error);
            res.status(500).send('Error loading accounts');
        }
    },

    async unhideAccount(req, res) {
        try {
            const username = req.params.username;
            fileUtils.updateHiddenAccounts(username, 'remove');
            res.redirect('/admin/accounts');
        } catch (error) {
            console.error('Error unhiding account:', error);
            res.status(500).send('Error unhiding account');
        }
    },

    async hideAccount(req, res) {
        try {
            const username = req.params.username;
            fileUtils.updateHiddenAccounts(username, 'add');
            res.redirect('/admin/accounts');
        } catch (error) {
            console.error('Error hiding account:', error);
            res.status(500).send('Error hiding account');
        }
    },

    async renderTweets(req, res) {
        try {
            const hiddenTweets = fileUtils.getHiddenTweets();
            res.render('admin/tweets', { title: 'Manage Tweets', hiddenTweets, layout: 'layouts/admin' });
        } catch (error) {
            console.error('Error rendering admin tweets page:', error);
            res.status(500).send('Error loading tweets');
        }
    },

    async unhideTweet(req, res) {
        try {
            const tweetId = req.params.id;
            fileUtils.updateHiddenTweets(tweetId, 'remove');
            res.redirect('/admin/tweets');
        } catch (error) {
            console.error('Error unhiding tweet:', error);
            res.status(500).send('Error unhiding tweet');
        }
    },

    async renderUsers(req, res) {
        try {
            const users = await User.find({});
            res.render('admin/users/list', { title: 'Manage Users', users, layout: 'layouts/admin' });
        } catch (error) {
            console.error('Error rendering users page:', error);
            res.status(500).send('Error loading users');
        }
    },

    renderAddUser(req, res) {
        res.render('admin/users/add', { title: 'Add User', error: null, layout: 'layouts/admin' });
    },

    async addUser(req, res) {
        const { username, password } = req.body;
        try {
            const newUser = new User({ username, password });
            await newUser.save();
            res.redirect('/admin/users');
        } catch (error) {
            console.error('Error adding user:', error);
            res.render('admin/users/add', { title: 'Add User', error: 'Error adding user. Username might already exist.' });
        }
    },

    async renderEditUser(req, res) {
        try {
            const user = await User.findById(req.params.id);
            if (!user) {
                return res.status(404).send('User not found');
            }
            res.render('admin/users/edit', { title: 'Edit User', user, error: null, layout: 'layouts/admin' });
        } catch (error) {
            console.error('Error rendering edit user page:', error);
            res.status(500).send('Error loading user');
        }
    },

    async editUser(req, res) {
        const { username, password } = req.body;
        try {
            const user = await User.findById(req.params.id);
            if (!user) {
                return res.status(404).send('User not found');
            }
            user.username = username;
            if (password) {
                user.password = password; // Hashing is handled by pre-save hook
            }
            await user.save();
            res.redirect('/admin/users');
        } catch (error) {
            console.error('Error editing user:', error);
            res.render('admin/users/edit', { title: 'Edit User', user, error: 'Error editing user. Username might already exist.' });
        }
    },

    async deleteUser(req, res) {
        try {
            await User.findByIdAndDelete(req.params.id);
            res.redirect('/admin/users');
        } catch (error) {
            console.error('Error deleting user:', error);
            res.status(500).send('Error deleting user');
        }
    },

    selectAccount(req, res) {
        const selectedAccount = req.query.selectedAccount;
        if (selectedAccount) {
            res.redirect(`/profile/${selectedAccount}`);
        } else {
            res.redirect('/admin/accounts');
        }
    }
};

module.exports = adminController;