
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

  // Lightbox functionality
  const lightboxOverlay = document.querySelector('.lightbox-overlay');
  const lightboxContent = document.querySelector('.lightbox-content');
  const lightboxClose = document.querySelector('.lightbox-close');

  document.querySelectorAll('.lightbox-trigger').forEach(trigger => {
    trigger.addEventListener('click', (event) => {
      event.preventDefault();
      const mediaElement = trigger.querySelector('img, video').cloneNode(true);
      lightboxContent.innerHTML = '';
      lightboxContent.appendChild(mediaElement);
      lightboxOverlay.style.display = 'flex';
    });
  });

  lightboxClose.addEventListener('click', () => {
    lightboxOverlay.style.display = 'none';
    lightboxContent.innerHTML = ''; // Clear content when closing
  });

  lightboxOverlay.addEventListener('click', (event) => {
    if (event.target === lightboxOverlay) {
      lightboxOverlay.style.display = 'none';
      lightboxContent.innerHTML = '';
    }
  });
});
