import { onAuthStateChanged } from 'firebase/auth'
import { auth } from './config'
import { fetchFeatureFlags } from '@/composables/useFeatureFlag'

/**
 * Call once at app startup (in App.vue onMounted).
 * Re-fetches Remote Config flags whenever the user logs in/out.
 *
 * Note: setCustomSignals (for per-user targeting) requires firebase@11+.
 * The Remote Config template uses condition targeting via the Firebase console
 * instead (conditions evaluate server-side before fetch).
 */
export function initRemoteConfigSignals(): void {
  onAuthStateChanged(auth, async () => {
    // Re-fetch after auth state changes so per-user conditions re-evaluate
    await fetchFeatureFlags()
  })
}
