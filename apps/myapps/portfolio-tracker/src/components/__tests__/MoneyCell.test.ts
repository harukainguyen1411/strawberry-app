/**
 * V0.14 — MoneyCell component.
 *
 * Renders a Money value with locale-aware Intl.NumberFormat output, tabular
 * numerals, and an optional uppercase currency badge when the value's
 * currency differs from the user's base (per design spec §4.3.2 + §6).
 *
 * Refs V0.14
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

  it('shows uppercase currency badge when showCurrencyBadge=true and money.currency !== baseCurrency', () => {
    const wrapper = mount(MoneyCell, {
      props: {
        money: { amount: 148.5, currency: 'USD' },
        baseCurrency: 'EUR',
        showCurrencyBadge: true,
      },
    })
    const badge = wrapper.find('[data-testid="currency-badge"]')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toBe('USD')
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
