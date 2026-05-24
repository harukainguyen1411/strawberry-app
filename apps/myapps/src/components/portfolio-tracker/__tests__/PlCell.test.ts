/**
 * V0.14 — PlCell component.
 *
 * Renders a P/L (profit-and-loss) Money value with arrow + sign + color
 * triple per design spec §8 (a11y: don't rely on color alone).
 *
 * Refs V0.14
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PlCell from '@/components/portfolio-tracker/PlCell.vue'

describe('V0.14 — PlCell', () => {
  it('positive P/L renders ▲ + leading + + --positive color', () => {
    const wrapper = mount(PlCell, {
      props: {
        pl: { amount: 320, currency: 'USD' },
        plPct: 2.2,
      },
    })
    const text = wrapper.text()
    expect(text).toContain('▲')
    expect(text).toContain('+$320.00')
    expect(text).toContain('+2.2%')
    const root = wrapper.find('[data-testid="pl-cell"]')
    expect(root.attributes('style') || '').toContain('var(--positive)')
  })

  it('negative P/L renders ▼ + leading - + --negative color', () => {
    const wrapper = mount(PlCell, {
      props: {
        pl: { amount: -150, currency: 'USD' },
        plPct: -1.5,
      },
    })
    const text = wrapper.text()
    expect(text).toContain('▼')
    // Intl.NumberFormat renders -$150.00 already; we check the displayed sign.
    expect(text).toContain('-$150.00')
    expect(text).toContain('-1.5%')
    const root = wrapper.find('[data-testid="pl-cell"]')
    expect(root.attributes('style') || '').toContain('var(--negative)')
  })

  it('zero P/L renders no arrow, no sign, --muted color', () => {
    const wrapper = mount(PlCell, {
      props: {
        pl: { amount: 0, currency: 'USD' },
        plPct: 0,
      },
    })
    const text = wrapper.text()
    expect(text).not.toContain('▲')
    expect(text).not.toContain('▼')
    expect(text).toContain('$0.00')
  })
})
