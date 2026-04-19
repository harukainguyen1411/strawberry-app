import { createRouter, createWebHistory } from 'vue-router'
import ReadTrackerLayout from '@/views/ReadTrackerLayout.vue'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory('/myApps/read-tracker/'),
  routes: [
    {
      path: '/',
      component: ReadTrackerLayout,
      meta: { requiresAuth: true },
      children: [
        { path: '', redirect: 'dashboard' },
        { path: 'dashboard', name: 'dashboard', component: () => import('@/views/Dashboard.vue') },
        { path: 'sessions', name: 'sessions', component: () => import('@/views/ReadingSessions.vue') },
        { path: 'books', name: 'books', component: () => import('@/views/Books.vue') },
        { path: 'goals', name: 'goals', component: () => import('@/views/Goals.vue') },
        { path: 'stats', name: 'stats', component: () => import('@/views/Stats.vue') },
        { path: 'settings', name: 'settings', component: () => import('@/views/Settings.vue') },
      ]
    }
  ]
})

router.beforeEach((to, _from, next) => {
  const authStore = useAuthStore()
  if (authStore.loading) {
    const check = () => authStore.loading ? setTimeout(check, 50) : (to.meta.requiresAuth && !authStore.isAuthenticated ? next('/') : next())
    check()
  } else {
    if (to.meta.requiresAuth && !authStore.isAuthenticated) { next('/') } else { next() }
  }
})

export default router
