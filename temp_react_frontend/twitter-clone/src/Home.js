import React, { useState, useEffect } from 'react';
import TweetCard from './components/TweetCard';

function Home() {
  const [displayedTweets, setDisplayedTweets] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadMoreTweets();
  }, []); // Load initial tweets on component mount

  const loadMoreTweets = async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`http://localhost:3000/api/tweets?page=${currentPage}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();

      if (data.length === 0) {
        setHasMore(false);
      } else {
        setDisplayedTweets((prevTweets) => [...prevTweets, ...data]);
        setCurrentPage((prevPage) => prevPage + 1);
      }
    } catch (e) {
      setError('Failed to fetch tweets. Please ensure the backend server is running on http://localhost:3000. Error: ' + e.message);
      console.error("Error fetching tweets:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1>Home Feed</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <div className="tweet-feed">
        {displayedTweets.map((tweet, index) => (
          <TweetCard 
            key={tweet.id} 
            username={tweet.compte} 
            content={tweet.contenu} 
            timestamp={tweet.date} 
          />
        ))}
      </div>
      {hasMore && (
        <button onClick={loadMoreTweets} disabled={loading} style={{ padding: '10px 20px', margin: '20px 0', cursor: 'pointer' }}>
          {loading ? 'Loading...' : 'Load More Tweets'}
        </button>
      )}
      {!hasMore && !loading && displayedTweets.length > 0 && <p>No more tweets to load.</p>}
      {!hasMore && !loading && displayedTweets.length === 0 && <p>No tweets available.</p>}
    </div>
  );
}

export default Home;