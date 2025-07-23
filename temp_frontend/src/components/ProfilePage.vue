<template>
  <div class="profile-page">
    <div class="profile-header">
      <h2>{{ username }}</h2>
      <div class="user-stats">
        <p><strong>Tweets:</strong> {{ tweets.length }}</p>
        <p><strong>Followers:</strong> N/A</p>
        <p><strong>Following:</strong> N/A</p>
        <p><strong>Account Created:</strong> N/A</p>
        <div class="profile-completion">
          <p>Profile Completion: {{ profileCompletion }}%</p>
          <div class="progress-bar-container">
            <div class="progress-bar" :style="{ width: profileCompletion + '%' }"></div>
          </div>
        </div>
      </div>
      <div class="profile-actions">
        <button @click="toggleFollow">{{ isFollowing ? 'Unfollow' : 'Follow' }}</button>
        <button class="message-button" @mouseover="showMessageButton = true" @mouseleave="showMessageButton = false">
          Message
        </button>
        <div class="more-actions-dropdown" @mouseover="showMoreActions = true" @mouseleave="showMoreActions = false">
          <button>More</button>
          <div class="dropdown-content" v-if="showMoreActions">
            <a href="#">Block</a>
            <a href="#">Report</a>
          </div>
        </div>
      </div>
    </div>

    <div class="profile-tabs">
      <button :class="{ active: activeTab === 'tweets' }" @click="activeTab = 'tweets'">Tweets</button>
      <button :class="{ active: activeTab === 'media' }" @click="activeTab = 'media'">Media</button>
      <button :class="{ active: activeTab === 'likes' }" @click="activeTab = 'likes'">Likes</button>
    </div>

    <div class="profile-content">
      <TweetList v-if="activeTab === 'tweets'" :tweets="tweets" />
      <div v-if="activeTab === 'media'" class="media-gallery" ref="mediaGalleryContainer"></div>
      <div v-if="activeTab === 'likes'">Liked tweets will go here.</div>
      <div v-if="activeTab === 'tweets' && hasMoreTweets" class="loading-indicator">Loading more tweets...</div>
    </div>
  </div>
</template>

<script>
import axios from 'axios';
import TweetList from './TweetList.vue';
import { initMediaGallery } from '../utils/mediaGallery';

export default {
  name: 'ProfilePage',
  components: {
    TweetList,
  },
  props: {
    username: {
      type: String,
      required: true,
    },
  },
  data() {
    return {
      tweets: [],
      media: [],
      videos: [],
      activeTab: 'tweets',
      profileCompletion: 75, // Placeholder value
      currentPage: 1,
      hasMoreTweets: true,
      isFollowing: false, // Placeholder for follow status
      showMessageButton: false,
      showMoreActions: false,
    };
  },
  watch: {
    username: 'fetchProfileData',
  },
  created() {
    this.fetchProfileData();
    window.addEventListener('scroll', this.handleScroll);
  },
  mounted() {
    this.$nextTick(() => {
      if (this.$refs.mediaGalleryContainer) {
        initMediaGallery(this.$refs.mediaGalleryContainer, this.media, this.videos);
      }
    });
  },
  beforeUnmount() {
    window.removeEventListener('scroll', this.handleScroll);
  },
  methods: {
    async fetchProfileData() {
      // Reset for new profile
      this.tweets = [];
      this.media = [];
      this.videos = [];
      this.currentPage = 1;
      this.hasMoreTweets = true;

      // Fetch tweets
      if (this.activeTab === 'tweets') {
        if (!this.hasMoreTweets && this.currentPage > 1) return; // Stop if no more tweets and not initial load
        try {
          const response = await axios.get(`/api/profile/${this.username}/page/${this.currentPage}`);
          const newTweets = response.data.tweets || [];
          this.tweets = [...this.tweets, ...newTweets];
          this.hasMoreTweets = newTweets.length > 0; // Assuming API returns empty array if no more tweets
          this.currentPage++;
        } catch (error) {
          console.error('Error fetching profile tweets:', error);
          this.hasMoreTweets = false; // Stop trying to load more on error
        }
      }

      // Fetch media and videos (only once per profile load)
      try {
        const mediaResponse = await axios.get(`/api/profile/${this.username}/media`);
        this.media = mediaResponse.data.media || [];

        const videoResponse = await axios.get(`/api/profile/${this.username}/videos`);
        this.videos = videoResponse.data.videos || [];

        this.$nextTick(() => {
          if (this.$refs.mediaGalleryContainer) {
            initMediaGallery(this.$refs.mediaGalleryContainer, this.media, this.videos);
          }
        });
      } catch (error) {
        console.error('Error fetching profile media/videos:', error);
      }
    },
    handleScroll() {
      const bottomOfWindow = document.documentElement.scrollTop + window.innerHeight === document.documentElement.offsetHeight;
      if (bottomOfWindow && this.activeTab === 'tweets' && this.hasMoreTweets) {
        this.fetchProfileData();
      }
    },
    toggleFollow() {
      // Placeholder for follow/unfollow logic
      this.isFollowing = !this.isFollowing;
      console.log(this.isFollowing ? 'Following' : 'Unfollowing', this.username);
    },
  },
};
</script>

