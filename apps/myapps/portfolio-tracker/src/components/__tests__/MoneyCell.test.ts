/**
 * V0.14 — MoneyCell component.
 *
 * Renders a Money value with locale-aware Intl.NumberFormat output, tabular
 * numerals, and an optional uppercase currency badge when the value's
 * currency differs from the user's base (per design spec §4.3.2 + §6).
 *
 * V0.1.3 — currency-label consistency: the Intl symbol ($ / €) already
 * disambiguates the currency, so the trailing code badge is dropped. The
 * showCurrencyBadge prop is kept for API compat but no badge is rendered.
 *
 * Refs V0.14, V0.1.3
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MoneyCell from '@/components/MoneyCell.vue'

describe('V0.14 — MoneyCell', () => {
  it('renders { amount: 14850, currency: USD } as "$14,850.00"', () => {
    const wrapper = mount(MoneyCell, {
      props: { money: { amount: 14850, currency: 'USD' } },
    })
    expect(wrapper.text()).toContain('$14,850.00')
  })

  it('renders EUR with en-IE locale as "€14,850.00"', () => {
    const wrapper = mount(MoneyCell, {
      props: { money: { amount: 14850, currency: 'EUR' } },
    })
    expect(wrapper.text()).toContain('€14,850.00')
  })

  it('V0.1.3: no currency badge even when showCurrencyBadge=true and money.currency !== baseCurrency (symbol disambiguates)', () => {
    const wrapper = mount(MoneyCell, {
      props: {
        money: { amount: 148.5, currency: 'USD' },
        baseCurrency: 'EUR',
        showCurrencyBadge: true,
      },
    })
    // After V0.1.3: badge must not be rendered — the $ symbol is sufficient
    expect(wrapper.find('[data-testid="currency-badge"]').exists()).toBe(false)
  })

  it('hides currency badge when money.currency === baseCurrency even with showCurrencyBadge=true', () => {
    const wrapper = mount(MoneyCell, {
      props: {
        money: { amount: 148.5, currency: 'USD' },
        baseCurrency: 'USD',
        showCurrencyBadge: true,
      },
    })
    expect(wrapper.find('[data-testid="currency-badge"]').exists()).toBe(false)
  })

  it('applies tabular-nums class on the amount span (a11y / column alignment per design spec §4.3.3)', () => {
    const wrapper = mount(MoneyCell, {
      props: { money: { amount: 14850, currency: 'USD' } },
    })
    expect(wrapper.find('.tabular-nums').exists()).toBe(true)
  })
})

describe('V0.1.3 — MoneyCell currency-label consistency', () => {
  it('EUR foreign to USD base: shows "€11.46" with no trailing EUR code', () => {
    const wrapper = mount(MoneyCell, {
      props: {
        money: { amount: 11.46, currency: 'EUR' },
        baseCurrency: 'USD',
        showCurrencyBadge: true,
      },
    })
    expect(wrapper.text()).toContain('€11.46')
    expect(wrapper.find('[data-testid="currency-badge"]').exists()).toBe(false)
  })

  it('USD foreign to EUR base: shows "$398.70" with no trailing USD code', () => {
    const wrapper = mount(MoneyCell, {
      props: {
        money: { amount: 398.70, currency: 'USD' },
        baseCurrency: 'EUR',
        showCurrencyBadge: true,
      },
    })
    expect(wrapper.text()).toContain('$398.70')
    expect(wrapper.find('[data-testid="currency-badge"]').exists()).toBe(false)
  })
})
