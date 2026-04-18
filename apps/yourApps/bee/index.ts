import type { RouteRecordRaw } from 'vue-router'
import type { AppManifest } from '@/shared/types/AppManifest'

const routes: RouteRecordRaw[] = [
  {
    path: '',
    name: 'bee-home',
    component: () => import('./src/views/BeeHome.vue')
  },
  {
    path: 'job/:id',
    name: 'bee-job',
    component: () => import('./src/views/BeeJob.vue')
  },
  {
    path: 'history',
    name: 'bee-history',
    component: () => import('./src/views/BeeHistory.vue')
  }
]

const manifest: AppManifest = {
  id: 'bee',
  name: 'Bee',
  description: 'AI-powered document processing assistant.',
  icon: 'bee',
  category: 'yourApps',
  version: '1.0.0',
  routes,
  defaultSettings: {
    collaboration: false,
    forkable: false,
    personalMode: true
  }
}

export default manifest
