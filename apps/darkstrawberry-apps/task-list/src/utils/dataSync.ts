// Data synchronization service for syncing local storage data to Firebase
import { getBooks as getBooksLocal } from '@/storage/localStorage'
import { getReadingSessions as getReadingSessionsLocal } from '@/storage/localStorage'
import { getGoals as getGoalsLocal } from '@/storage/localStorage'
import {
  getBooks as getBooksFirebase,
  addBook as addBookFirebase,
  getReadingSessions as getReadingSessionsFirebase,
  addReadingSession as addReadingSessionFirebase,
  getGoals as getGoalsFirebase,
  addGoal as addGoalFirebase
} from '@/firebase/firestore'
import { Timestamp } from 'firebase/firestore'

// Helper to convert Timestamp-like objects to Firebase Timestamp
const toFirebaseTimestamp = (ts: any): Timestamp => {
  if (ts instanceof Timestamp) {
    return ts
  }
  if (ts && typeof ts === 'object' && 'seconds' in ts) {
    return Timestamp.fromMillis(ts.seconds * 1000 + (ts.nanoseconds || 0) / 1000000)
  }
  if (ts && typeof ts.toDate === 'function') {
    return Timestamp.fromDate(ts.toDate())
  }
  // Fallback: try to parse as date
  const date = ts instanceof Date ? ts : new Date(ts)
  return Timestamp.fromDate(date)
}

// Helper to convert object with Timestamp fields
const convertTimestamps = <T extends Record<string, any>>(
  obj: T,
  timestampFields: (keyof T)[]
): T => {
  const converted = { ...obj }
  for (const field of timestampFields) {
    if (converted[field]) {
      converted[field] = toFirebaseTimestamp(converted[field]) as T[keyof T]
    }
  }
  return converted
}

export type SyncStrategy = 'useAccount' | 'merge'

export interface SyncResult {
  success: boolean
  booksSynced: number
  sessionsSynced: number
  goalsSynced: number
  error?: string
}

/**
 * Check if account already has data
 */
export const checkAccountHasData = async (userId: string): Promise<boolean> => {
  try {
    const [books, sessions, goals] = await Promise.all([
      getBooksFirebase(userId),
      getReadingSessionsFirebase(userId),
      getGoalsFirebase(userId)
    ])
    return books.length > 0 || sessions.length > 0 || goals.length > 0
  } catch (error) {
    console.error('Error checking account data:', error)
    return false
  }
}

/**
 * Sync local data to Firebase based on strategy
 */
export const syncLocalToFirebase = async (
  userId: string,
  strategy: SyncStrategy = 'merge'
): Promise<SyncResult> => {
  try {
    const localBooks = await getBooksLocal()
    const localSessions = await getReadingSessionsLocal()
    const localGoals = await getGoalsLocal()

    let booksSynced = 0
    let sessionsSynced = 0
    let goalsSynced = 0

    if (strategy === 'useAccount') {
      // Don't sync, just use account data
      return {
        success: true,
        booksSynced: 0,
        sessionsSynced: 0,
        goalsSynced: 0
      }
    }

    if (strategy === 'merge') {
      // Merge both: add local data to account (keep both)
      // Sync books (only add if not duplicate)
      const accountBooks = await getBooksFirebase(userId)
      const accountBookTitles = new Set(accountBooks.map(b => `${b.title}|${b.author}`))

      for (const book of localBooks) {
        const bookKey = `${book.title}|${book.author}`
        if (!accountBookTitles.has(bookKey)) {
          const { id, ...bookData } = book
          const convertedBook = convertTimestamps(bookData, ['startDate', 'completedDate', 'createdAt'])
          await addBookFirebase(userId, convertedBook)
          booksSynced++
        }
      }

      // Sync sessions (add all, they're time-based)
      for (const session of localSessions) {
        const { id, ...sessionData } = session
        const convertedSession = convertTimestamps(sessionData, ['date', 'startTime', 'endTime', 'createdAt'])
        await addReadingSessionFirebase(userId, convertedSession)
        sessionsSynced++
      }

      // Sync goals (add all, they're time-based)
      for (const goal of localGoals) {
        const { id, ...goalData } = goal
        await addGoalFirebase(userId, goalData)
        goalsSynced++
      }
    }

    return {
      success: true,
      booksSynced,
      sessionsSynced,
      goalsSynced
    }
  } catch (error) {
    console.error('Error syncing data:', error)
    return {
      success: false,
      booksSynced: 0,
      sessionsSynced: 0,
      goalsSynced: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
