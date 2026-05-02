/**
 * V0.15 — HoldingRow (mobile stacked).
 *
 * Per design spec §4.3.3 + §6: ticker + broker badge on line 1; qty + avg
 * cost on line 2 (avg cost shows native currency badge when != base);
 * market value (base) + P/L (base) on line 3. Tap-target ≥ 44×44px (a11y
 * §8). All money cells route through <MoneyCell>/<PlCell> — no inline
 * Intl.NumberFormat.
 *
 * Refs V0.15
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

  it('renders quantity and avg cost; avg cost shows USD badge when baseCurrency=EUR', () => {
    const wrapper = mount(HoldingRow, {
      props: { holding: HOLDING, baseCurrency: 'EUR' },
    })
    const text = wrapper.text()
    expect(text).toContain('12')
    expect(text).toContain('$148.50')
    const badges = wrapper.findAll('[data-testid="currency-badge"]')
    const badgeTexts = badges.map((b) => b.text())
    expect(badgeTexts).toContain('USD')
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
