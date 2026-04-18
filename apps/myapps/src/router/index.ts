import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import Home from '@/views/Home.vue'
import ReadTrackerLayout from '@/views/ReadTracker/ReadTrackerLayout.vue'
import PortfolioTrackerLayout from '@/views/PortfolioTracker/PortfolioTrackerLayout.vue'
import TaskListLayout from '@/views/TaskList/TaskListLayout.vue'
import { useAuthStore } from '@/stores/auth'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: Home
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/Settings.vue'),
    meta: { requiresAuth: true }
  },

  // === myApps routes (new /myApps/{slug} structure) ===
  {
    path: '/myApps/read-tracker',
    component: ReadTrackerLayout,
    meta: { requiresAuth: true, appId: 'read-tracker' },
    children: [
      {
        path: '',
        name: 'read-tracker',
        redirect: '/myApps/read-tracker/dashboard'
      },
      {
        path: 'dashboard',
        name: 'read-tracker-dashboard',
        component: () => import('@/views/ReadTracker/Dashboard.vue')
      },
      {
        path: 'sessions',
        name: 'read-tracker-sessions',
        component: () => import('@/views/ReadTracker/ReadingSessions.vue')
      },
      {
        path: 'books',
        name: 'read-tracker-books',
        component: () => import('@/views/ReadTracker/Books.vue')
      },
      {
        path: 'goals',
        name: 'read-tracker-goals',
        component: () => import('@/views/ReadTracker/Goals.vue')
      },
      {
        path: 'stats',
        name: 'read-tracker-stats',
        component: () => import('@/views/ReadTracker/Stats.vue')
      },
      {
        path: 'settings',
        name: 'read-tracker-settings',
        component: () => import('@/views/ReadTracker/Settings.vue')
      }
    ]
  },
  {
    path: '/myApps/portfolio-tracker',
    component: PortfolioTrackerLayout,
    meta: { requiresAuth: true, appId: 'portfolio-tracker' },
    children: [
      {
        path: '',
        name: 'portfolio-tracker',
        redirect: '/myApps/portfolio-tracker/dashboard'
      },
      {
        path: 'dashboard',
        name: 'portfolio-tracker-dashboard',
        component: () => import('@/views/PortfolioTracker/Dashboard.vue')
      },
      {
        path: 'transactions',
        name: 'portfolio-tracker-transactions',
        component: () => import('@/views/PortfolioTracker/Transactions.vue')
      },
      {
        path: 'settings',
        name: 'portfolio-tracker-settings',
        component: () => import('@/views/PortfolioTracker/Settings.vue')
      }
    ]
  },
  {
    path: '/myApps/task-list',
    component: TaskListLayout,
    meta: { requiresAuth: true, appId: 'task-list' },
    children: [
      {
        path: '',
        name: 'task-list',
        redirect: '/myApps/task-list/dashboard'
      },
      {
        path: 'dashboard',
        name: 'task-list-dashboard',
        component: () => import('@/views/TaskList/Dashboard.vue')
      }
    ]
  },

  // === yourApps routes ===
  {
    path: '/yourApps/bee',
    meta: { requiresAuth: true, appId: 'bee' },
    children: [
      {
        path: '',
        name: 'bee-home',
        component: () => import('@/views/bee/BeeHome.vue')
      },
      {
        path: 'intake',
        name: 'bee-intake',
        component: () => import('@/views/bee/BeeIntake.vue')
      },
      {
        path: 'job/:id',
        name: 'bee-job',
        component: () => import('@/views/bee/BeeJob.vue')
      },
      {
        path: 'history',
        name: 'bee-history',
        component: () => import('@/views/bee/BeeHistory.vue')
      }
    ]
  },

  // === Legacy redirects from old paths ===
  { path: '/read-tracker/:pathMatch(.*)*', redirect: to => `/myApps/read-tracker/${(to.params.pathMatch as string[]).join('/')}` },
  { path: '/portfolio-tracker/:pathMatch(.*)*', redirect: to => `/myApps/portfolio-tracker/${(to.params.pathMatch as string[]).join('/')}` },
  { path: '/task-list/:pathMatch(.*)*', redirect: to => `/myApps/task-list/${(to.params.pathMatch as string[]).join('/')}` },
  { path: '/bee/:pathMatch(.*)*', redirect: to => `/yourApps/bee/${(to.params.pathMatch as string[]).join('/')}` }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Authentication guard
router.beforeEach((to, _from, next) => {
  const authStore = useAuthStore()

  // Wait for auth to initialize
  if (authStore.loading) {
    const checkAuth = () => {
      if (!authStore.loading) {
        if (to.meta.requiresAuth && !authStore.isAuthenticated) {
          next({ name: 'home' })
        } else {
          next()
        }
      } else {
        setTimeout(checkAuth, 100)
      }
    }
    checkAuth()
  } else {
    if (to.meta.requiresAuth && !authStore.isAuthenticated) {
      next({ name: 'home' })
    } else {
      next()
    }
  }
})

export default router
