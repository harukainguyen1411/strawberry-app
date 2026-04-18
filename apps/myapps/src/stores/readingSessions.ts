import { defineStore } from 'pinia'
import { ref, type Ref } from 'vue'
import { getReadingSessions as getReadingSessionsFirebase, addReadingSession as addReadingSessionFirebase, updateReadingSession as updateReadingSessionFirebase, deleteReadingSession as deleteReadingSessionFirebase, type ReadingSession } from '@/firebase/firestore'
import { getReadingSessions as getReadingSessionsLocal, addReadingSession as addReadingSessionLocal, updateReadingSession as updateReadingSessionLocal, deleteReadingSession as deleteReadingSessionLocal } from '@/storage/localStorage'
import { useAuthStore } from './auth'
import type { DocumentReference, DocumentData } from 'firebase/firestore'

export const useReadingSessionsStore = defineStore('readingSessions', () => {
  const sessions: Ref<ReadingSession[]> = ref([])
  const loading: Ref<boolean> = ref(false)
  const error: Ref<string | null> = ref(null)

  const fetchSessions = async (): Promise<void> => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return

    loading.value = true
    error.value = null
    try {
      if (authStore.localMode) {
        sessions.value = await getReadingSessionsLocal()
      } else if (authStore.user) {
        sessions.value = await getReadingSessionsFirebase(authStore.user.uid)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load reading sessions'
      error.value = errorMessage
      console.error('Error fetching sessions:', err)
    } finally {
      loading.value = false
    }
  }

  const createSession = async (sessionData: Omit<ReadingSession, 'id' | 'createdAt'>): Promise<DocumentReference<DocumentData> | { id: string }> => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) throw new Error('User not authenticated')

    error.value = null
    try {
      let docRef: DocumentReference<DocumentData> | { id: string }
      if (authStore.localMode) {
        docRef = await addReadingSessionLocal(sessionData)
      } else if (authStore.user) {
        docRef = await addReadingSessionFirebase(authStore.user.uid, sessionData)
      } else {
        throw new Error('User not authenticated')
      }
      await fetchSessions() // Refresh list
      return docRef
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create reading session'
      error.value = errorMessage
      console.error('Error creating session:', err)
      throw err
    }
  }

  const updateSession = async (sessionId: string, updates: Partial<ReadingSession>): Promise<void> => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) throw new Error('User not authenticated')

    error.value = null
    try {
      if (authStore.localMode) {
        await updateReadingSessionLocal(sessionId, updates)
      } else if (authStore.user) {
        await updateReadingSessionFirebase(authStore.user.uid, sessionId, updates)
      } else {
        throw new Error('User not authenticated')
      }
      await fetchSessions() // Refresh list
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update reading session'
      error.value = errorMessage
      console.error('Error updating session:', err)
      throw err
    }
  }

  const removeSession = async (sessionId: string): Promise<void> => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) throw new Error('User not authenticated')

    error.value = null
    try {
      if (authStore.localMode) {
        await deleteReadingSessionLocal(sessionId)
      } else if (authStore.user) {
        await deleteReadingSessionFirebase(authStore.user.uid, sessionId)
      } else {
        throw new Error('User not authenticated')
      }
      await fetchSessions() // Refresh list
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete reading session'
      error.value = errorMessage
      console.error('Error deleting session:', err)
      throw err
    }
  }

  return {
    sessions,
    loading,
    error,
    fetchSessions,
    createSession,
    updateSession,
    removeSession
  }
})
