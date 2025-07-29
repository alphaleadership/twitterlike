import { createRouter, createWebHistory } from 'vue-router';
import TweetList from '../components/TweetList.vue';
import ProfilePage from '../components/ProfilePage.vue';
import FavoriteAccountsMedia from '../components/FavoriteAccountsMedia.vue';

const routes = [
  {
    path: '/',
    name: 'Home',
    component: TweetList,
  },
  {
    path: '/profile/:username',
    name: 'Profile',
    component: ProfilePage,
    props: true,
  },
  {
    path: '/favorite_accounts/media',
    name: 'FavoriteAccountsMedia',
    component: FavoriteAccountsMedia,
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;