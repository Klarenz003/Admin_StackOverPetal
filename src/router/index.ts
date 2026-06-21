// src/router/index.ts
import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/pages/LoginPage.vue'),
    },
    {
      path: '/',
      component: () => import('@/pages/DashboardLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        { path: '',          redirect: '/overview' },
        { path: 'overview',     name: 'overview',     component: () => import('@/pages/OverviewPage.vue')     },
        { path: 'orders',       name: 'orders',       component: () => import('@/pages/OrdersPage.vue')       },
        { path: 'messages',     name: 'messages',     component: () => import('@/pages/MessagesPage.vue')     },
        { path: 'transactions', name: 'transactions', component: () => import('@/pages/TransactionsPage.vue') },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (to.meta.requiresAuth && !auth.loggedIn) {
    return { name: 'login' }
  }
  if (to.name === 'login' && auth.loggedIn) {
    return { name: 'overview' }
  }
})

export default router
