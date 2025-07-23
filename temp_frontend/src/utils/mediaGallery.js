
export function initMediaGallery(mediaContainerElement, mediaItems, videoItems) {
  if (!mediaContainerElement) {
    console.error("Media container element not found.");
    return;
  }

  mediaContainerElement.innerHTML = ''; // Clear existing content

  const allMedia = [...mediaItems.map(item => ({ ...item, type: 'image' })), ...videoItems.map(item => ({ ...item, type: 'video' }))];

  const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const mediaElement = entry.target;
        const type = mediaElement.dataset.type;
        const url = mediaElement.dataset.url;

        if (type === 'image') {
          const img = document.createElement('img');
          img.src = url;
          img.alt = 'Media';
          mediaElement.innerHTML = '';
          mediaElement.appendChild(img);
        } else if (type === 'video') {
          const video = document.createElement('video');
          video.src = url;
          video.controls = true;
          mediaElement.innerHTML = '';
          mediaElement.appendChild(video);
        }
        observer.unobserve(mediaElement);
      }
    });
  }, { rootMargin: '0px', threshold: 0.1 });

  allMedia.forEach(item => {
    const mediaItemDiv = document.createElement('div');
    mediaItemDiv.classList.add('media-item');
    if (item.type === 'video') {
      mediaItemDiv.classList.add('video-item');
    }
    mediaItemDiv.dataset.type = item.type;
    mediaItemDiv.dataset.url = item.url;

    const skeletonLoader = document.createElement('div');
    skeletonLoader.classList.add('skeleton-loader');
    mediaItemDiv.appendChild(skeletonLoader);

    mediaContainerElement.appendChild(mediaItemDiv);
    observer.observe(mediaItemDiv);
  });
}
