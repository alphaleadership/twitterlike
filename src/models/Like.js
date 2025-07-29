const mongoose = require('mongoose');

const LikeSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    tweetId: {
        type: String,
        required: false // Not required if it's an account like
    },
    accountUsername: {
        type: String,
        required: false // Not required if it's a tweet like
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Ensure that a user can only like a tweet or an account once
LikeSchema.index({ userId: 1, tweetId: 1 }, { unique: true, partialFilterExpression: { tweetId: { $exists: true } } });
LikeSchema.index({ userId: 1, accountUsername: 1 }, { unique: true, partialFilterExpression: { accountUsername: { $exists: true } } });

module.exports = mongoose.model('Like', LikeSchema);