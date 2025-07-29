<template>
  <div class="account-sidebar" :class="{ 'is-collapsed': isCollapsed }">
    <button class="toggle-sidebar" @click="toggleSidebar">{{ isCollapsed ? '>' : '<' }}</button>
    <div v-if="!isCollapsed">
      <h3>Accounts</h3>
      <ul>
        <li v-for="account in allAccounts" :key="account">
          <router-link :to="`/profile/${account}`">{{ account }}</router-link>
        </li>
      </ul>
      <h4>Favorite Accounts</h4>
      <ul>
        <li v-for="account in favoriteAccounts" :key="account">
          <router-link :to="`/profile/${account}`">{{ account }}</router-link>
        </li>
        <li>
          <router-link to="/favorite_accounts/media">Favorite Accounts Media</router-link>
        </li>
      </ul>
      <h4>Hidden Accounts</h4>
      <ul>
        <li v-for="account in hiddenAccounts" :key="account">
          <router-link :to="`/profile/${account}`">{{ account }}</router-link>
        </li>
      </ul>
    </div>
  </div>
</template>

<script>
import axios from 'axios';

export default {
  name: 'AccountSidebar',
  data() {
    return {
      allAccounts: [],
      favoriteAccounts: [],
      hiddenAccounts: [],
      isCollapsed: false,
    };
  },
  created() {
    this.fetchAccounts();
    this.checkScreenSize();
    window.addEventListener('resize', this.checkScreenSize);
  },
  unmounted() {
    window.removeEventListener('resize', this.checkScreenSize);
  },
  methods: {
    async fetchAccounts() {
      try {
        const response = await axios.get('/api/accounts');
        this.allAccounts = response.data.allAccounts || [];
        this.favoriteAccounts = response.data.favorites || [];
        this.hiddenAccounts = response.data.hidden || [];
      } catch (error) {
        console.error('Error fetching accounts:', error);
      }
    },
    toggleSidebar() {
      this.isCollapsed = !this.isCollapsed;
    },
    checkScreenSize() {
      this.isCollapsed = window.innerWidth <= 768; // Collapse on screens smaller than 768px
    },
  },
};
</script>

<style scoped>
.account-sidebar {
  width: 200px;
  padding: 1rem;
  border-right: 1px solid #eee;
  height: 100vh;
  overflow-y: auto;
  background-color: #f9f9f9;
  transition: width 0.3s ease; /* Smooth transition for width change */
}

.account-sidebar.is-collapsed {
  width: 50px; /* Collapsed width */
}

.account-sidebar h3,
.account-sidebar h4 {
  margin-top: 1rem;
  margin-bottom: 0.5rem;
}

.account-sidebar ul {
  list-style: none;
  padding: 0;
}

.account-sidebar li {
  padding: 0.3rem 0;
  cursor: pointer;
}

.account-sidebar li:hover {
  background-color: #e0e0e0;
}

.toggle-sidebar {
  background-color: #ddd;
  border: none;
  padding: 0.5rem;
  cursor: pointer;
  width: 100%;
  text-align: center;
}

@media (max-width: 768px) {
  .account-sidebar {
    width: 100%; /* Full width on small screens */
    height: auto; /* Auto height */
    position: static; /* Remove fixed positioning */
  }
  .account-sidebar.is-collapsed {
    width: 50px;
  }
  .toggle-sidebar {
    display: block; /* Show toggle button on small screens */
  }
}

@media (min-width: 769px) {
  .toggle-sidebar {
    display: none; /* Hide toggle button on larger screens */
  }
}

/* Dark Mode styles for AccountSidebar */
.dark-mode .account-sidebar {
  background-color: #2d3748;
  border-color: #4a5568;
}

.dark-mode .account-sidebar li:hover {
  background-color: #4a5568;
}
</style>