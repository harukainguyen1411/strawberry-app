import { db } from '@/firebase/config'
import type { DsIconName } from '@shared/ui/icons'
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  getDocs,
  addDoc,
  collection,
  query,
  where,
  Timestamp,
  type DocumentData
} from 'firebase/firestore'

// ── Types ──

export interface UserProfile {
  displayName?: string
  email?: string
  photoURL?: string
  role: 'admin' | 'collaborator' | 'user'
  maxAppRequests: number
  notificationChannel: 'email' | 'discord'
  discordUserId?: string
  createdAt?: Timestamp
  lastLoginAt?: Timestamp
}

export interface AppRecord {
  id?: string
  name: string
  description: string
  icon: DsIconName
  category: 'myApps' | 'yourApps'
  ownerId: string
  version: string
  access: { public: boolean; allowTryRequests: boolean }
  settings: { collaboration: boolean; forkable: boolean; personalMode: boolean }
  createdAt?: Timestamp
  updatedAt?: Timestamp
}

export interface AppAccess {
  role: 'owner' | 'user' | 'collaborator' | 'fork-owner'
  grantedAt?: Timestamp
  grantedBy?: string
  sourceAppId?: string
}

// ── User Profile ──

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', userId))
  return snap.exists() ? (snap.data() as UserProfile) : null
}

export async function setUserProfile(userId: string, data: Partial<UserProfile>): Promise<void> {
  await setDoc(doc(db, 'users', userId), {
    ...data,
    lastLoginAt: Timestamp.now()
  }, { merge: true })
}

export async function updateUserProfile(userId: string, data: Partial<UserProfile>): Promise<void> {
  await updateDoc(doc(db, 'users', userId), data as DocumentData)
}

// ── App Registry ──

export async function getAppRecord(appId: string): Promise<AppRecord | null> {
  const snap = await getDoc(doc(db, 'apps', appId))
  return snap.exists() ? { id: snap.id, ...snap.data() } as AppRecord : null
}

export async function updateAppSettings(
  appId: string,
  settings: Partial<AppRecord['settings']>
): Promise<void> {
  const updates: DocumentData = {}
  for (const [key, value] of Object.entries(settings)) {
    updates[`settings.${key}`] = value
  }
  updates['updatedAt'] = Timestamp.now()
  await updateDoc(doc(db, 'apps', appId), updates)
}

export async function getAllApps(): Promise<AppRecord[]> {
  const snap = await getDocs(collection(db, 'apps'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as AppRecord))
}

// ── App Access ──

export async function getUserAppAccess(userId: string): Promise<Array<{ appId: string } & AppAccess>> {
  const snap = await getDocs(collection(db, `users/${userId}/appAccess`))
  return snap.docs.map(d => ({ appId: d.id, ...d.data() } as { appId: string } & AppAccess))
}

export async function getAppAccessForUser(userId: string, appId: string): Promise<AppAccess | null> {
  const snap = await getDoc(doc(db, `users/${userId}/appAccess/${appId}`))
  return snap.exists() ? (snap.data() as AppAccess) : null
}

// ── Access Requests ──

export interface AccessRequest {
  id?: string
  appId: string
  requesterId: string
  status: 'pending' | 'approved' | 'denied'
  createdAt?: Timestamp
  respondedAt?: Timestamp
  respondedBy?: string
}

/**
 * Submit an access request for an app.
 * Enforces rate limit: counts pending+approved requests against user's maxAppRequests.
 * Returns the new request id, or throws if rate limit exceeded.
 */
