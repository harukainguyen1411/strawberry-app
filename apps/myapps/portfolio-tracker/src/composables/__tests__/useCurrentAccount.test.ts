/**
 * V0.13 — useCurrentAccount composable.
 *
 * v0 ships single-account: the signed-in user is the only context.
 * `useCurrentAccount` exposes `currentUid` as a read-only computed mirror
 * of `useAuth().uid`. No `accounts` array, no `switchTo` — multi-account
 * affordances are deferred to v1 (per ADR §10 v0 row).
 *
 * Refs V0.13
 */

import { describe, it, expect, vi } from 'vitest'
import { ref, computed } from 'vue'

const mockUid = ref<string | null>('user-123')

vi.mock('@/composables/useAuth', () => ({
  useAuth: () => ({
    uid: computed(() => mockUid.value),
  }),
}))

import { useCurrentAccount } from '@/composables/useCurrentAccount'

describe('V0.13 — useCurrentAccount', () => {
  it('exposes currentUid mirroring useAuth().uid for the signed-in user', () => {
    mockUid.value = 'user-123'
    const { currentUid } = useCurrentAccount()
    expect(currentUid.value).toBe('user-123')
  })

  it('reactively flips to null when useAuth().uid becomes null (sign-out)', () => {
    mockUid.value = 'user-456'
    const { currentUid } = useCurrentAccount()
    expect(currentUid.value).toBe('user-456')

    mockUid.value = null
    expect(currentUid.value).toBeNull()
  })

  it('exposes only currentUid — no accounts, no switchTo, no multi-account surface', () => {
    const exposed = useCurrentAccount()
    expect(Object.keys(exposed)).toEqual(['currentUid'])
  })
})
