/**
 * V0.17 — DashboardView wire-up.
 * A.6.3 — DashboardView error-state template (extends V0.17 contract).
 *
 * Per design spec §4.3 + plan task V0.17. The view consumes a single
 * usePortfolio composable that returns derived `holdings`, `summary`, and
 * `baseCurrency`. Branches:
 *   - status='loading' → SummaryCard + HoldingsTable in skeleton state
 *   - status='ready'  + holdings.length===0 + cashTotal===0 → EmptyState
 *   - status='ready'  + non-empty → SummaryCard + HoldingsTable rendered
 *   - status='error'  → error banner with FxRateMissingError pair + recovery CTAs (A.6.3)
 *
 * Per coordinator decision 2026-05-02 (recorded in PR #82 body): tests
 * mock usePortfolio. Real Firestore wiring is exercised end-to-end in
 * V0.18's Playwright happy path.
 *
 * The mock spreads `...actual` so `FxRateMissingError` (the real class
 * exported by usePortfolio.ts) is reachable in tests — the impl uses
 * `instanceof FxRateMissingError`, so the test must drive that branch
 * with a real instance, not a duck-typed Error.
 *
 * Refs V0.17, A.6.3
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'
import type { CurrencyCode, Holding } from '@/types/firestore'
import {
  FxRateMissingError,
  type PortfolioStatus,
  type PortfolioSummary,
  type UsePortfolioReturn,
} from '@/composables/usePortfolio'

// Mutable refs that the mocked composable returns; tests mutate these
// before mounting to drive the branching logic.
const mockStatus: Ref<PortfolioStatus> = ref('loading')
const mockHoldings: Ref<Holding[]> = ref<Holding[]>([])
const mockSummary: Ref<PortfolioSummary | null> = ref<PortfolioSummary | null>(null)
const mockBaseCurrency: Ref<CurrencyCode | null> = ref<CurrencyCode | null>('USD')
const mockError: Ref<Error | null> = ref<Error | null>(null)

// Mirror the real composable's `loading` expression: idle counts as
// loading too (no uid yet → skeleton). Drift here would let regressions
// in the real composable's status state machine pass silently.
//
// FxRateMissingError is re-declared inside the factory — keeps the
// test off the real firebase/config side-effect chain (vitest has no
// VITE_FIREBASE_* env). The impl's `instanceof FxRateMissingError`
// check resolves against the same mocked class because both the test
// and DashboardView.vue import from `@/composables/usePortfolio` and
// the mock replaces that export for both.
vi.mock('@/composables/usePortfolio', () => {
  class FxRateMissingError extends Error {
    constructor(public readonly pair: string) {
      super(`FX rate missing for ${pair}`)
      this.name = 'FxRateMissingError'
    }
  }
  return {
    FxRateMissingError,
    usePortfolio: (): UsePortfolioReturn => ({
      status: computed(() => mockStatus.value) as ComputedRef<PortfolioStatus>,
      loading: computed(() => mockStatus.value === 'loading' || mockStatus.value === 'idle'),
      holdings: computed(() => mockHoldings.value) as ComputedRef<Holding[]>,
      summary: computed(() => mockSummary.value) as ComputedRef<PortfolioSummary | null>,
      baseCurrency: computed(() => mockBaseCurrency.value) as ComputedRef<CurrencyCode | null>,
      error: computed(() => mockError.value) as ComputedRef<Error | null>,
    }),
  }
})

let DashboardView: typeof import('@/views/DashboardView.vue')['default']

beforeEach(async () => {
  mockStatus.value = 'loading'
  mockHoldings.value = []
  mockSummary.value = null
  mockBaseCurrency.value = 'USD'
  mockError.value = null
  vi.resetModules()
  DashboardView = (await import('@/views/DashboardView.vue')).default
})

function makeRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/import', component: { template: '<div />' } },
    ],
  })
}

const TWELVE_HOLDINGS: Holding[] = Array.from({ length: 12 }, (_, i) => ({
  ticker: `T${String(i + 1).padStart(2, '0')}`,
  broker: i % 2 === 0 ? 'T212' : 'IB',
  quantity: i + 1,
  avgCost: { amount: 100 + i, currency: 'USD' },
  marketValue: { amount: 1000 + i * 10, currency: 'USD' },
  pl: { amount: i * 5 - 30, currency: 'USD' },
  plPct: i - 5,
}))

const TWELVE_SUMMARY: PortfolioSummary = {
  totalValue: { amount: 14860, currency: 'USD' },
  dayChange: null,
  dayChangePct: null,
  positionsCount: 12,
  cashTotal: { amount: 4200, currency: 'USD' },
}

describe('V0.17 — DashboardView', () => {
  it('renders skeletons (aria-busy) when status="loading"', async () => {
    mockStatus.value = 'loading'
    const router = makeRouter()
    const wrapper = mount(DashboardView, { global: { plugins: [router] } })
    expect(wrapper.find('section[aria-busy="true"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="holdings-root"][aria-busy="true"]').exists()).toBe(true)
  })

  it('renders skeletons (aria-busy) when status="idle" — no uid yet', async () => {
    mockStatus.value = 'idle'
    const router = makeRouter()
    const wrapper = mount(DashboardView, { global: { plugins: [router] } })
    expect(wrapper.find('section[aria-busy="true"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="holdings-root"][aria-busy="true"]').exists()).toBe(true)
  })

  it('renders EmptyState when status="ready" and there are zero positions and zero cash', async () => {
    mockStatus.value = 'ready'
    mockHoldings.value = []
    mockSummary.value = {
      totalValue: { amount: 0, currency: 'USD' },
      dayChange: null,
      dayChangePct: null,
      positionsCount: 0,
      cashTotal: { amount: 0, currency: 'USD' },
    }
    mockBaseCurrency.value = 'USD'
    const router = makeRouter()
    const wrapper = mount(DashboardView, { global: { plugins: [router] } })
    expect(wrapper.text()).toContain('No portfolio data yet')
    const cta = wrapper.find('a[href="/import"]')
    expect(cta.exists()).toBe(true)
  })

  it('renders SummaryCard total + 12 HoldingsTable rows when status="ready" with 12 positions', async () => {
    mockStatus.value = 'ready'
    mockHoldings.value = TWELVE_HOLDINGS
    mockSummary.value = TWELVE_SUMMARY
    mockBaseCurrency.value = 'USD'
    const router = makeRouter()
    const wrapper = mount(DashboardView, { global: { plugins: [router] } })
    const text = wrapper.text()
    expect(text).toContain('$14,860.00')
    expect(text).toContain('Positions: 12')
    expect(text).toContain('$4,200.00')
    const rows = wrapper.findAll('tbody tr')
    expect(rows).toHaveLength(12)
  })

  it('renders a re-import link to /import?mode=replace once data is loaded', async () => {
    mockStatus.value = 'ready'
    mockHoldings.value = TWELVE_HOLDINGS
    mockSummary.value = TWELVE_SUMMARY
    const router = makeRouter()
    const wrapper = mount(DashboardView, { global: { plugins: [router] } })
    const reimport = wrapper.find('a[data-testid="reimport-link"]')
    expect(reimport.exists()).toBe(true)
    expect(reimport.attributes('href')).toBe('/import?mode=replace')
  })

  it('re-renders totals in EUR when baseCurrency switches from USD to EUR', async () => {
    mockStatus.value = 'ready'
    mockHoldings.value = TWELVE_HOLDINGS
    mockSummary.value = TWELVE_SUMMARY
    mockBaseCurrency.value = 'USD'
    const router = makeRouter()
    const wrapper = mount(DashboardView, { global: { plugins: [router] } })
    expect(wrapper.text()).toContain('$14,860.00')

    mockBaseCurrency.value = 'EUR'
    mockSummary.value = {
      ...TWELVE_SUMMARY,
      totalValue: { amount: 13670, currency: 'EUR' },
      cashTotal: { amount: 3864, currency: 'EUR' },
    }
    await wrapper.vm.$nextTick()
    const text = wrapper.text()
    expect(text).toContain('€13,670.00')
    expect(text).not.toContain('$14,860.00')
  })

  it('does not render the re-import link in the empty state', async () => {
    mockStatus.value = 'ready'
    mockHoldings.value = []
    mockSummary.value = {
      totalValue: { amount: 0, currency: 'USD' },
      dayChange: null,
      dayChangePct: null,
      positionsCount: 0,
      cashTotal: { amount: 0, currency: 'USD' },
    }
    const router = makeRouter()
    const wrapper = mount(DashboardView, { global: { plugins: [router] } })
    expect(wrapper.find('a[data-testid="reimport-link"]').exists()).toBe(false)
  })
})

// xfail: A.6.3 — DashboardView error-state template
//
// Manually surfaced 2026-05-03 + 2026-05-09: when usePortfolio throws
// FxRateMissingError on a multi-currency import, status flips to 'error'
// but DashboardView has no v-else-if branch for it, so <main> renders
// empty. This block pins the contract — banner names the missing pair,
// surface "Go to Settings" + Re-import recovery CTAs, suppress the
// loading/empty/ready branches. `it.fails` markers convert to `it` in
// the impl commit (matched by tdd-gate's xfail regex).
describe('A.6.3 — DashboardView error state', () => {
  it.fails('renders an error banner with the FxRateMissingError pair when status="error"', async () => {
    mockStatus.value = 'error'
    mockError.value = new FxRateMissingError('USD->EUR')
    const router = makeRouter()
    const wrapper = mount(DashboardView, { global: { plugins: [router] } })
    const banner = wrapper.find('[data-testid="error-banner"]')
    expect(banner.exists()).toBe(true)
    expect(banner.text()).toContain('USD->EUR')
  })

  it.fails('renders Go-to-Settings and Re-import CTAs in the error branch', async () => {
    mockStatus.value = 'error'
    mockError.value = new FxRateMissingError('USD->EUR')
    const router = makeRouter()
    const wrapper = mount(DashboardView, { global: { plugins: [router] } })
    expect(wrapper.find('a[href="/settings"]').exists()).toBe(true)
    expect(wrapper.find('a[href="/import?mode=replace"]').exists()).toBe(true)
  })

  it.fails('suppresses loading/empty/ready branches in favour of the error banner when status="error"', async () => {
    mockStatus.value = 'error'
    mockError.value = new FxRateMissingError('USD->EUR')
    const router = makeRouter()
    const wrapper = mount(DashboardView, { global: { plugins: [router] } })
    // Branches that must NOT render in error state — these already pass
    // pre-fix because status='error' drops out of every existing branch,
    // so the positive assertion below is what carries the xfail until
    // the impl lands.
    expect(wrapper.find('section[aria-busy="true"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('No portfolio data yet')
    // Positive: the error banner IS the rendered branch.
    expect(wrapper.find('[data-testid="error-banner"]').exists()).toBe(true)
  })
})
