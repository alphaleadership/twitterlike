
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.tweet').forEach(tweetElement => {
    tweetElement.addEventListener('click', (event) => {
      // Prevent navigating if a link inside the tweet is clicked
      if (event.target.tagName === 'A' || event.target.closest('a')) {
        return;
      }
      const tweetId = tweetElement.dataset.tweetId;
      if (tweetId) {
        window.location.href = `/tweet/${tweetId}`;
      }
    });
  });
});