<style scoped>
.profile-page {
  padding: 1rem;
}

.profile-header {
  text-align: left;
  margin-bottom: 1.5rem;
}

.user-stats p {
  margin: 0.5rem 0;
}

.profile-completion {
  margin-top: 1rem;
}

.progress-bar-container {
  width: 100%;
  background-color: #f3f3f3;
  border-radius: 5px;
  height: 10px;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background-color: #4CAF50;
  border-radius: 5px;
  text-align: center;
  color: white;
}

.profile-actions {
  position: relative;
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
}

.profile-actions button {
  padding: 0.5rem 1rem;
  border: 1px solid #ccc;
  background-color: #f0f0f0;
  cursor: pointer;
}

.message-button {
  /* Styles for message button */
}

.more-actions-dropdown {
  position: relative;
  display: inline-block;
}

.dropdown-content {
  display: none;
  position: absolute;
  background-color: #f9f9f9;
  min-width: 160px;
  box-shadow: 0px 8px 16px 0px rgba(0,0,0,0.2);
  z-index: 1;
}

.more-actions-dropdown:hover .dropdown-content {
  display: block;
}

.dropdown-content a {
  color: black;
  padding: 12px 16px;
  text-decoration: none;
  display: block;
}

.dropdown-content a:hover {
  background-color: #f1f1f1;
}

.profile-tabs {
  display: flex;
  border-bottom: 1px solid #eee;
  margin-bottom: 1rem;
}

.profile-tabs button {
  flex-grow: 1;
  padding: 0.8rem;
  border: none;
  background-color: transparent;
  cursor: pointer;
  font-size: 1rem;
  color: #555;
}

.profile-tabs button.active {
  border-bottom: 2px solid #1da1f2;
  color: #1da1f2;
  font-weight: bold;
}

.loading-indicator {
  text-align: center;
  padding: 1rem;
  font-style: italic;
  color: #888;
}

.media-gallery {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 10px;
}

.media-item img,
.media-item video {
  width: 100%;
  height: 150px;
  object-fit: cover;
  border-radius: 5px;
}

.skeleton-loader {
  width: 100%;
  height: 150px;
  background-color: #e0e0e0;
  border-radius: 5px;
  animation: pulse 1.5s infinite ease-in-out;
}

@keyframes pulse {
  0% {
    background-color: #e0e0e0;
  }
  50% {
    background-color: #f0f0f0;
  }
  100% {
    background-color: #e0e0e0;
  }
}

/* Dark Mode styles for ProfilePage */
.dark-mode .profile-tabs button {
  color: #cbd5e0;
}

.dark-mode .profile-tabs button.active {
  border-bottom-color: #63b3ed;
  color: #63b3ed;
}

.dark-mode .profile-actions button {
  background-color: #2d3748;
  color: #e2e8f0;
  border-color: #4a5568;
}

.dark-mode .progress-bar-container {
  background-color: #4a5568;
}

.dark-mode .progress-bar {
  background-color: #63b3ed;
}

.dark-mode .dropdown-content {
  background-color: #2d3748;
  box-shadow: 0px 8px 16px 0px rgba(0,0,0,0.4);
}

.dark-mode .dropdown-content a {
  color: #e2e8f0;
}

.dark-mode .dropdown-content a:hover {
  background-color: #4a5568;
}

.dark-mode .skeleton-loader {
  background-color: #4a5568;
}

.dark-mode @keyframes pulse {
  0% {
    background-color: #4a5568;
  }
  50% {
    background-color: #63b3ed;
  }
  100% {
    background-color: #4a5568;
  }
}

</style>