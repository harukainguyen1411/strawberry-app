import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { loadApps } from '../core/appLoader'
import { getAppAccessForUser, getAppRecord, getUserProfile } from '../firebase/platformFirestore'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('../views/Home.vue')
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('../views/Settings.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/your-apps',
    name: 'your-apps',
    component: () => import('../views/YourApps.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/apps/:appId/suggestions',
    name: 'app-suggestions',
    component: () => import('../views/AppSuggestionsPage.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/access-denied',
    name: 'access-denied',
    component: () => import('../views/AccessDenied.vue')
  },
  // Catch-all for 404
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('../views/NotFound.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Load app routes dynamically from manifests
let appsLoaded = false
router.beforeEach(async (to, _from, next) => {
  // Load app routes once on first navigation
  if (!appsLoaded) {
    appsLoaded = true
    await loadApps(router)
    // Re-resolve the current route after dynamic routes are added
    const resolved = router.resolve(to.fullPath)
    if (resolved.name !== 'not-found') {
      next({ ...resolved, replace: true })
      return
    }
  }

  const authStore = useAuthStore()

  // Wait for auth initialization
  if (authStore.loading) {
    await new Promise<void>((resolve) => {
      const check = () => {
        if (!authStore.loading) resolve()
        else setTimeout(check, 50)
      }
      check()
    })
  }

  // Basic auth guard
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next({ name: 'home' })
    return
  }

  // App access guard — only runs on app routes (those with appId in meta)
  const appId = to.meta.appId as string | undefined
  const appCategory = to.meta.appCategory as string | undefined

  if (appId && authStore.user) {
    const userId = authStore.user.uid

    // Check if user is admin — admins bypass all access checks
    const profile = await getUserProfile(userId)
    if (profile?.role === 'admin') {
      next()
      return
    }

    // myApps: allow if the app is marked public in Firestore
    if (appCategory === 'myApps') {
      const appRecord = await getAppRecord(appId)
      if (!appRecord || appRecord.access.public) {
        // Public app (or not yet in registry) — allow
        next()
        return
      }
      // Non-public myApp — fall through to explicit access check below
    }

    // yourApps (and non-public myApps): require explicit appAccess grant
    const access = await getAppAccessForUser(userId, appId)
    if (!access) {
      next({ name: 'access-denied', query: { appId } })
      return
    }
  }

  next()
})

export default router
