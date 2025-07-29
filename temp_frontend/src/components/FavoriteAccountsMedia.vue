<template>
  <div class="favorite-accounts-media-page">
    <h1>Media from Favorite Accounts</h1>
    <div class="media-grid">
      <div v-for="tweet in tweets" :key="tweet.id" class="media-item">
        <img v-if="tweet.media && tweet.media.length > 0" :src="tweet.media[0].url" alt="Tweet media" class="tweet-image" />
        <video v-else-if="tweet.video && tweet.video.length > 0" :src="tweet.video[0].url" controls class="tweet-video"></video>
        <p class="tweet-text">{{ tweet.texte }}</p>
        <router-link :to="`/profile/${tweet.compte}`">
          <span class="username">@{{ tweet.compte }}</span>
        </router-link>
      </div>
    </div>
    <div class="pagination">
      <button @click="prevPage" :disabled="currentPage === 1">Previous</button>
      <span>Page {{ currentPage }} of {{ totalPages }}</span>
      <button @click="nextPage" :disabled="currentPage === totalPages">Next</button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'FavoriteAccountsMedia',
  data() {
    return {
      tweets: [],
      currentPage: 1,
      totalPages: 1,
    };
  },
  created() {
    this.fetchMedia();
  },
  methods: {
    async fetchMedia() {
      try {
        const response = await this.$http.get(`/api/favorite_accounts/media?page=${this.currentPage}`);
        this.tweets = response.data.tweets;
        this.totalPages = response.data.totalPages;
      } catch (error) {
        console.error('Error fetching favorite accounts media:', error);
      }
    },
    nextPage() {
      if (this.currentPage < this.totalPages) {
        this.currentPage++;
        this.fetchMedia();
      }
    },
    prevPage() {
      if (this.currentPage > 1) {
        this.currentPage--;
        this.fetchMedia();
      }
    },
  },
};
</script>

<style scoped>
.favorite-accounts-media-page {
  padding: 1rem;
}

.media-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1rem;
}

.media-item {
  border: 1px solid #eee;
  padding: 1rem;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.tweet-image,
.tweet-video {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  margin-bottom: 0.5rem;
}

.tweet-text {
  text-align: center;
  margin-bottom: 0.5rem;
}

.username {
  font-weight: bold;
  color: #1da1f2;
}

.pagination {
  margin-top: 1rem;
  display: flex;
  justify-content: center;
  align-items: center;
}

.pagination button {
  margin: 0 0.5rem;
  padding: 0.5rem 1rem;
  border: 1px solid #ccc;
  background-color: #f0f0f0;
  cursor: pointer;
}

.pagination button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Dark Mode styles */
.dark-mode .favorite-accounts-media-page {
  background-color: #1a202c;
  color: #e2e8f0;
}

.dark-mode .media-item {
  border-color: #4a5568;
  background-color: #2d3748;
}

.dark-mode .pagination button {
  background-color: #2d3748;
  color: #e2e8f0;
  border-color: #4a5568;
}
</style>