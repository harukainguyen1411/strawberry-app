/**
 * V0.15 — HoldingsTable (desktop) + responsive HoldingRow branch.
 *
 * Per design spec §4.3.3 + §6: sortable desktop <table>; mobile branch is
 * the same component rendering a <ul> of <HoldingRow>, gated by Tailwind
 * responsive classes (`hidden md:table` vs `md:hidden`). Default sort is
 * market-value desc; clicking a header toggles direction and reflects state
 * via aria-sort.
 *
 * V0.1.3 — currency-code badges removed (Intl symbol $ / € disambiguates);
 * desktop qty column trimmed via formatQuantity (≤6 decimals, trailing zeros
 * stripped) to match the mobile HoldingRow.
 *
 * Refs V0.15, V0.1.3
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import HoldingsTable from '@/components/HoldingsTable.vue'
import type { Holding } from '@/types/firestore'

const HOLDINGS: Holding[] = [
  {
    ticker: 'AAPL',
    broker: 'T212',
    quantity: 12,
    avgCost: { amount: 148.5, currency: 'USD' },
    marketValue: { amount: 2100, currency: 'EUR' },
    pl: { amount: 320, currency: 'EUR' },
    plPct: 1.85,
  },
  {
    ticker: 'MSFT',
    broker: 'IB',
    quantity: 8,
    avgCost: { amount: 320, currency: 'USD' },
    marketValue: { amount: 3400, currency: 'EUR' },
    pl: { amount: -120, currency: 'EUR' },
    plPct: -3.41,
  },
  {
    ticker: 'NVDA',
    broker: 'T212',
    quantity: 4,
    avgCost: { amount: 800, currency: 'USD' },
    marketValue: { amount: 4800, currency: 'EUR' },
    pl: { amount: 1200, currency: 'EUR' },
    plPct: 33.3,
  },
  {
    ticker: 'ASML',
    broker: 'IB',
    quantity: 5,
    avgCost: { amount: 600, currency: 'EUR' },
    marketValue: { amount: 3000, currency: 'EUR' },
    pl: { amount: 200, currency: 'EUR' },
    plPct: 7.14,
  },
  {
    ticker: 'TSLA',
    broker: 'T212',
    quantity: 10,
    avgCost: { amount: 200, currency: 'USD' },
    marketValue: { amount: 1800, currency: 'EUR' },
    pl: { amount: -300, currency: 'EUR' },
    plPct: -14.29,
  },
]

describe('V0.15 — HoldingsTable (desktop)', () => {
  it('renders 5 data rows for 5 holdings', () => {
    const wrapper = mount(HoldingsTable, {
      props: { holdings: HOLDINGS, baseCurrency: 'EUR' },
    })
    const rows = wrapper.findAll('tbody tr')
    expect(rows).toHaveLength(5)
  })

  it('default sort is market-value desc — NVDA (4800 EUR) is first row', () => {
    const wrapper = mount(HoldingsTable, {
      props: { holdings: HOLDINGS, baseCurrency: 'EUR' },
    })
    const rows = wrapper.findAll('tbody tr')
    expect(rows[0].text()).toContain('NVDA')
    expect(rows[1].text()).toContain('MSFT')
    expect(rows[4].text()).toContain('TSLA')
  })

  it('clicking the "Ticker" header sorts ascending and sets aria-sort="ascending"', async () => {
    const wrapper = mount(HoldingsTable, {
      props: { holdings: HOLDINGS, baseCurrency: 'EUR' },
    })
    const tickerTh = wrapper.find('th[data-sort-key="ticker"]')
    expect(tickerTh.exists()).toBe(true)
    await tickerTh.trigger('click')
    expect(tickerTh.attributes('aria-sort')).toBe('ascending')
    const rows = wrapper.findAll('tbody tr')
    expect(rows[0].text()).toContain('AAPL')
    expect(rows[1].text()).toContain('ASML')
    expect(rows[4].text()).toContain('TSLA')
  })

  it('clicking "Ticker" twice toggles to descending and sets aria-sort="descending"', async () => {
    const wrapper = mount(HoldingsTable, {
      props: { holdings: HOLDINGS, baseCurrency: 'EUR' },
    })
    const tickerTh = wrapper.find('th[data-sort-key="ticker"]')
    await tickerTh.trigger('click')
    await tickerTh.trigger('click')
    expect(tickerTh.attributes('aria-sort')).toBe('descending')
    const rows = wrapper.findAll('tbody tr')
    expect(rows[0].text()).toContain('TSLA')
    expect(rows[4].text()).toContain('AAPL')
  })

  it('non-active sort headers carry aria-sort="none"', () => {
    const wrapper = mount(HoldingsTable, {
      props: { holdings: HOLDINGS, baseCurrency: 'EUR' },
    })
    const tickerTh = wrapper.find('th[data-sort-key="ticker"]')
    expect(tickerTh.attributes('aria-sort')).toBe('none')
  })

  // V0.1.3: badge removed — Intl symbol ($ / €) disambiguates; no trailing code suffix shown
  it('V0.1.3: no currency-code badges rendered (symbol in formatted amount is sufficient)', () => {
    const wrapper = mount(HoldingsTable, {
      props: { holdings: HOLDINGS, baseCurrency: 'EUR' },
    })
    const badges = wrapper.findAll('[data-testid="currency-badge"]')
    expect(badges).toHaveLength(0)
  })

  it('every P/L cell is rendered via <PlCell> (data-testid="pl-cell"), one per row', () => {
    const wrapper = mount(HoldingsTable, {
      props: { holdings: HOLDINGS, baseCurrency: 'EUR' },
    })
    const plCells = wrapper.findAll('tbody [data-testid="pl-cell"]')
    expect(plCells).toHaveLength(5)
  })

  it('table is hidden on mobile and visible on md+ (responsive classes)', () => {
    const wrapper = mount(HoldingsTable, {
      props: { holdings: HOLDINGS, baseCurrency: 'EUR' },
    })
    const table = wrapper.find('table')
    expect(table.exists()).toBe(true)
    const tableClasses = table.classes()
    expect(tableClasses).toContain('hidden')
    expect(tableClasses).toContain('md:table')
  })

  it('mobile branch renders a <HoldingRow> per holding inside a md:hidden container', () => {
    const wrapper = mount(HoldingsTable, {
      props: { holdings: HOLDINGS, baseCurrency: 'EUR' },
    })
    const mobileList = wrapper.find('[data-testid="holdings-mobile-list"]')
    expect(mobileList.exists()).toBe(true)
    expect(mobileList.classes()).toContain('md:hidden')
    const rows = mobileList.findAll('[data-testid="holding-row"]')
    expect(rows).toHaveLength(5)
  })
})

describe('V0.1.3 — HoldingsTable desktop qty decimal trimming', () => {
  it('desktop tbody renders qty 279.20583987000003 as "279.20584" (≤6 decimals, trailing zeros stripped)', () => {
    const HOLDING_RAW: Holding = {
      ticker: 'BTC',
      broker: 'T212',
      quantity: 279.20583987000003,
      avgCost: { amount: 100, currency: 'USD' },
      marketValue: { amount: 100, currency: 'EUR' },
      pl: { amount: 0, currency: 'EUR' },
      plPct: 0,
    }
    const wrapper = mount(HoldingsTable, {
      props: { holdings: [HOLDING_RAW], baseCurrency: 'EUR' },
    })
    const row = wrapper.find('tbody tr')
    expect(row.exists()).toBe(true)
    expect(row.text()).toContain('279.20584')
    expect(row.text()).not.toContain('279.20583987')
  })
})

describe('V0.16 — HoldingsTable loading state', () => {
  it('renders 5 skeleton rows with aria-busy="true" when loading=true', () => {
    const wrapper = mount(HoldingsTable, {
      props: { holdings: [], baseCurrency: 'EUR', loading: true },
    })
    const root = wrapper.find('[data-testid="holdings-root"]')
    expect(root.exists()).toBe(true)
    expect(root.attributes('aria-busy')).toBe('true')
    const skeletons = wrapper.findAll('[data-testid="holdings-skeleton-row"]')
    expect(skeletons).toHaveLength(5)
    expect(skeletons[0].classes()).toContain('animate-pulse')
  })

  it('omits aria-busy and renders real rows when loading=false (default)', () => {
    const wrapper = mount(HoldingsTable, {
      props: { holdings: HOLDINGS, baseCurrency: 'EUR' },
    })
    const root = wrapper.find('[data-testid="holdings-root"]')
    expect(root.attributes('aria-busy')).toBeUndefined()
    const skeletons = wrapper.findAll('[data-testid="holdings-skeleton-row"]')
    expect(skeletons).toHaveLength(0)
    const rows = wrapper.findAll('tbody tr')
    expect(rows).toHaveLength(5)
  })
})
