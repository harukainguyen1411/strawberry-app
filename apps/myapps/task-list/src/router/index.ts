import { createRouter, createWebHistory } from 'vue-router'
import TaskListLayout from '@/views/TaskListLayout.vue'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory('/myApps/task-list/'),
  routes: [
    {
      path: '/',
      component: TaskListLayout,
      meta: { requiresAuth: true },
      children: [
        { path: '', redirect: 'dashboard' },
        { path: 'dashboard', name: 'dashboard', component: () => import('@/views/Dashboard.vue') },
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
    if (to.meta.requiresAuth && !authStore.isAuthenticated) { next('/') } else { next() }
  }
})

export default router
