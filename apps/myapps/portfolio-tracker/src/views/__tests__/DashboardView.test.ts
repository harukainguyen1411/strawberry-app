/**
 * V0.17 — DashboardView wire-up.
 *
 * Per design spec §4.3 + plan task V0.17. The view consumes a single
 * usePortfolio composable that returns derived `holdings`, `summary`, and
 * `baseCurrency`. Branches:
 *   - status='loading' → SummaryCard + HoldingsTable in skeleton state
 *   - status='ready'  + holdings.length===0 + cashTotal===0 → EmptyState
 *   - status='ready'  + non-empty → SummaryCard + HoldingsTable rendered
 *
 * Per coordinator decision 2026-05-02 (recorded in PR #82 body): tests
 * mock usePortfolio. Real Firestore wiring is exercised end-to-end in
 * V0.18's Playwright happy path.
 *
 * Refs V0.17
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'
import type { CurrencyCode, Holding } from '@/types/firestore'
import type { PortfolioStatus, PortfolioSummary, UsePortfolioReturn } from '@/composables/usePortfolio'

// Mutable refs that the mocked composable returns; tests mutate these
// before mounting to drive the branching logic.
const mockStatus: Ref<PortfolioStatus> = ref('loading')
const mockHoldings: Ref<Holding[]> = ref<Holding[]>([])
const mockSummary: Ref<PortfolioSummary | null> = ref<PortfolioSummary | null>(null)
const mockBaseCurrency: Ref<CurrencyCode | null> = ref<CurrencyCode | null>('USD')
const mockError: Ref<Error | null> = ref<Error | null>(null)

vi.mock('@/composables/usePortfolio', () => ({
  usePortfolio: (): UsePortfolioReturn => ({
    status: computed(() => mockStatus.value) as ComputedRef<PortfolioStatus>,
    loading: computed(() => mockStatus.value === 'loading'),
    holdings: computed(() => mockHoldings.value) as ComputedRef<Holding[]>,
    summary: computed(() => mockSummary.value) as ComputedRef<PortfolioSummary | null>,
    baseCurrency: computed(() => mockBaseCurrency.value) as ComputedRef<CurrencyCode | null>,
    error: computed(() => mockError.value) as ComputedRef<Error | null>,
  }),
}))

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
