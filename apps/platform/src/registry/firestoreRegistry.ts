import { db } from '@/firebase/config'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  serverTimestamp
} from 'firebase/firestore'
import type { AppManifest } from '@shared/types/AppManifest'

/**
 * Firestore document shape for /apps/{appId}.
 * This is the platform-level registry — distinct from the in-memory AppManifest.
 */
export interface AppRegistryEntry {
  id: string
  name: string
  description: string
  icon: string
  category: 'myApps' | 'yourApps'
  version: string
  ownerId: string | null
  access: {
    public: boolean
    allowTryRequests: boolean
  }
  settings: {
    collaboration: boolean
    forkable: boolean
    personalMode: boolean
  }
  createdAt: unknown
  updatedAt: unknown
}

const APPS_COLLECTION = 'apps'

/**
 * Fetch all app registry entries from Firestore.
 */
export async function fetchRegistryEntries(): Promise<AppRegistryEntry[]> {
  const snapshot = await getDocs(collection(db, APPS_COLLECTION))
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AppRegistryEntry))
}

/**
 * Fetch a single app registry entry.
 */
export async function fetchRegistryEntry(appId: string): Promise<AppRegistryEntry | null> {
  const snap = await getDoc(doc(db, APPS_COLLECTION, appId))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as AppRegistryEntry
}

/**
 * Seed Firestore /apps/{appId} from local manifests.
 * Only creates entries that don't already exist (won't overwrite).
 * Called at startup by an admin, or via the seed script.
 */
export async function seedRegistryFromManifests(
  manifests: AppManifest[],
  adminUid: string
): Promise<{ created: string[]; skipped: string[] }> {
  const created: string[] = []
  const skipped: string[] = []

  for (const manifest of manifests) {
    const ref = doc(db, APPS_COLLECTION, manifest.id)
    const existing = await getDoc(ref)

    if (existing.exists()) {
      skipped.push(manifest.id)
      continue
    }

    const isPublic = manifest.category === 'myApps'

    await setDoc(ref, {
      name: manifest.name,
      description: manifest.description,
      icon: manifest.icon,
      category: manifest.category,
      version: manifest.version,
      ownerId: manifest.category === 'yourApps' ? null : adminUid,
      access: {
        public: isPublic,
        allowTryRequests: !isPublic
      },
      settings: {
        collaboration: manifest.defaultSettings.collaboration,
        forkable: manifest.defaultSettings.forkable,
        personalMode: manifest.defaultSettings.personalMode
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })

    created.push(manifest.id)
  }

  return { created, skipped }
}
