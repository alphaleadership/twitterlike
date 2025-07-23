import { createRouter, createWebHistory } from 'vue-router';
import TweetList from '../components/TweetList.vue';
import ProfilePage from '../components/ProfilePage.vue';

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
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;