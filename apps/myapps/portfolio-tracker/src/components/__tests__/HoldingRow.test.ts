/**
 * V0.15 — HoldingRow (mobile stacked).
 *
 * Per design spec §4.3.3 + §6: ticker + broker badge on line 1; qty + avg
 * cost on line 2 (avg cost shows native currency badge when != base);
 * market value (base) + P/L (base) on line 3. Tap-target ≥ 44×44px (a11y
 * §8). All money cells route through <MoneyCell>/<PlCell> — no inline
 * Intl.NumberFormat.
 *
 * V0.1.3 — qty decimal trimming (≤6 decimal places, trailing zeros stripped);
 * currency-label consistency (symbol only, no trailing code suffix).
 *
 * Refs V0.15, V0.1.3
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import HoldingRow from '@/components/HoldingRow.vue'
import type { Holding } from '@/types/firestore'

const HOLDING: Holding = {
  ticker: 'AAPL',
  broker: 'T212',
  quantity: 12,
  avgCost: { amount: 148.5, currency: 'USD' },
  marketValue: { amount: 2100, currency: 'EUR' },
  pl: { amount: 320, currency: 'EUR' },
  plPct: 1.85,
}

describe('V0.15 — HoldingRow (mobile)', () => {
  it('renders ticker and broker badge text', () => {
    const wrapper = mount(HoldingRow, {
      props: { holding: HOLDING, baseCurrency: 'EUR' },
    })
    const text = wrapper.text()
    expect(text).toContain('AAPL')
    expect(text).toContain('T212')
  })

  it('V0.1.3: renders quantity and avg cost; no trailing currency code badge (symbol disambiguates)', () => {
    const wrapper = mount(HoldingRow, {
      props: { holding: HOLDING, baseCurrency: 'EUR' },
    })
    const text = wrapper.text()
    expect(text).toContain('12')
    expect(text).toContain('$148.50')
    // V0.1.3: no currency-code badge — the $ symbol already disambiguates
    const badges = wrapper.findAll('[data-testid="currency-badge"]')
    expect(badges).toHaveLength(0)
  })

  it('omits the currency badge when avgCost.currency === baseCurrency', () => {
    const wrapper = mount(HoldingRow, {
      props: {
        holding: { ...HOLDING, avgCost: { amount: 148.5, currency: 'EUR' } },
        baseCurrency: 'EUR',
      },
    })
    const badges = wrapper.findAll('[data-testid="currency-badge"]')
    expect(badges).toHaveLength(0)
  })

  it('renders market value via <MoneyCell> and P/L via <PlCell>', () => {
    const wrapper = mount(HoldingRow, {
      props: { holding: HOLDING, baseCurrency: 'EUR' },
    })
    const plCell = wrapper.find('[data-testid="pl-cell"]')
    expect(plCell.exists()).toBe(true)
    expect(plCell.text()).toContain('▲')
    const text = wrapper.text()
    expect(text).toContain('€2,100.00')
  })

  it('root element carries min-h-[44px] for the 44×44 a11y tap target', () => {
    const wrapper = mount(HoldingRow, {
      props: { holding: HOLDING, baseCurrency: 'EUR' },
    })
    const root = wrapper.find('[data-testid="holding-row"]')
    expect(root.exists()).toBe(true)
    expect(root.classes()).toContain('min-h-[44px]')
  })
})

describe('V0.1.3 — HoldingRow qty decimal trimming', () => {
  it('renders float qty 279.20583987000003 as "279.20584" (≤6 decimals, trailing zeros stripped)', () => {
    const wrapper = mount(HoldingRow, {
      props: {
        holding: { ...HOLDING, quantity: 279.20583987000003 },
        baseCurrency: 'EUR',
      },
    })
    const text = wrapper.text()
    expect(text).toContain('279.20584')
    expect(text).not.toContain('279.20583987000003')
  })

  it('renders float qty 52.497975839999995 as "52.497976" (≤6 decimals, trailing zeros stripped)', () => {
    const wrapper = mount(HoldingRow, {
      props: {
        holding: { ...HOLDING, quantity: 52.497975839999995 },
        baseCurrency: 'EUR',
      },
    })
    const text = wrapper.text()
    expect(text).toContain('52.497976')
    expect(text).not.toContain('52.497975839999995')
  })

  it('renders qty 10.100000000000001 as "10.1" (trailing zeros stripped after rounding)', () => {
    const wrapper = mount(HoldingRow, {
      props: {
        holding: { ...HOLDING, quantity: 10.100000000000001 },
        baseCurrency: 'EUR',
      },
    })
    const text = wrapper.text()
    expect(text).toContain('10.1')
    expect(text).not.toContain('10.100000000000001')
  })
})
