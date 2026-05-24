/**
 * V0.17 — DashboardView wire-up.
 * A.6.3 — DashboardView error-state template (extends V0.17 contract).
 * V0.1.1 — Re-import CTA + ready-branch link <a href> → <router-link>.
 * v0.2 shell migration — views relocated to src/views/portfolio-tracker/;
 *   Go-to-Settings CTA dropped (no settings view in v0.2; v1.x adds
 *   in-app FX-overrides UI). Only Re-import CTA remains in error state.
 *
 * Per design spec §4.3 + plan task V0.17. The view consumes a single
 * usePortfolio composable that returns derived `holdings`, `summary`, and
 * `baseCurrency`. Branches:
 *   - status='loading' → SummaryCard + HoldingsTable in skeleton state
 *   - status='ready'  + holdings.length===0 + cashTotal===0 → EmptyState
 *   - status='ready'  + non-empty → SummaryCard + HoldingsTable rendered
 *   - status='error'  → error banner with FxRateMissingError pair + Re-import CTA (A.6.3)
 *
 * Per coordinator decision 2026-05-02 (recorded in PR #82 body): tests
 * mock usePortfolio. Real Firestore wiring is exercised end-to-end in
 * V0.18's Playwright happy path.
 *
 * The mock factory re-declares `FxRateMissingError` (instead of
 * importing the real class) so the test stays off the firebase/config
 * side-effect chain — vitest has no VITE_FIREBASE_* env. Both the test
 * and DashboardView.vue resolve `FxRateMissingError` through the mock,
 * so the impl's `instanceof` check matches the same constructor on
 * both sides.
 *
 * Refs V0.17, A.6.3, V0.1.1
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory, RouterLink, type Router } from 'vue-router'
import type { CurrencyCode, Holding } from '@/types/portfolio-tracker/firestore'
import {
  FxRateMissingError,
  type PortfolioStatus,
  type PortfolioSummary,
  type UsePortfolioReturn,
} from '@/composables/portfolio-tracker/usePortfolio'

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
// FxRateMissingError is re-declared in the factory rather than imported
// via `importOriginal` — see the file-level docblock for why (firebase
// side-effect avoidance). The impl's `instanceof` check resolves
// against this same mocked class because Vitest replaces the export
// for every importer, including DashboardView.vue.
vi.mock('@/composables/portfolio-tracker/usePortfolio', () => {
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

let DashboardView: typeof import('@/views/portfolio-tracker/DashboardView.vue')['default']

beforeEach(async () => {
  mockStatus.value = 'loading'
  mockHoldings.value = []
  mockSummary.value = null
  mockBaseCurrency.value = 'USD'
  mockError.value = null
  vi.resetModules()
  DashboardView = (await import('@/views/portfolio-tracker/DashboardView.vue')).default
})

function makeRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/yourApps/portfolio-tracker', component: { template: '<div />' } },
      { path: '/yourApps/portfolio-tracker/import', component: { template: '<div />' } },
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
    const cta = wrapper.find('a[href="/yourApps/portfolio-tracker/import"]')
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

  it('renders ready-branch re-import as RouterLink with shell-prefixed to path (V0.1.1)', async () => {
    mockStatus.value = 'ready'
    mockHoldings.value = TWELVE_HOLDINGS
    mockSummary.value = TWELVE_SUMMARY
    const router = makeRouter()
    const wrapper = mount(DashboardView, { global: { plugins: [router] } })
    const reimport = wrapper.find('[data-testid="reimport-link"]')
    expect(reimport.exists()).toBe(true)
    // Must be a RouterLink (not a bare <a href>), routing through Vue Router.
    const links = wrapper.findAllComponents(RouterLink)
    const reimportLink = links.find(l => l.attributes('data-testid') === 'reimport-link')
    expect(reimportLink).toBeDefined()
    expect(reimportLink!.props('to')).toBe('/yourApps/portfolio-tracker/import?mode=replace')
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

// A.6.3 — DashboardView error-state template
//
// v0.2 update: Go-to-Settings CTA removed (no settings view in v0.2;
// v1.x will add in-app FX-overrides UI). Only Re-import CTA remains.
// Tests updated accordingly — settingsLink test inverted to assert absence.
describe('A.6.3 — DashboardView error state', () => {
  it('renders an error banner with the FxRateMissingError pair when status="error"', async () => {
    mockStatus.value = 'error'
    mockError.value = new FxRateMissingError('USD->EUR')
    const router = makeRouter()
    const wrapper = mount(DashboardView, { global: { plugins: [router] } })
    const banner = wrapper.find('[data-testid="error-banner"]')
    expect(banner.exists()).toBe(true)
    expect(banner.text()).toContain('USD->EUR')
  })

  it('does not render Go-to-Settings CTA in error state (v0.2 — no settings view)', async () => {
    mockStatus.value = 'error'
    mockError.value = new FxRateMissingError('USD->EUR')
    const router = makeRouter()
    const wrapper = mount(DashboardView, { global: { plugins: [router] } })
    // Go-to-Settings CTA must be absent — settings view dropped in v0.2.
    const links = wrapper.findAllComponents(RouterLink)
    const settingsLink = links.find(l => l.attributes('data-testid') === 'error-settings-link')
    expect(settingsLink).toBeUndefined()
    expect(wrapper.find('[data-testid="error-settings-link"]').exists()).toBe(false)
    expect(wrapper.find('a[href="/legacy/settings"]').exists()).toBe(false)
  })

  it('renders only the Re-import CTA in the error state (sole recovery action)', async () => {
    mockStatus.value = 'error'
    mockError.value = new FxRateMissingError('USD->EUR')
    const router = makeRouter()
    const wrapper = mount(DashboardView, { global: { plugins: [router] } })
    const banner = wrapper.find('[data-testid="error-banner"]')
    expect(banner.exists()).toBe(true)
    // Re-import CTA must be present as a RouterLink with the shell-prefixed path.
    const links = wrapper.findAllComponents(RouterLink)
    const reimportLink = links.find(l => l.attributes('data-testid') === 'error-reimport-link')
    expect(reimportLink).toBeDefined()
    expect(reimportLink!.props('to')).toBe('/yourApps/portfolio-tracker/import?mode=replace')
    // Only one RouterLink inside the error banner.
    const bannerLinks = banner.findAllComponents(RouterLink)
    expect(bannerLinks).toHaveLength(1)
  })

  it('renders only the error banner (not the ready-branch re-import or loading skeletons) when status="error"', async () => {
    mockStatus.value = 'error'
    mockError.value = new FxRateMissingError('USD->EUR')
    const router = makeRouter()
    const wrapper = mount(DashboardView, { global: { plugins: [router] } })
    // Positive: error banner IS the rendered branch.
    expect(wrapper.find('[data-testid="error-banner"]').exists()).toBe(true)
    // Negatives that pin branch-mutual-exclusion against future
    // regressions where someone widens isReady / isEmpty / loading to
    // also fire under status='error'. The ready-branch link is
    // `data-testid="reimport-link"` (no "error-" prefix), distinct from
    // the error-banner's CTA — guards against a duplicate render.
    expect(wrapper.find('a[data-testid="reimport-link"]').exists()).toBe(false)
    expect(wrapper.find('section[aria-busy="true"]').exists()).toBe(false)
  })
})
