<template>
  <div id="app">
    <AccountSidebar />
    <div class="main-content">
      <header>
        <h1>Twitter Clone</h1>
        <button @click="toggleDarkMode" class="dark-mode-toggle">
          {{ isDarkMode ? 'Light Mode' : 'Dark Mode' }}
        </button>
      </header>
      <main>
        <router-view />
      </main>
    </div>
  </div>
</template>

<script>
import AccountSidebar from './components/AccountSidebar.vue';

export default {
  name: 'App',
  components: {
    AccountSidebar,
  },
  data() {
    return {
      isDarkMode: false,
    };
  },
  created() {
    // Load dark mode preference from localStorage
    this.isDarkMode = localStorage.getItem('darkMode') === 'true';
    this.applyDarkMode();
  },
  methods: {
    toggleDarkMode() {
      this.isDarkMode = !this.isDarkMode;
      localStorage.setItem('darkMode', this.isDarkMode);
      this.applyDarkMode();
    },
    applyDarkMode() {
      if (this.isDarkMode) {
        document.body.classList.add('dark-mode');
      } else {
        document.body.classList.remove('dark-mode');
      }
    },
  },
};
</script>

<style>
/* Light Mode (Default) */
body {
  background-color: #fff;
  color: #2c3e50;
}

#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
  display: grid; /* Use CSS Grid for layout */
  grid-template-columns: 200px 1fr; /* Sidebar width and main content */
}

@media (max-width: 768px) {
  #app {
    grid-template-columns: 1fr; /* Stack content on small screens */
  }
  .account-sidebar {
    position: fixed; /* Keep sidebar fixed on small screens */
    width: 100%;
    height: auto;
    top: 0;
    left: 0;
    z-index: 1000; /* Ensure it's on top */
  }
  .main-content {
    margin-top: 50px; /* Adjust for fixed sidebar height on small screens */
  }
}

header {
  margin-bottom: 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 1rem;
}

.dark-mode-toggle {
  padding: 0.5rem 1rem;
  border: 1px solid #ccc;
  background-color: #f0f0f0;
  cursor: pointer;
  border-radius: 5px;
}

/* Dark Mode */
body.dark-mode {
  background-color: #1a202c;
  color: #e2e8f0;
}

body.dark-mode .dark-mode-toggle {
  background-color: #2d3748;
  color: #e2e8f0;
  border-color: #4a5568;
}

body.dark-mode .tweet-card {
  background-color: #2d3748;
  border-color: #4a5568;
}

body.dark-mode .tweet-card .handle,
body.dark-mode .tweet-card .actions button {
  color: #cbd5e0;
}

body.dark-mode .account-sidebar {
  background-color: #2d3748;
  border-color: #4a5568;
}

body.dark-mode .account-sidebar li:hover {
  background-color: #4a5568;
}

body.dark-mode .profile-tabs button {
  color: #cbd5e0;
}

body.dark-mode .profile-tabs button.active {
  border-bottom-color: #63b3ed;
  color: #63b3ed;
}

body.dark-mode .profile-actions button {
  background-color: #2d3748;
  color: #e2e8f0;
  border-color: #4a5568;
}

body.dark-mode .progress-bar-container {
  background-color: #4a5568;
}

body.dark-mode .progress-bar {
  background-color: #63b3ed;
}

body.dark-mode .dropdown-content {
  background-color: #2d3748;
  box-shadow: 0px 8px 16px 0px rgba(0,0,0,0.4);
}

body.dark-mode .dropdown-content a {
  color: #e2e8f0;
}

body.dark-mode .dropdown-content a:hover {
  background-color: #4a5568;
}

body.dark-mode .skeleton-loader {
  background-color: #4a5568;
}

@keyframes pulse {
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