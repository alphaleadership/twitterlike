<template>
  <div class="tweet-list">
    <TweetCard v-for="tweet in tweets" :key="tweet._id" :tweet="tweet" />
    <div class="pagination">
      <button @click="prevPage" :disabled="currentPage === 1">Previous</button>
      <span>Page {{ currentPage }} of {{ totalPages }}</span>
      <button @click="nextPage" :disabled="currentPage === totalPages">Next</button>
    </div>
  </div>
</template>

<script>
import TweetCard from './TweetCard.vue';


export default {
  name: 'TweetList',
  components: {
    TweetCard,
  },
  data() {
    return {
      tweets: [],
      currentPage: 1,
      totalPages: 1,
    };
  },
  created() {
    this.fetchTweets();
  },
  methods: {
    async fetchTweets() {
      try {
        const response = await fetch(`/api/tweets?page=${this.currentPage}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        this.tweets = data.tweets;
        this.totalPages = data.totalPages;
      } catch (error) {
        console.error('Error fetching tweets:', error);
      }
    },
    nextPage() {
      if (this.currentPage < this.totalPages) {
        this.currentPage++;
        this.fetchTweets();
      }
    },
    prevPage() {
      if (this.currentPage > 1) {
        this.currentPage--;
        this.fetchTweets();
      }
    },
  },
};
</script>

<style scoped>
.tweet-list {
  max-width: 600px;
  margin: 0 auto;
  border: 1px solid #eee;
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

/* Dark Mode styles for TweetList */
.dark-mode .tweet-list {
  border-color: #4a5568;
}

.dark-mode .pagination button {
  background-color: #2d3748;
  color: #e2e8f0;
  border-color: #4a5568;
}
</style>