export async function submitAccessRequest(
  appId: string,
  userId: string,
  userProfile: UserProfile
): Promise<string> {
  // Rate limit: collaborators (-1 = unlimited) and admins are exempt
  if (userProfile.role !== 'admin' && userProfile.role !== 'collaborator') {
    const limit = userProfile.maxAppRequests ?? 1
    if (limit !== -1) {
      // Count existing non-denied requests across all apps for this user
      const allAccessSnap = await getDocs(collection(db, 'apps'))
      let activeRequestCount = 0
      await Promise.all(
        allAccessSnap.docs.map(async (appDoc) => {
          const reqSnap = await getDocs(
            query(
              collection(db, `apps/${appDoc.id}/accessRequests`),
              where('requesterId', '==', userId),
              where('status', 'in', ['pending', 'approved'])
            )
          )
          activeRequestCount += reqSnap.size
        })
      )
      if (activeRequestCount >= limit) {
        throw new Error(`rate_limit_exceeded:${limit}`)
      }
    }
  }

  // Check if a pending request for this app already exists
  const existingSnap = await getDocs(
    query(
      collection(db, `apps/${appId}/accessRequests`),
      where('requesterId', '==', userId),
      where('status', '==', 'pending')
    )
  )
  if (!existingSnap.empty) {
    throw new Error('request_already_pending')
  }

  const ref = await addDoc(collection(db, `apps/${appId}/accessRequests`), {
    appId,
    requesterId: userId,
    status: 'pending',
    createdAt: Timestamp.now()
  })
  return ref.id
}

/**
 * Fetch all access requests for an app (admin/owner use).
 */
export async function getAccessRequests(appId: string): Promise<AccessRequest[]> {
  const snap = await getDocs(collection(db, `apps/${appId}/accessRequests`))
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as AccessRequest))
}

/**
 * Fetch pending requests for an app.
 */
export async function getPendingAccessRequests(appId: string): Promise<AccessRequest[]> {
  const snap = await getDocs(
    query(collection(db, `apps/${appId}/accessRequests`), where('status', '==', 'pending'))
  )
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as AccessRequest))
}

/**
 * Approve an access request: set status + write appAccess grant.
 */
export async function approveAccessRequest(
  appId: string,
  requestId: string,
  requesterId: string,
  responderId: string
): Promise<void> {
  await updateDoc(doc(db, `apps/${appId}/accessRequests/${requestId}`), {
    status: 'approved',
    respondedAt: Timestamp.now(),
    respondedBy: responderId
  } as DocumentData)

  await setDoc(doc(db, `users/${requesterId}/appAccess/${appId}`), {
    role: 'user',
    grantedAt: Timestamp.now(),
    grantedBy: responderId
  })
}

/**
 * Deny an access request.
 */
export async function denyAccessRequest(
  appId: string,
  requestId: string,
  responderId: string
): Promise<void> {
  await updateDoc(doc(db, `apps/${appId}/accessRequests/${requestId}`), {
    status: 'denied',
    respondedAt: Timestamp.now(),
    respondedBy: responderId
  } as DocumentData)
}

/**
 * Check if the current user already has a pending or approved request for an app.
 */
export async function getUserRequestForApp(
  appId: string,
  userId: string
): Promise<AccessRequest | null> {
  const snap = await getDocs(
    query(
      collection(db, `apps/${appId}/accessRequests`),
      where('requesterId', '==', userId)
    )
  )
  if (snap.empty) return null
  // Return the most recent (last doc)
  const d = snap.docs[snap.docs.length - 1]
  return { id: d.id, ...d.data() } as AccessRequest
}

// ── Suggestions (Collaboration) ──

export interface Suggestion {
  id?: string
  authorId: string
  authorName?: string
  title: string
  description: string
  status: 'open' | 'accepted' | 'rejected'
  createdAt?: Timestamp
  respondedAt?: Timestamp
  respondedBy?: string
}

/**
 * Submit a suggestion for a collaborative app.
 * The Firestore security rules require `settings.collaboration == true` on the app.
 */
export async function submitSuggestion(
  appId: string,
  authorId: string,
  authorName: string,
  title: string,
  description: string
): Promise<string> {
  const ref = await addDoc(collection(db, `apps/${appId}/suggestions`), {
    authorId,
    authorName,
    title,
    description,
    status: 'open',
    createdAt: Timestamp.now()
  })
  return ref.id
}

/**
 * Fetch all suggestions for an app, ordered by creation (newest first).
 */
