import type { Router, RouteRecordRaw } from 'vue-router'
import { loadRegistry } from '../registry/appRegistry'
import type { AppManifest } from '@shared/types/AppManifest'

/**
 * Loads all app manifests and registers their routes into the router.
 * Called once on app startup before the router is mounted.
 */
export async function loadApps(router: Router): Promise<void> {
  const manifests = await loadRegistry()

  for (const manifest of manifests) {
    const prefix = manifest.category === 'myApps' ? '/myApps' : '/yourApps'

    const route: RouteRecordRaw = {
      path: `${prefix}/${manifest.id}`,
      meta: { requiresAuth: true, appId: manifest.id, appCategory: manifest.category },
      children: manifest.routes
    }

    router.addRoute(route)

    // Legacy redirect: keep old paths working (e.g. /read-tracker -> /myApps/read-tracker)
    if (manifest.category === 'myApps') {
      router.addRoute({
        path: `/${manifest.id}`,
        redirect: `${prefix}/${manifest.id}`
      })
    }
  }
}

export function buildAppRoute(manifest: AppManifest): RouteRecordRaw {
  const prefix = manifest.category === 'myApps' ? '/myApps' : '/yourApps'
  return {
    path: `${prefix}/${manifest.id}`,
    meta: { requiresAuth: true, appId: manifest.id },
    children: manifest.routes
  }
}
