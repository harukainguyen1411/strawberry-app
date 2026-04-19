/**
 * Portfolio Tracker router.
 *
 * Routes:
 *   /                → DashboardView (auth required)
 *   /import          → CsvImport (auth required)
 *   /sign-in         → auth/SignInView (public, V0.2 email-link abstraction)
 *   /sign-in-callback → auth/SignInCallbackView (public, V0.2)
 *
 * Legacy routes retained for the existing portfolio tracker sub-app.
 *
 * Refs V0.9
 */

import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useAuth } from '@/composables/useAuth'

export const routes = [
  // Portfolio v0 routes
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
    name: 'portfolio-dashboard',
    component: () => import('@/views/DashboardView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/import',
    name: 'csv-import',
    component: () => import('@/views/CsvImport.vue'),
    meta: { requiresAuth: true },
  },
  // Legacy routes for the existing portfolio sub-app
  {
    path: '/legacy',
    component: () => import('@/views/PortfolioTrackerLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', redirect: 'dashboard' },
      { path: 'dashboard', name: 'legacy-dashboard', component: () => import('@/views/Dashboard.vue') },
      { path: 'transactions', name: 'transactions', component: () => import('@/views/Transactions.vue') },
      { path: 'settings', name: 'settings', component: () => import('@/views/Settings.vue') },
    ],
  },
]

const router = createRouter({
  history: createWebHistory('/myApps/portfolio-tracker/'),
  routes,
})

router.beforeEach(async (to, _from, next) => {
  // Use both auth systems during transition: existing authStore + new useAuth
  const authStore = useAuthStore()

  // Wait for initial auth check
  if (authStore.loading) {
    await new Promise<void>((resolve) => {
      const check = () => {
        if (!authStore.loading) resolve()
        else setTimeout(check, 50)
      }
      check()
    })
  }

  const { isAuthenticated } = useAuth()
  const authed = isAuthenticated.value || authStore.isAuthenticated

  if (to.meta.requiresAuth && !authed) {
    next({ name: 'sign-in' })
  } else {
    next()
  }
})

export default router
