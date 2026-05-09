/**
 * V0.14 — useMoneyFormat composable.
 *
 * Wraps Intl.NumberFormat with locale `en-US` for USD and `en-IE` for EUR
 * (per design spec §6). Returns a formatter function callable per-Money.
 *
 * V0.1.3 — adds formatQuantity helper: caps at ≤6 decimals, strips trailing
 * zeros. Domain is finite numbers; NaN/Infinity behavior is undefined.
 *
 * Refs V0.14, V0.1.3
 */

import { describe, it, expect } from 'vitest'
import { formatQuantity, useMoneyFormat } from '@/composables/useMoneyFormat'

describe('V0.14 — useMoneyFormat', () => {
  it('formats USD with en-US locale (currency symbol $, comma thousands, two decimals)', () => {
    const { format } = useMoneyFormat()
    expect(format({ amount: 14850, currency: 'USD' })).toBe('$14,850.00')
  })

  it('formats EUR with en-IE locale (€ prefix, comma thousands, two decimals)', () => {
    const { format } = useMoneyFormat()
    // en-IE renders EUR as "€14,850.00" (Irish English uses Euro symbol prefix).
    expect(format({ amount: 14850, currency: 'EUR' })).toBe('€14,850.00')
  })

  it('formats negative amounts with leading sign', () => {
    const { format } = useMoneyFormat()
    expect(format({ amount: -150, currency: 'USD' })).toBe('-$150.00')
  })
})

describe('V0.1.3 — formatQuantity', () => {
  it('renders integer 12 as "12" (no trailing decimal point)', () => {
    expect(formatQuantity(12)).toBe('12')
  })

  it('renders spec example 279.20583987000003 as "279.20584" (≤6 decimals after rounding)', () => {
    expect(formatQuantity(279.20583987000003)).toBe('279.20584')
  })

  it('strips trailing zeros after rounding: 10.100000000000001 → "10.1"', () => {
    expect(formatQuantity(10.100000000000001)).toBe('10.1')
  })

  it('renders whole-number float 10.0 as "10" (no trailing decimal, no zeros)', () => {
    expect(formatQuantity(10.0)).toBe('10')
  })
})
