import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory('/yourApps/bee/'),
  routes: [
    {
      path: '/',
      meta: { requiresAuth: true },
      component: () => import('@/views/BeeHome.vue'),
    },
    {
      path: '/job/:id',
      name: 'bee-job',
      meta: { requiresAuth: true },
      component: () => import('@/views/BeeJob.vue'),
    },
    {
      path: '/history',
      name: 'bee-history',
      meta: { requiresAuth: true },
      component: () => import('@/views/BeeHistory.vue'),
    },
  ]
})

router.beforeEach((to, _from, next) => {
  const authStore = useAuthStore()
  if (authStore.loading) {
    const check = () => authStore.loading ? setTimeout(check, 50) : (to.meta.requiresAuth && !authStore.isAuthenticated ? next('/') : next())
    check()
  } else {
    to.meta.requiresAuth && !authStore.isAuthenticated ? next('/') : next()
  }
})

export default router
