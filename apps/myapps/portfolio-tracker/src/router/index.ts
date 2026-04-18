import { createRouter, createWebHistory } from 'vue-router'
import PortfolioTrackerLayout from '@/views/PortfolioTrackerLayout.vue'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory('/myApps/portfolio-tracker/'),
  routes: [
    {
      path: '/sign-in',
      name: 'sign-in',
      component: () => import('@/views/auth/SignInView.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/sign-in-callback',
      name: 'sign-in-callback',
      component: () => import('@/views/auth/SignInCallbackView.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/',
      component: PortfolioTrackerLayout,
      meta: { requiresAuth: true },
      children: [
        { path: '', redirect: 'dashboard' },
        { path: 'dashboard', name: 'dashboard', component: () => import('@/views/Dashboard.vue') },
        { path: 'import', name: 'import', component: () => import('@/views/CsvImport.vue') },
        { path: 'transactions', name: 'transactions', component: () => import('@/views/Transactions.vue') },
        { path: 'settings', name: 'settings', component: () => import('@/views/Settings.vue') },
      ]
    }
  ]
})

router.beforeEach((to, _from, next) => {
  const authStore = useAuthStore()
  if (authStore.loading) {
    const check = () => {
      if (authStore.loading) {
        setTimeout(check, 50)
      } else if (to.meta.requiresAuth && !authStore.isAuthenticated) {
        next('/sign-in')
      } else {
        next()
      }
    }
    check()
  } else if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next('/sign-in')
  } else {
    next()
  }
})

export default router
