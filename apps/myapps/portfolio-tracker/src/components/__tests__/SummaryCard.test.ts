/**
 * V0.14 — SummaryCard component.
 *
 * Per design spec §4.3.2: total value (base currency), positions count,
 * cash total, and a day-change line. v0 has no historical snapshot so the
 * day-change props are nullable and render as "—" with no arrow when null.
 *
 * Refs V0.14
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SummaryCard from '@/components/SummaryCard.vue'

describe('V0.14 — SummaryCard', () => {
  it('renders totalValue, positions count, and cash total in base currency', () => {
    const wrapper = mount(SummaryCard, {
      props: {
        totalValue: { amount: 124567.89, currency: 'USD' },
        dayChange: null,
        dayChangePct: null,
        positionsCount: 12,
        cashTotal: { amount: 4200, currency: 'USD' },
      },
    })
    const text = wrapper.text()
    expect(text).toContain('$124,567.89')
    expect(text).toContain('12')
    expect(text).toContain('$4,200.00')
  })

  it('renders "—" placeholder for day change when no historical data (dayChange=null) — no arrow', () => {
    const wrapper = mount(SummaryCard, {
      props: {
        totalValue: { amount: 124567.89, currency: 'USD' },
        dayChange: null,
        dayChangePct: null,
        positionsCount: 12,
        cashTotal: { amount: 4200, currency: 'USD' },
      },
    })
    const dayChange = wrapper.find('[data-testid="day-change"]')
    expect(dayChange.exists()).toBe(true)
    expect(dayChange.text()).toContain('—')
    expect(dayChange.text()).not.toContain('▲')
    expect(dayChange.text()).not.toContain('▼')
  })

  it('renders day change with PlCell when historical data is present', () => {
    const wrapper = mount(SummaryCard, {
      props: {
        totalValue: { amount: 124567.89, currency: 'USD' },
        dayChange: { amount: 1204.5, currency: 'USD' },
        dayChangePct: 0.97,
        positionsCount: 12,
        cashTotal: { amount: 4200, currency: 'USD' },
      },
    })
    const dayChange = wrapper.find('[data-testid="day-change"]')
    expect(dayChange.text()).toContain('▲')
    expect(dayChange.text()).toContain('+$1,204.50')
    expect(dayChange.text()).toContain('+0.97%')
  })
})

describe('V0.16 — SummaryCard loading state', () => {
  it('renders shimmer skeleton with aria-busy="true" when loading=true; no amount text', () => {
    const wrapper = mount(SummaryCard, {
      props: {
        totalValue: { amount: 124567.89, currency: 'USD' },
        dayChange: null,
        dayChangePct: null,
        positionsCount: 12,
        cashTotal: { amount: 4200, currency: 'USD' },
        loading: true,
      },
    })
    const root = wrapper.find('section')
    expect(root.attributes('aria-busy')).toBe('true')
    const skeleton = wrapper.find('[data-testid="summary-skeleton"]')
    expect(skeleton.exists()).toBe(true)
    expect(skeleton.classes()).toContain('animate-pulse')
    expect(wrapper.text()).not.toContain('$124,567.89')
    expect(wrapper.text()).not.toContain('$4,200.00')
  })

  it('omits aria-busy and renders amounts when loading=false (default)', () => {
    const wrapper = mount(SummaryCard, {
      props: {
        totalValue: { amount: 124567.89, currency: 'USD' },
        dayChange: null,
        dayChangePct: null,
        positionsCount: 12,
        cashTotal: { amount: 4200, currency: 'USD' },
      },
    })
    const root = wrapper.find('section')
    expect(root.attributes('aria-busy')).toBeUndefined()
    expect(wrapper.text()).toContain('$124,567.89')
  })
})