export async function getSuggestions(appId: string): Promise<Suggestion[]> {
  const snap = await getDocs(collection(db, `apps/${appId}/suggestions`))
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as Suggestion))
    .sort((a, b) => {
      const ta = a.createdAt?.seconds ?? 0
      const tb = b.createdAt?.seconds ?? 0
      return tb - ta
    })
}

/**
 * Accept a suggestion (admin/owner only).
 */
export async function acceptSuggestion(
  appId: string,
  suggestionId: string,
  responderId: string
): Promise<void> {
  await updateDoc(doc(db, `apps/${appId}/suggestions/${suggestionId}`), {
    status: 'accepted',
    respondedAt: Timestamp.now(),
    respondedBy: responderId
  } as DocumentData)
}

/**
 * Reject a suggestion (admin/owner only).
 */
export async function rejectSuggestion(
  appId: string,
  suggestionId: string,
  responderId: string
): Promise<void> {
  await updateDoc(doc(db, `apps/${appId}/suggestions/${suggestionId}`), {
    status: 'rejected',
    respondedAt: Timestamp.now(),
    respondedBy: responderId
  } as DocumentData)
}

// ── Forks ──

export interface ForkRecord {
  id?: string
  sourceAppId: string
  forkedByUserId: string
  forkedAppId: string
  createdAt?: Timestamp
}

/**
 * Fork an app: creates /apps/{forkedAppId}, /forks/{forkId} lineage,
 * and /users/{userId}/appAccess/{forkedAppId} with role 'owner'.
 * Returns the forked app ID.
 */
export async function forkApp(
  sourceAppId: string,
  userId: string,
  forkedAppSlug: string
): Promise<string> {
  const source = await getAppRecord(sourceAppId)
  if (!source) throw new Error('source_app_not_found')
  if (!source.settings.forkable) throw new Error('app_not_forkable')

  const forkedAppId = forkedAppSlug
  const now = Timestamp.now()

  // Create new app record
  await setDoc(doc(db, 'apps', forkedAppId), {
    name: `${source.name} (Fork)`,
    description: source.description,
    icon: source.icon,
    category: 'yourApps' as const,
    ownerId: userId,
    version: source.version,
    forkedFrom: sourceAppId,
    access: { public: false, allowTryRequests: false },
    settings: { collaboration: false, forkable: false, personalMode: false },
    createdAt: now,
    updatedAt: now
  })

  // Create fork lineage record
  await addDoc(collection(db, 'forks'), {
    sourceAppId,
    forkedByUserId: userId,
    forkedAppId,
    createdAt: now
  })

  // Grant owner access
  await setDoc(doc(db, `users/${userId}/appAccess/${forkedAppId}`), {
    role: 'owner',
    grantedAt: now,
    grantedBy: userId,
    sourceAppId
  })

  return forkedAppId
}

/**
 * Get the fork lineage for an app (if it was forked).
 */
export async function getForkSource(appId: string): Promise<ForkRecord | null> {
  const snap = await getDocs(
    query(collection(db, 'forks'), where('forkedAppId', '==', appId))
  )
  if (snap.empty) return null
  const d = snap.docs[0]
  return { id: d.id, ...d.data() } as ForkRecord
}

/**
 * Get all forks of a source app.
 */
export async function getForksOfApp(sourceAppId: string): Promise<ForkRecord[]> {
  const snap = await getDocs(
    query(collection(db, 'forks'), where('sourceAppId', '==', sourceAppId))
  )
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as ForkRecord))
}

// ── Notifications ──

export type NotificationType = 'access_request' | 'access_approved' | 'access_denied' | 'new_suggestion'

/**
 * Queue a notification for dispatch by the Cloud Function.
 * Writes to /notifications/{notifId} — the dispatchNotification function picks it up.
 */
export async function queueNotification(
  recipientId: string,
  type: NotificationType,
  payload: Record<string, string>
): Promise<string> {
  const ref = await addDoc(collection(db, 'notifications'), {
    recipientId,
    type,
    payload,
    dispatched: false,
    createdAt: Timestamp.now()
  })
  return ref.id
}
