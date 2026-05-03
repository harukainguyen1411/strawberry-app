// Local storage service for offline/local mode
// Mimics Firestore API structure for easy switching between Firebase and localStorage

import type { Timestamp } from 'firebase/firestore'
import type { Book, ReadingSession, Goal } from '@/firebase/firestore'

const STORAGE_KEYS = {
  BOOKS: 'readTracker_books',
  SESSIONS: 'readTracker_sessions',
  GOALS: 'readTracker_goals'
}

// Helper to convert Timestamp-like objects to proper format
const toTimestamp = (date: Date | string | Timestamp): Timestamp => {
  if (date instanceof Date) {
    return { seconds: Math.floor(date.getTime() / 1000), nanoseconds: 0 } as Timestamp
  }
  if (typeof date === 'string') {
    return { seconds: Math.floor(new Date(date).getTime() / 1000), nanoseconds: 0 } as Timestamp
  }
  return date
}

// Helper to convert Timestamp to Date for sorting
const timestampToDate = (ts: Timestamp | { seconds: number; nanoseconds?: number }): Date => {
  return new Date(ts.seconds * 1000)
}

// Helper to create a Timestamp-like object with toDate() method from plain object
const normalizeTimestamp = (ts: Timestamp | { seconds: number; nanoseconds?: number }): Timestamp & { toDate: () => Date } => {
  const normalized = {
    seconds: ts.seconds,
    nanoseconds: ts.nanoseconds || 0,
    toDate: () => new Date(ts.seconds * 1000)
  } as Timestamp & { toDate: () => Date }
  
  return normalized
}

// Helper to normalize Timestamp fields in an object
const normalizeTimestamps = <T extends Record<string, any>>(obj: T, timestampFields: (keyof T)[]): T => {
  const normalized = { ...obj }
  for (const field of timestampFields) {
    if (normalized[field] && typeof normalized[field] === 'object' && 'seconds' in normalized[field]) {
      normalized[field] = normalizeTimestamp(normalized[field] as Timestamp) as T[keyof T]
    }
  }
  return normalized
}

// Reading Sessions
export const getReadingSessions = async (): Promise<ReadingSession[]> => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.SESSIONS)
    if (!stored) return []
    
    const sessions: ReadingSession[] = JSON.parse(stored)
    // Normalize Timestamps to have toDate() method
    const normalized = sessions.map(session => 
      normalizeTimestamps(session, ['date', 'startTime', 'endTime', 'createdAt'])
    )
    // Sort by date descending
    return normalized.sort((a, b) => {
      const dateA = timestampToDate(a.date)
      const dateB = timestampToDate(b.date)
      return dateB.getTime() - dateA.getTime()
    })
  } catch (error) {
    console.error('Error loading reading sessions from localStorage:', error)
    return []
  }
}

export const addReadingSession = async (sessionData: Omit<ReadingSession, 'id' | 'createdAt'>): Promise<{ id: string }> => {
  try {
    const sessions = await getReadingSessions()
    const newSession: ReadingSession = {
      ...sessionData,
      id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: toTimestamp(new Date())
    }
    
    sessions.push(newSession)
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions))
    
    return { id: newSession.id! }
  } catch (error) {
    console.error('Error adding reading session to localStorage:', error)
    throw error
  }
}

export const updateReadingSession = async (sessionId: string, updates: Partial<ReadingSession>): Promise<void> => {
  try {
    const sessions = await getReadingSessions()
    const index = sessions.findIndex(s => s.id === sessionId)
    
    if (index === -1) {
      throw new Error('Session not found')
    }
    
    sessions[index] = { ...sessions[index], ...updates }
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions))
  } catch (error) {
    console.error('Error updating reading session in localStorage:', error)
    throw error
  }
}

export const deleteReadingSession = async (sessionId: string): Promise<void> => {
  try {
    const sessions = await getReadingSessions()
    const filtered = sessions.filter(s => s.id !== sessionId)
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(filtered))
  } catch (error) {
    console.error('Error deleting reading session from localStorage:', error)
    throw error
  }
}

// Books
export const getBooks = async (): Promise<Book[]> => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.BOOKS)
    if (!stored) return []
    
    const books: Book[] = JSON.parse(stored)
    // Normalize Timestamps to have toDate() method
    const normalized = books.map(book => 
      normalizeTimestamps(book, ['startDate', 'completedDate', 'createdAt'])
    )
    // Sort by createdAt descending
    return normalized.sort((a, b) => {
      if (!a.createdAt || !b.createdAt) return 0
      const dateA = timestampToDate(a.createdAt)
      const dateB = timestampToDate(b.createdAt)
      return dateB.getTime() - dateA.getTime()
    })
  } catch (error) {
    console.error('Error loading books from localStorage:', error)
    return []
  }
}

export const addBook = async (bookData: Omit<Book, 'id' | 'createdAt'>): Promise<{ id: string }> => {
  try {
    const books = await getBooks()
    const newBook: Book = {
      ...bookData,
      id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: toTimestamp(new Date())
    }
    
    books.push(newBook)
    localStorage.setItem(STORAGE_KEYS.BOOKS, JSON.stringify(books))
    
    return { id: newBook.id! }
  } catch (error) {
    console.error('Error adding book to localStorage:', error)
    throw error
  }
}

export const updateBook = async (bookId: string, updates: Partial<Book>): Promise<void> => {
  try {
    const books = await getBooks()
    const index = books.findIndex(b => b.id === bookId)
    
    if (index === -1) {
      throw new Error('Book not found')
    }
    
    books[index] = { ...books[index], ...updates }
    localStorage.setItem(STORAGE_KEYS.BOOKS, JSON.stringify(books))
  } catch (error) {
    console.error('Error updating book in localStorage:', error)
    throw error
  }
}

export const deleteBook = async (bookId: string): Promise<void> => {
  try {
    const books = await getBooks()
    const filtered = books.filter(b => b.id !== bookId)
    localStorage.setItem(STORAGE_KEYS.BOOKS, JSON.stringify(filtered))
  } catch (error) {
    console.error('Error deleting book from localStorage:', error)
    throw error
  }
}

// Goals
export const getGoals = async (): Promise<Goal[]> => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.GOALS)
    if (!stored) return []
    
    return JSON.parse(stored) as Goal[]
  } catch (error) {
    console.error('Error loading goals from localStorage:', error)
    return []
  }
}

export const addGoal = async (goalData: Omit<Goal, 'id'>): Promise<{ id: string }> => {
  try {
    const goals = await getGoals()
    const newGoal: Goal = {
      ...goalData,
      id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }
    
    goals.push(newGoal)
    localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(goals))
    
    return { id: newGoal.id! }
  } catch (error) {
    console.error('Error adding goal to localStorage:', error)
    throw error
  }
}

export const updateGoal = async (goalId: string, updates: Partial<Goal>): Promise<void> => {
  try {
    const goals = await getGoals()
    const index = goals.findIndex(g => g.id === goalId)
    
    if (index === -1) {
      throw new Error('Goal not found')
    }
    
    goals[index] = { ...goals[index], ...updates }
    localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(goals))
  } catch (error) {
    console.error('Error updating goal in localStorage:', error)
    throw error
  }
}

export const deleteGoal = async (goalId: string): Promise<void> => {
  try {
    const goals = await getGoals()
    const filtered = goals.filter(g => g.id !== goalId)
    localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(filtered))
  } catch (error) {
    console.error('Error deleting goal from localStorage:', error)
    throw error
  }
}

