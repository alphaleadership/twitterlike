<template>
  <div class="tweet-card">
    <div class="tweet-content">
      <div class="user-info">
        <router-link :to="`/profile/${tweet.compte}`">
          <span class="username">{{ tweet.compte }}</span>
          <span class="handle">@{{ tweet.compte }}</span>
        </router-link>
      </div>
      <p class="tweet-text">{{ tweet.texte }}</p>
      <div v-if="tweet.media && tweet.media.length" class="tweet-media">
        <div v-for="(mediaItem, index) in tweet.media" :key="index" class="media-item">
          <img v-if="mediaItem.type === 'image'" :src="mediaItem.url" alt="Tweet media" class="tweet-image" />
          <video v-else-if="mediaItem.type === 'video'" :src="mediaItem.url" controls class="tweet-video"></video>
        </div>
      </div>
      <div class="actions">
        <button>Reply</button>
        <button>Retweet</button>
        <button>Like</button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'TweetCard',
  props: {
    tweet: {
      type: Object,
      required: true,
    },
  },
};
</script>

<style scoped>
.tweet-card {
  display: flex;
  padding: 1rem;
  border-bottom: 1px solid #eee;
}
.user-info {
  margin-bottom: 0.5rem;
}
.username {
  font-weight: bold;
}
.handle {
  color: #555;
  margin-left: 0.5rem;
}
.actions button {
  margin-right: 1rem;
  border: none;
  background: none;
  cursor: pointer;
  color: #555;
}

.tweet-media {
  margin-top: 1rem;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.media-item {
  flex: 1 1 auto;
  max-width: 100%;
}

.tweet-image,
.tweet-video {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
}

/* Dark Mode styles for TweetCard */
.dark-mode .tweet-card {
  background-color: #2d3748;
  border-color: #4a5568;
}

.dark-mode .tweet-card .handle,
.dark-mode .tweet-card .actions button,
.dark-mode .tweet-card .tweet-text {
  color: #cbd5e0;
}
</style>
