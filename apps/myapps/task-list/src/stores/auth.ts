import { defineStore } from 'pinia'
import { ref, computed, type Ref, type ComputedRef } from 'vue'
import { onAuthChange, signInWithGoogle, logout } from '@/firebase/auth'
import type { User } from 'firebase/auth'

const LOCAL_MODE_KEY = 'readTracker_localMode'

export const useAuthStore = defineStore('auth', () => {
  const user: Ref<User | null> = ref(null)
  const loading: Ref<boolean> = ref(true)
  const localMode: Ref<boolean> = ref(false)
  const syncingFromLocal: Ref<boolean> = ref(false) // Flag to prevent auto-disable during sync

  // Check for local mode preference on initialization
  const initializeLocalMode = () => {
    const stored = localStorage.getItem(LOCAL_MODE_KEY)
    if (stored === 'true') {
      localMode.value = true
      loading.value = false
    }
    // Don't auto-enable here - wait for auth check
  }

  // Initialize auth state listener
  onAuthChange((firebaseUser: User | null) => {
    user.value = firebaseUser
    loading.value = false
    
    if (firebaseUser) {
      // User is authenticated - disable local mode (unless we're syncing from local)
      if (!syncingFromLocal.value) {
        localMode.value = false
        localStorage.removeItem(LOCAL_MODE_KEY)
      }
    } else {
      // User is not authenticated - auto-enable local mode if not already set
      const stored = localStorage.getItem(LOCAL_MODE_KEY)
      if (stored !== 'true') {
        localMode.value = true
        localStorage.setItem(LOCAL_MODE_KEY, 'true')
      }
    }
  })

  // Initialize on store creation
  initializeLocalMode()

  // Add timeout to ensure loading state doesn't block UI indefinitely
  // If Firebase auth doesn't respond within 3 seconds, assume not authenticated
  setTimeout(() => {
    if (loading.value && !localMode.value && !user.value) {
      console.warn('Firebase auth initialization timeout - auto-enabling local mode')
      localMode.value = true
      localStorage.setItem(LOCAL_MODE_KEY, 'true')
      loading.value = false
    }
  }, 3000)

  const isAuthenticated: ComputedRef<boolean> = computed(() => !!user.value || localMode.value)

  const enableLocalMode = (): void => {
    localMode.value = true
    localStorage.setItem(LOCAL_MODE_KEY, 'true')
    loading.value = false
  }

  const disableLocalMode = (): void => {
    localMode.value = false
    localStorage.removeItem(LOCAL_MODE_KEY)
  }

  const login = async (skipLocalModeDisable: boolean = false): Promise<User> => {
    try {
      if (localMode.value) {
        syncingFromLocal.value = true
      }
      const userCredential = await signInWithGoogle()
      user.value = userCredential
      // Only disable local mode if not syncing (sync will handle it)
      if (!skipLocalModeDisable && !localMode.value) {
        disableLocalMode()
      }
      return userCredential
    } catch (error) {
      syncingFromLocal.value = false
      console.error('Login error:', error)
      throw error
    }
  }

  const completeLocalModeSync = (): void => {
    // Called after sync is complete to disable local mode
    syncingFromLocal.value = false
    disableLocalMode()
  }

  const signOut = async (): Promise<void> => {
    try {
      if (localMode.value) {
        // In local mode, just clear local mode flag
        disableLocalMode()
      } else {
        // In authenticated mode, sign out from Firebase
        await logout()
        user.value = null
      }
    } catch (error) {
      console.error('Logout error:', error)
      throw error
    }
  }

  const clearLocalData = (): void => {
    // Clear only data, keep localMode enabled
    const STORAGE_KEYS = [
      'readTracker_books',
      'readTracker_sessions',
      'readTracker_goals',
      'readTracker_localModeWarningDismissed'
    ]
    STORAGE_KEYS.forEach(key => localStorage.removeItem(key))
    // Don't disable local mode - keep it enabled
    // Reload the page to reset app state
    window.location.reload()
  }

  return {
    user,
    loading,
    isAuthenticated,
    localMode,
    syncingFromLocal,
    enableLocalMode,
    disableLocalMode,
    login,
    signOut,
    clearLocalData,
    completeLocalModeSync
  }
})
