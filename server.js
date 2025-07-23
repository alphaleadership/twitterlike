const express = require('express');
const path = require('path');
const fs = require('fs');
const { MongoClient } = require('mongodb');

require('dotenv').config();
const uri = process.env.MONGO_URI;
const dbName = 'twitter_db';
let tweetsCollection;

async function connectToMongo() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const database = client.db(dbName);
    tweetsCollection = database.collection('tweets');
    console.log('Connected to MongoDB');
  } catch (e) {
    console.error('Failed to connect to MongoDB', e);
    process.exit(1); // Exit if cannot connect to DB
  }
}

connectToMongo();

const app = express();
const port = 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use('/public', express.static(path.join(__dirname, 'public')));
app.use(express.json());

const hiddenAccountsPath = path.join(__dirname, 'hidden_accounts.json');
const favoritesPath = path.join(__dirname, 'favorites.json');
const videofilter=(tweet)=>{
  let all={}
  tweet.video.forEach(v => {
    
    if(Object.keys(all).includes(v.media_object.expanded_url.split('/').pop())){
      const match = v.lien.match(/\/(\d+x\d+)\//);
      if (match) {
        v.resolution = parseInt(match[1].split('x')[0]) * parseInt(match[1].split('x')[1]);
      }
      all[v.media_object.expanded_url.split('/').pop()].push(v)
    }
    else{
      const match = v.lien.match(/\/(\d+x\d+)\//);
      if (match) {
        v.resolution = parseInt(match[1].split('x')[0]) * parseInt(match[1].split('x')[1]);
      }
      all[v.media_object.expanded_url.split('/').pop()]=[v]
    }
  })
  let good=[]
  Object.entries(all).forEach(([key, value]) => {
   value.sort((a,b)=>b.resolution-a.resolution)
   good.push({ ...value[0], type: 'video' })
  })
  console.log('videofilter input for tweet:', tweet.id, tweet.video);
  console.log('videofilter output for tweet:', tweet.id, good);
  return good
}
const getHiddenAccounts = () => {
  try {
    const data = fs.readFileSync(hiddenAccountsPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
};

const getFavorites = () => {
  try {
    const data = fs.readFileSync(favoritesPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
};

const getTweets = async (tweetsToProcess = null) => {
  try {
    const hiddenAccounts = getHiddenAccounts();
    const favorites = getFavorites();
    const favoriteAccounts = getFavoriteAccounts();

    let tweets = tweetsToProcess || await tweetsCollection.find({}).toArray();

    tweets = tweets.filter(tweet => !hiddenAccounts.includes(tweet.compte));

    tweets = tweets.map(tweet => {
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
    });
    return tweets;
  } catch (error) {
    console.error('Error fetching or processing tweets:', error);
    return [];
  }
};

const tweetsPerPage = 10;

app.get('/', async (req, res) => {
  try {
    let allTweets = await tweetsCollection.find({}).toArray();
    allTweets = await getTweets(allTweets);
    const page = parseInt(req.query.page) || 1;
    const startIndex = (page - 1) * tweetsPerPage;
    const endIndex = startIndex + tweetsPerPage;

    const shuffledTweets = [...allTweets].sort(() => Math.random() - 0.5);
    const tweets = shuffledTweets.slice(startIndex, endIndex)
    const totalPages = Math.ceil(allTweets.length / tweetsPerPage);

    const hiddenAccounts = getHiddenAccounts();
    const favoriteAccounts = getFavoriteAccounts();
    const uniqueAccounts = {};
    allTweets.forEach(tweet => {
      if (!hiddenAccounts.includes(tweet.compte)) {
        uniqueAccounts[tweet.compte] = (uniqueAccounts[tweet.compte] || 0) + 1;
      }
    });

    const sortedAccounts = Object.entries(uniqueAccounts)
      .map(([account, count]) => ({ account, count }))
      .sort((a, b) => b.count - a.count).map(account => account.account);

    

    res.render('index', { 
      tweets: tweets,
      currentPage: page,
      totalPages: totalPages,
      formatTweetText: formatTweetText,
      allAccounts: sortedAccounts,
      favoriteAccounts: favoriteAccounts
    });
  } catch (err) {
    console.error('Error reading tweet data:', err);
    return res.status(500).send('Error reading tweet data');
  }
});
const getFavoriteAccounts = () => {
  try {
    const data = fs.readFileSync(path.join(__dirname, 'favorite_accounts.json'), 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
};

app.post('/favorite_account/:username', (req, res) => {
  const username = req.params.username;
  const favoriteAccounts = getFavoriteAccounts();
  if (!favoriteAccounts.includes(username)) {
    favoriteAccounts.push(username);
    fs.writeFileSync(path.join(__dirname, 'favorite_accounts.json'), JSON.stringify(favoriteAccounts, null, 2));
  }
  res.redirect('/');
});

app.post('/unfavorite_account/:username', (req, res) => {
  const username = req.params.username;
  let favoriteAccounts = getFavoriteAccounts();
  favoriteAccounts = favoriteAccounts.filter(account => account !== username);
  fs.writeFileSync(path.join(__dirname, 'favorite_accounts.json'), JSON.stringify(favoriteAccounts, null, 2));
  res.redirect('/');
});

function formatTweetText(text) {
  let formattedText = text.replace(/@(\w+)/g, '<a href="/profile/$1">@$1</a>');
  formattedText = formattedText.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');
  return formattedText;
}

app.post('/hide/:username', (req, res) => {
  const username = req.params.username;
  const hiddenAccounts = getHiddenAccounts();
  if (!hiddenAccounts.includes(username)) {
    hiddenAccounts.push(username);
    fs.writeFileSync(hiddenAccountsPath, JSON.stringify(hiddenAccounts, null, 2));
  }
  res.redirect('/');
});

app.post('/favorite/:id', (req, res) => {
  const tweetId = req.params.id;
  const favorites = getFavorites();
  if (!favorites.includes(tweetId)) {
    favorites.push(tweetId);
    fs.writeFileSync(favoritesPath, JSON.stringify(favorites, null, 2));
  }
  res.redirect('/');
});

app.post('/unfavorite/:id', (req, res) => {
  const tweetId = req.params.id;
  let favorites = getFavorites();
  favorites = favorites.filter(id => id !== tweetId);
  fs.writeFileSync(favoritesPath, JSON.stringify(favorites, null, 2));
  res.redirect('/');
});

app.get('/favorites', async (req, res) => {
  try {
    let allTweets = await tweetsCollection.find({}).toArray();
    allTweets = await getTweets(allTweets);
    const favorites = getFavorites();
    const favoriteTweets = allTweets.filter(tweet => favorites.includes(tweet.id));
    const favoriteAccounts = getFavoriteAccounts();
    res.render('favorites', { tweets: favoriteTweets, formatTweetText: formatTweetText, favoriteAccounts: favoriteAccounts });
  } catch (err) {
    console.error('Error reading tweet data:', err);
    res.status(500).send('Error reading tweet data');
  }
});

app.get('/favorite_accounts_tweets', async (req, res) => {
  try {
    let allTweets = await tweetsCollection.find({}).toArray();
    allTweets = await getTweets(allTweets);
    const favoriteAccounts = getFavoriteAccounts();
    let favoriteAccountTweets = allTweets.filter(tweet => favoriteAccounts.includes(tweet.compte));
    favoriteAccountTweets = favoriteAccountTweets.sort(() => Math.random() - 0.5); // Randomize the tweets
    res.render('favorite_accounts_tweets', { tweets: favoriteAccountTweets, formatTweetText: formatTweetText, favoriteAccounts: favoriteAccounts, allAccounts: allTweets.map(tweet => tweet.compte).filter((value, index, self) => self.indexOf(value) === index).sort() });
  } catch (err) {
    console.error('Error reading tweet data:', err);
    res.status(500).send('Error reading tweet data');
  }
});

app.get('/search', async (req, res) => {
  const query = req.query.q ? req.query.q.toLowerCase() : '';
  try {
    let allTweets = await tweetsCollection.find({}).toArray();
    allTweets = await getTweets(allTweets);

    let searchResults = allTweets.filter(tweet => {
      const tweetText = tweet.texte ? tweet.texte.toLowerCase() : '';
      const hashtags = tweet.hashtags ? tweet.hashtags.map(tag => tag.toLowerCase()) : [];
      
      return tweetText.includes(query) || hashtags.some(tag => tag.includes(query));
    });

    res.render('search_results', { 
      tweets: searchResults,
      formatTweetText: formatTweetText,
      query: req.query.q,
      favoriteAccounts: getFavoriteAccounts(),
      allAccounts: allTweets.map(tweet => tweet.compte).filter((value, index, self) => self.indexOf(value) === index).sort()
    });
  } catch (err) {
    console.error('Error reading tweet data:', err);
    return res.status(500).send('Error reading tweet data');
  }
});

const mediaPerPage = 14;
app.get('/profile/:username/media', async (req, res) => {
  try {
    const username = req.params.username;
    let userTweets = await tweetsCollection.find({ compte: username }).toArray();
    userTweets = await getTweets(userTweets);
    const user = userTweets.length > 0 ? { name: userTweets[0].compte, username: userTweets[0].compte } : null;

      if (user) {
        let allMedia = [];
        userTweets.forEach(tweet => {
          if (tweet.allMedia) {
            allMedia = allMedia.concat(tweet.allMedia.map(m => ({ ...m, tweetId: tweet.id })));
          }
        });

        const page = parseInt(req.query.page) || 1;
        const startIndex = (page - 1) * mediaPerPage;
        const endIndex = startIndex + mediaPerPage;

        const media = allMedia.slice(startIndex, endIndex);
        const totalPages = Math.ceil(allMedia.length / mediaPerPage);

        res.render('profile_media', {
          user: user,
          media: media,
          currentPage: page,
          totalPages: totalPages
        });
      } else {
        res.status(404).send('User not found');
      }
  } catch (err) {
    console.error('Error fetching media data:', err);
    res.status(500).send('Error fetching media data');
  }
});
app.get('/profile/:username', async (req, res) => {
  try {
    const username = req.params.username;
    let userTweets = await tweetsCollection.find({ compte: username }).toArray();
    userTweets = await getTweets(userTweets);
    const user = userTweets.length > 0 ? { name: userTweets[0].compte, username: userTweets[0].compte } : null;
    const topRetweetedAccounts = userTweets.filter(tweet => tweet.retweet_count > 0).sort((a, b) => b.retweet_count - a.retweet_count).slice(0, 10);
      if (user) {
        let allMedia = [];
        userTweets.forEach(tweet => {
          if (tweet.allMedia) {
            allMedia = allMedia.concat(tweet.allMedia.map(m => ({ ...m, tweetId: tweet.id })));
          }
        });
        const retweetCounts = {};
        userTweets.forEach(tweet => {
          if (tweet.retweeted_status && tweet.retweeted_status.user) {
            const retweetedAccount = tweet.retweeted_status.user.screen_name;
            retweetCounts[retweetedAccount] = (retweetCounts[retweetedAccount] || 0) + 1;
          }
        });

        const sortedRetweetedAccounts = Object.entries(retweetCounts)
          .map(([account, count]) => ({ account, count }))
          .sort((a, b) => b.count - a.count)
          .map(account => account.account);

        const mentionCounts = {};
        userTweets.forEach(tweet => {
          const mentionsInText = tweet.texte.match(/@(\w+)/g);
          if (mentionsInText) {
            mentionsInText.forEach(mention => {
              const username = mention.substring(1); // Remove the '@'
              mentionCounts[username] = (mentionCounts[username] || 0) + 1;
            });
          }
        });

        const sortedMentionedAccounts = Object.entries(mentionCounts)
          .map(([account, count]) => ({ account, count }))
          .sort((a, b) => b.count - a.count);

        const page = parseInt(req.query.page) || 1;
        const startIndex = (page - 1) * tweetsPerPage;
        const endIndex = startIndex + tweetsPerPage;

        const paginatedTweets = userTweets.slice(startIndex, endIndex);
        const totalPages = Math.ceil(userTweets.length / tweetsPerPage);
        
        res.render('profile', {
          user: user,
          media: allMedia,
          tweets: paginatedTweets,
          topRetweetedAccounts: sortedRetweetedAccounts,
          topMentionedAccounts: sortedMentionedAccounts,
          formatTweetText: formatTweetText,
          currentPage: page,
          totalPages: totalPages
        });
      } else {
        fs.appendFileSync("../accounts.txt", username + "\n")
        res.status(404).send('User not found');
      }
  } catch (err) {
    console.error('Error fetching media data:', err);
    res.status(500).send('Error fetching media data');
  }
});

const videosPerPage = 14;
app.get('/profile/:username/videos', async (req, res) => {
  try {
    const username = req.params.username;
    let userTweets = await tweetsCollection.find({ compte: username }).toArray();
    userTweets = await getTweets(userTweets);
    const user = userTweets.length > 0 ? { name: userTweets[0].compte, username: userTweets[0].compte } : null;

      if (user) {
        let allVideos = [];
        userTweets.forEach(tweet => {
          if (tweet.allMedia) {
            allVideos = allVideos.concat(tweet.allMedia.filter(m => m.type === 'video').map(v => ({ ...v, tweetId: tweet.id })));
          }
        });

        const page = parseInt(req.query.page) || 1;
        const startIndex = (page - 1) * videosPerPage;
        const endIndex = startIndex + videosPerPage;

        const videos = allVideos.slice(startIndex, endIndex);
        const totalPages = Math.ceil(allVideos.length / videosPerPage);

        res.render('profile_videos', {
          user: user,
          videos: videos,
          currentPage: page,
          totalPages: totalPages
        });
      } else {
        res.status(404).send('User not found');
      }
  } catch (err) {
    console.error('Error fetching video data:', err);
    res.status(500).send('Error fetching video data');
  }
});

app.get('/tweet/:id', async (req, res) => {
  try {
    const tweetId = req.params.id;
    let tweet = await tweetsCollection.findOne({ id: tweetId });

    if (tweet) {
      tweet = (await getTweets([tweet]))[0];
      res.render('tweet_detail', { tweet: tweet, formatTweetText: formatTweetText });
    } else {
      res.status(404).send('Tweet not found');
    }
  } catch (err) {
    console.error('Error fetching tweet detail:', err);
    res.status(500).send('Error fetching tweet detail');
  }
});

app.get('/all_media', async (req, res) => {
  try {
    let allTweets = await tweetsCollection.find({}).toArray();
    allTweets = await getTweets(allTweets);

    let allMedia = [];
    allTweets.forEach(tweet => {
      if (tweet.allMedia) {
        allMedia = allMedia.concat(tweet.allMedia.map(m => ({ ...m, tweetId: tweet.id, compte: tweet.compte })));
      }
    });

    const page = parseInt(req.query.page) || 1;
    const startIndex = (page - 1) * mediaPerPage;
    const endIndex = startIndex + mediaPerPage;

    const media = allMedia.slice(startIndex, endIndex);
    const totalPages = Math.ceil(allMedia.length / mediaPerPage);

    res.render('all_media', {
      media: media,
      currentPage: page,
      totalPages: totalPages
    });
  } catch (err) {
    console.error('Error fetching all media data:', err);
    res.status(500).send('Error fetching all media data');
  }
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
