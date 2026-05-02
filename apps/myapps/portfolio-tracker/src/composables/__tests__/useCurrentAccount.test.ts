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

describe('V0.13 — useCurrentAccount', () => {
  it('exposes currentUid mirroring useAuth().uid for the signed-in user', async () => {
    mockUid.value = 'user-123'
    const { useCurrentAccount } = await import('@/composables/useCurrentAccount')
    const { currentUid } = useCurrentAccount()
    expect(currentUid.value).toBe('user-123')
  })

  it('reactively flips to null when useAuth().uid becomes null (sign-out)', async () => {
    mockUid.value = 'user-456'
    const { useCurrentAccount } = await import('@/composables/useCurrentAccount')
    const { currentUid } = useCurrentAccount()
    expect(currentUid.value).toBe('user-456')

    mockUid.value = null
    expect(currentUid.value).toBeNull()
  })

  it('does not expose multi-account affordances (no accounts, no switchTo)', async () => {
    const { useCurrentAccount } = await import('@/composables/useCurrentAccount')
    const exposed = useCurrentAccount()
    expect((exposed as unknown as Record<string, unknown>).accounts).toBeUndefined()
    expect((exposed as unknown as Record<string, unknown>).switchTo).toBeUndefined()
  })
})
