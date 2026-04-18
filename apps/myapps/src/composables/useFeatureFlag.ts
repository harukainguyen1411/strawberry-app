import { ref, type Ref } from 'vue'
import { fetchAndActivate, getValue } from 'firebase/remote-config'
import { remoteConfig } from '@/firebase/config'

const fetched = ref(false)
let fetchPromise: Promise<void> | null = null

/**
 * Fetch and activate Remote Config values.
 * Safe to call multiple times — deduplicates via fetchPromise.
 */
export function fetchFeatureFlags(): Promise<void> {
  if (fetched.value) return Promise.resolve()
  if (fetchPromise) return fetchPromise

  fetchPromise = fetchAndActivate(remoteConfig)
    .then(() => undefined)
    .catch((e: unknown) => {
      console.warn('[RemoteConfig] fetch failed, using defaults', e)
    })
    .finally(() => {
      fetched.value = true
      fetchPromise = null
    })

  return fetchPromise as Promise<void>
}

/**
 * Returns a reactive boolean ref for a given Remote Config flag key.
 * Before fetch completes, returns the default value from remoteConfigDefaults.
 * After fetch, returns the resolved server value.
 */
export function useFeatureFlag(key: string): Ref<boolean> {
  const flag = ref(getValue(remoteConfig, key).asBoolean())

  // Re-evaluate after fetch completes (in case called before fetch)
  if (!fetched.value) {
    fetchFeatureFlags().then(() => {
      flag.value = getValue(remoteConfig, key).asBoolean()
    })
  }

  return flag
}
