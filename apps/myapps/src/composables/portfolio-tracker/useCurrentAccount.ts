/**
 * V0.13 — useCurrentAccount: single-account context for v0.
 *
 * v0 ships one account per user (the signed-in user). `currentUid` is a
 * read-only computed mirror of `useAuth().uid`. There is no
 * AccountSelector UI, no `accounts` array, no `switchTo` — multi-account
 * affordances are deferred to v1 (per V0 plan + ADR §10).
 *
 * Reactivity flows from useAuth():
 *   - signed-in user → currentUid = that uid
 *   - sign-out / not yet authenticated → currentUid = null
 *
 * Refs V0.13
 */

import { computed, type ComputedRef } from 'vue'
import { useAuth } from './useAuth'

export interface UseCurrentAccountReturn {
  currentUid: ComputedRef<string | null>
}

export function useCurrentAccount(): UseCurrentAccountReturn {
  const { uid } = useAuth()
  const currentUid = computed(() => uid.value)
  return { currentUid }
}
