import { createRouter, createWebHistory } from 'vue-router'
import PortfolioTrackerLayout from '@/views/PortfolioTrackerLayout.vue'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory('/myApps/portfolio-tracker/'),
  routes: [
    {
      path: '/',
      component: PortfolioTrackerLayout,
      meta: { requiresAuth: true },
      children: [
        { path: '', redirect: 'dashboard' },
        { path: 'dashboard', name: 'dashboard', component: () => import('@/views/Dashboard.vue') },
        { path: 'transactions', name: 'transactions', component: () => import('@/views/Transactions.vue') },
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
    if (to.meta.requiresAuth && !authStore.isAuthenticated) {
      next('/')
    } else {
      next()
    }
  }
})

export default router
