import type { AppManifest } from '@shared/types/AppManifest'
import {
  fetchRegistryEntries,
  seedRegistryFromManifests,
  type AppRegistryEntry
} from './firestoreRegistry'

// All app manifests registered on the platform.
// Import lazily so each app chunk is only loaded when navigated to.
const appRegistry: AppManifest[] = []

// Firestore registry entries (loaded alongside manifests)
let registryEntries: AppRegistryEntry[] = []

export async function loadRegistry(): Promise<AppManifest[]> {
  if (appRegistry.length > 0) return appRegistry

  const [readTracker, portfolioTracker, taskList, bee] = await Promise.all([
    import('../../myapps/read-tracker/index'),
    import('../../myapps/portfolio-tracker/index'),
    import('../../myapps/task-list/index'),
    import('../../yourApps/bee/index')
  ])

  appRegistry.push(
    readTracker.default,
    portfolioTracker.default,
    taskList.default,
    bee.default
  )

  // Load Firestore registry entries in parallel (non-blocking)
  try {
    registryEntries = await fetchRegistryEntries()
  } catch {
    // Firestore may not be seeded yet — catalog still works from manifests alone
    registryEntries = []
  }

  return appRegistry
}

export function getRegistry(): AppManifest[] {
  return appRegistry
}

export function getRegistryEntries(): AppRegistryEntry[] {
  return registryEntries
}

export function getRegistryEntry(appId: string): AppRegistryEntry | undefined {
  return registryEntries.find(e => e.id === appId)
}

export function getApp(id: string): AppManifest | undefined {
  return appRegistry.find(app => app.id === id)
}

/**
 * Seed Firestore registry from loaded manifests. Admin-only operation.
 */
export async function seedRegistry(adminUid: string) {
  const result = await seedRegistryFromManifests(appRegistry, adminUid)
  if (result.created.length > 0) {
    // Refresh entries after seeding
    registryEntries = await fetchRegistryEntries()
  }
  return result
}
