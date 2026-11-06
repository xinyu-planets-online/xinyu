import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: { template: '<div style="display:none" />' },
    },
    {
      path: '/mindfulness',
      name: 'mindfulness',
      component: { template: '<div style="display:none" />' },
    },
  ],
})

export default router