import type { RouteRecordRaw } from 'vue-router'
import type { AppManifest } from '@/shared/types/AppManifest'

const routes: RouteRecordRaw[] = [
  {
    path: '',
    redirect: 'dashboard'
  },
  {
    path: 'dashboard',
    name: 'task-list-dashboard',
    component: () => import('./src/views/Dashboard.vue')
  }
]

const manifest: AppManifest = {
  id: 'task-list',
  name: 'Task List',
  description: 'Manage your tasks and to-dos.',
  icon: 'checklist',
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
