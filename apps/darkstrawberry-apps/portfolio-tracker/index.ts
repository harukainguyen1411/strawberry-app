import type { RouteRecordRaw } from 'vue-router'
import type { AppManifest } from '@/shared/types/AppManifest'

const routes: RouteRecordRaw[] = [
  {
    path: '',
    redirect: 'dashboard'
  },
  {
    path: 'dashboard',
    name: 'portfolio-tracker-dashboard',
    component: () => import('./src/views/Dashboard.vue')
  },
  {
    path: 'transactions',
    name: 'portfolio-tracker-transactions',
    component: () => import('./src/views/Transactions.vue')
  },
  {
    path: 'settings',
    name: 'portfolio-tracker-settings',
    component: () => import('./src/views/Settings.vue')
  }
]

const manifest: AppManifest = {
  id: 'portfolio-tracker',
  name: 'Portfolio Tracker',
  description: 'Track your investment portfolio and transactions.',
  icon: 'chart-line',
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
