import React from 'react';
import './TweetCard.css';

function TweetCard({ username, content, timestamp }) {
  return (
    <div className="tweet-card">
      <div className="tweet-header">
        <span className="username">@{username}</span>
        <span className="timestamp">{new Date(timestamp).toLocaleString()}</span>
      </div>
      <div className="tweet-content">
        <p>{content}</p>
      </div>
    </div>
  );
}

export default TweetCard;