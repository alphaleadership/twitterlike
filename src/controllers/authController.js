const User = require('../models/User');

const authController = {
    renderLogin(req, res) {
        res.render('login', { error: req.query.error });
    },

    async login(req, res) {
        const { username, password } = req.body;
        try {
            const user = await User.findOne({ username });
            if (!user) {
                return res.redirect('/login?error=Invalid credentials');
            }

            const isMatch = await user.comparePassword(password);
            if (!isMatch) {
                return res.redirect('/login?error=Invalid credentials');
            }

            req.session.userId = user._id;
            req.session.username = user.username;
            res.redirect('/');
        } catch (error) {
            console.error('Error during user login:', error);
            res.status(500).send('Server error during login');
        }
    },

    logout(req, res) {
        req.session.destroy(err => {
            if (err) {
                console.error('Error destroying session:', err);
                return res.status(500).send('Could not log out.');
            }
            res.redirect('/login');
        });
    }
};

module.exports = authController;