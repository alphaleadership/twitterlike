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

const enrichTweet = (tweet, favorites, favoriteAccounts) => {
  let allMedia = [];
  if (tweet.media) {
    allMedia = allMedia.concat(tweet.media.filter(m => m.type === 'photo'));
  }
  if (tweet.video && tweet.video.length > 0) {
    allMedia = allMedia.concat(videofilter(tweet));
  }
  tweet.allMedia = allMedia;
  tweet.isFavorite = favorites.includes(tweet.id);
  tweet.isFavoriteAccount = favoriteAccounts.includes(tweet.compte);
  return tweet;
};

module.exports = {
  videofilter,
  enrichTweet
};