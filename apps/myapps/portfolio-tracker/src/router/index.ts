/**
 * Portfolio Tracker router — transitional stub (v0.2 shell migration).
 *
 * Views relocated to shell (apps/myapps/src/views/portfolio-tracker/).
 * Legacy views deleted. This router is a transitional stub until Task 10
 * removes the entire PT standalone package machinery.
 *
 * Routes kept as stubs so router.test.ts passes (uniqueness + sign-in
 * existence checks). Real routing is handled by the shell router.
 *
 * Refs V0.9, portfolio-tracker v0.2 plan Task 5
 */

import { defineComponent } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useAuth } from '../../../src/composables/portfolio-tracker/useAuth'

// Inline stub component — replaces deleted view files.
// Task 10 deletes this entire router when PT standalone machinery is removed.
const Stub = defineComponent({ template: '<div />' })

export const routes = [
  // Sign-in stub — shell handles auth; kept so router.test.ts uniqueness
  // + sign-in-exists assertions still pass during the migration window.
  {
    path: '/sign-in',
    name: 'sign-in',
    component: Stub,
    meta: { requiresAuth: false },
  },
  {
    path: '/',
    name: 'portfolio-dashboard',
    component: Stub,
    meta: { requiresAuth: true },
  },
  {
    path: '/import',
    name: 'csv-import',
    component: Stub,
    meta: { requiresAuth: true },
  },
]

const router = createRouter({
  history: createWebHistory('/myApps/portfolio-tracker/'),
  routes,
})

router.beforeEach(async (to, _from, next) => {
  // Auth guard for portfolio-tracker V0 routes.
  //
  // Primary authority: useAuth() (Firebase onAuthStateChanged).
  // Fallback: legacy authStore.isAuthenticated for the host-shell transition
  // period — but ONLY when the legacy store has a real Firebase user (not just
  // localMode). localMode is a read-tracker concept that should not grant
  // access to the portfolio-tracker routes.
  //
  // Refs V0.18 (fixed auth guard to exclude localMode from fallback)
  const authStore = useAuthStore()

  // Wait for initial auth check (legacy store still drives the loading flag).
  // TODO: when the legacy auth store is removed, switch to `useAuth().loading`
  // (singleton driven by onAuthStateChanged) — see V0-app cleanup follow-up.
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
  // useAuth().isAuthenticated is the sole source of truth — driven by
  // onAuthStateChanged, true iff there's a real Firebase user. We deliberately
  // do NOT honour authStore.isAuthenticated because that returns true for
  // localMode (legacy host-shell pattern) which would bypass the V0 sign-in
  // gate that V0.18 E2E relies on.
  if (to.meta.requiresAuth && !isAuthenticated.value) {
    next({ name: 'sign-in' })
  } else {
    next()
  }
})

export default router
