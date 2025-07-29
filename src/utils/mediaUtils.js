const videofilter = (tweet) => {
  let all = {};
  if (!tweet.video) return [];

  tweet.video.forEach(v => {
    const key = v.media_object.expanded_url.split('/').pop();
    if (!all[key]) {
      all[key] = [];
    }
    const match = v.lien.match(/\/(\d+x\d+)\//);
    if (match) {
      v.resolution = parseInt(match[1].split('x')[0]) * parseInt(match[1].split('x')[1]);
    }
    all[key].push(v);
  });

  let good = [];
  Object.entries(all).forEach(([key, value]) => {
    value.sort((a, b) => b.resolution - a.resolution);
    good.push({ ...value[0], type: 'video' });
  });
  return good;
};

const enrichTweet = (tweet, userLikes, userLikedAccounts, formatTextFunction, tweetService) => {
  // Check if it's a retweet
  if (tweet.retweeted_status) {
    const originalTweet = tweet.retweeted_status;
    originalTweet.isRetweet = false; // Mark original as not a retweet
    return {
      ...enrichTweet(originalTweet, userLikes, userLikedAccounts, formatTextFunction, tweetService), // Recursively enrich original tweet
      isRetweet: true,
      retweetedBy: tweet.compte // Add who retweeted it
    };
  }

  let allMedia = [];
  if (tweet.media) {
    allMedia = allMedia.concat(tweet.media.filter(m => m.type === 'photo'));
  }
  if (tweet.video && tweet.video.length > 0) {
    allMedia = allMedia.concat(videofilter(tweet));
  }
  tweet.allMedia = allMedia;
  tweet.isLiked = userLikes.includes(tweet.id);
  tweet.isAccountLiked = userLikedAccounts.includes(tweet.compte);

  // Format quote if it exists
  if (tweet.quote) {
    const twitterUrlMatch = tweet.quote.match(/https?:\/\/(?:www\.)?twitter\.com\/\w+\/status\/(\d+)/);
    if (twitterUrlMatch && tweetService) {
      const quotedTweetId = twitterUrlMatch[1];
      // We need to fetch the quoted tweet here. This will be done in tweetService.
      // For now, just store the ID and a flag.
      tweet.quotedTweetId = quotedTweetId;
    } else if (formatTextFunction) {
      tweet.formattedQuote = formatTextFunction(tweet.quote);
    }
  }

  return tweet;
};

module.exports = {
  videofilter,
  enrichTweet
};