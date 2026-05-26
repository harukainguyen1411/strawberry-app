/**
 * A.6 — usePortfolio: regression guards for the FxRateMissingError ↔ status
 * recovery loop.
 *
 * V0.17 deferred unit testing of usePortfolio to V0.18's Playwright happy
 * path, but that path uses USD-only fixtures so the multi-currency code path
 * was never exercised. Manual driving of V0.18 surfaced an infinite reactive
 * loop:
 *
 *   derived computed throws FxRateMissingError → returns { fxError: err }
 *   → watcher sets status = 'error'
 *   → derived re-runs (depends on status) → early-returns { fxError: null }
 *   → watcher's recovery branch fires → status = 'ready'
 *   → derived re-runs → throws again → loop until Vue's recursion guard fires
 *
 * A.6.1 is the failing test for the bug. A.6.2 covers the happy recovery
 * path (fx doc updates with the missing pair).
 *
 * Refs V0.18 hotfix.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, effectScope, nextTick, watch } from 'vue'

const mockUid = ref<string | null>(null)

vi.mock('@/composables/portfolio-tracker/useAuth', () => ({
  useAuth: () => ({
    uid: mockUid,
  }),
}))

vi.mock('@/firebase/config', () => ({
  db: {},
}))

interface SnapshotHandlers {
  positions: ((snap: { docs: Array<{ data: () => unknown }> }) => void) | null
  cash: ((snap: { docs: Array<{ data: () => unknown }> }) => void) | null
  user: ((snap: { data: () => unknown }) => void) | null
  fx: ((snap: { data: () => unknown }) => void) | null
}

const handlers: SnapshotHandlers = {
  positions: null,
  cash: null,
  user: null,
  fx: null,
}

vi.mock('firebase/firestore', () => ({
  // collection(db, 'users', uid, 'positions' | 'cash')
  collection: (...args: unknown[]) => ({ __kind: 'collection', __name: args[args.length - 1] }),
  // doc(db, 'users', uid)              → user
  // doc(db, 'users', uid, 'meta', 'fx') → fx
  doc: (...args: unknown[]) => {
    const last = args[args.length - 1]
    if (last === 'fx') return { __kind: 'doc', __name: 'fx' }
    return { __kind: 'doc', __name: 'user' }
  },
  onSnapshot: (
    ref: { __kind: string; __name: string },
    success: (snap: unknown) => void,
  ) => {
    handlers[ref.__name as keyof SnapshotHandlers] = success as never
    return () => {}
  },
}))

import { usePortfolio, FxRateMissingError } from '@/composables/portfolio-tracker/usePortfolio'

function withScope<T>(fn: () => T): { value: T; scope: ReturnType<typeof effectScope> } {
  const scope = effectScope()
  let value!: T
  scope.run(() => {
    value = fn()
  })
  return { value, scope }
}

beforeEach(() => {
  mockUid.value = null
  handlers.positions = null
  handlers.cash = null
  handlers.user = null
  handlers.fx = null
})

describe('A.6 — usePortfolio FX-error reactive stability', () => {
  it('A.6.1 persistent FxRateMissingError flips status to error exactly once (no infinite loop)', async () => {
    const { value: pf, scope } = withScope(() => usePortfolio())
    try {
      // Track every status transition. On the bug this fires hundreds of
      // times before Vue's recursion guard kicks in; on the fix it transitions
      // a bounded number of times (idle → loading → ready → error).
      const transitions: string[] = []
      scope.run(() => {
        watch(
          () => pf.status.value,
          (s) => transitions.push(s),
          { flush: 'sync' },
        )
      })

      mockUid.value = 'user-A'
      await nextTick()

      // Drive each subscription. Position is in EUR, cash is empty,
      // baseCurrency is USD, fx doc has no EUR→USD rate → conversion throws.
      handlers.positions!({
        docs: [
          {
            data: () => ({
              ticker: 'BAYN',
              broker: 'T212',
              quantity: 10,
              avgCost: { amount: 50, currency: 'EUR' },
              marketValue: { amount: 60, currency: 'EUR' },
            }),
          },
        ],
      })
      handlers.cash!({ docs: [] })
      handlers.user!({ data: () => ({ baseCurrency: 'USD' }) })
      handlers.fx!({ data: () => ({ rates: {}, overrides: {} }) })

      // Allow a few microtask drains for any pending watchers to settle.
      for (let i = 0; i < 5; i++) await nextTick()

      // The bug produces dozens-to-hundreds of transitions; the fix produces
      // ≤ 4 (idle → loading → ready → error). Cap generously at 10 so a
      // future scheduler change doesn't cause flakes, while still catching
      // the loop.
      expect(transitions.length).toBeLessThanOrEqual(10)

      // Final state is the error state, surfacing the FX rate gap.
      expect(pf.status.value).toBe('error')
      expect(pf.error.value).toBeInstanceOf(FxRateMissingError)
    } finally {
      scope.stop()
    }
  })

  it('A.6.2 fx doc update with the missing pair recovers from error to ready', async () => {
    const { value: pf, scope } = withScope(() => usePortfolio())
    try {
      mockUid.value = 'user-B'
      await nextTick()

      handlers.positions!({
        docs: [
          {
            data: () => ({
              ticker: 'BAYN',
              broker: 'T212',
              quantity: 10,
              avgCost: { amount: 50, currency: 'EUR' },
              marketValue: { amount: 60, currency: 'EUR' },
            }),
          },
        ],
      })
      handlers.cash!({ docs: [] })
      handlers.user!({ data: () => ({ baseCurrency: 'USD' }) })
      handlers.fx!({ data: () => ({ rates: {}, overrides: {} }) })

      for (let i = 0; i < 5; i++) await nextTick()
      expect(pf.status.value).toBe('error')

      // FX doc updates with the missing pair — should recover.
      handlers.fx!({ data: () => ({ rates: { 'EUR->USD': 1.1 }, overrides: {} }) })
      for (let i = 0; i < 5; i++) await nextTick()

      expect(pf.status.value).toBe('ready')
      expect(pf.error.value).toBeNull()
      expect(pf.holdings.value.length).toBe(1)
      expect(pf.holdings.value[0].marketValue.amount).toBeCloseTo(66, 2)
    } finally {
      scope.stop()
    }
  })
})
