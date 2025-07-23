import React from 'react';
import TweetCard from './components/TweetCard';

function Tweet() {
  const dummyTweet = {
    username: 'react_dev',
    content: 'This is a single tweet example. Building a Twitter-like interface with React!',
    timestamp: Date.now(),
  };

  return (
    <div>
      <h1>Single Tweet View</h1>
      <TweetCard {...dummyTweet} />
    </div>
  );
}

export default Tweet;