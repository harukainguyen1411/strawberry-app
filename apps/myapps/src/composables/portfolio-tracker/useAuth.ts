/**
 * useAuth — Firebase Auth state composable for the portfolio tracker.
 *
 * Exposes the current Firebase user as reactive refs. Used throughout the
 * portfolio app for auth-gated routes and user identification.
 *
 * Refs V0.9
 */

import { ref, computed } from 'vue'
import { getAuth, onAuthStateChanged, type User } from 'firebase/auth'
import app from '@/firebase/config'

const auth = getAuth(app)

// Singleton state — shared across all useAuth() calls in the app
const _user = ref<User | null>(null)
const _loading = ref(true)

// Set up one global listener (module executes once; singleton state is shared)
onAuthStateChanged(auth, (u) => {
  _user.value = u
  _loading.value = false
})

/**
 * useAuth — reactive Firebase auth state.
 *
 * @returns {
 *   user          — raw Firebase User | null
 *   uid           — user UID string | null
 *   email         — user email string | null
 *   isAuthenticated — boolean, true when user is signed in
 *   loading       — boolean, true during initial auth check
 * }
 */
export function useAuth() {
  const user = _user
  const loading = _loading
  const uid = computed(() => _user.value?.uid ?? null)
  const email = computed(() => _user.value?.email ?? null)
  const isAuthenticated = computed(() => _user.value !== null)

  return {
    user,
    uid,
    email,
    isAuthenticated,
    loading,
  }
}
