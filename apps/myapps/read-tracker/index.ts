import type { RouteRecordRaw } from 'vue-router'
import type { AppManifest } from '@/shared/types/AppManifest'

const routes: RouteRecordRaw[] = [
  {
    path: '',
    redirect: 'dashboard'
  },
  {
    path: 'dashboard',
    name: 'read-tracker-dashboard',
    component: () => import('./src/views/Dashboard.vue')
  },
  {
    path: 'sessions',
    name: 'read-tracker-sessions',
    component: () => import('./src/views/ReadingSessions.vue')
  },
  {
    path: 'books',
    name: 'read-tracker-books',
    component: () => import('./src/views/Books.vue')
  },
  {
    path: 'goals',
    name: 'read-tracker-goals',
    component: () => import('./src/views/Goals.vue')
  },
  {
    path: 'stats',
    name: 'read-tracker-stats',
    component: () => import('./src/views/Stats.vue')
  },
  {
    path: 'settings',
    name: 'read-tracker-settings',
    component: () => import('./src/views/Settings.vue')
  }
]

const manifest: AppManifest = {
  id: 'read-tracker',
  name: 'Read Tracker',
  description: 'Track your reading sessions, books, and goals.',
  icon: 'book',
  category: 'myApps',
  version: '1.0.0',
  routes,
  defaultSettings: {
    collaboration: false,
    forkable: false,
    personalMode: false
  }
}

export default manifest
