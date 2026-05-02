/**
 * V0.14 — useMoneyFormat composable.
 *
 * Wraps Intl.NumberFormat with locale `en-US` for USD and `en-IE` for EUR
 * (per design spec §6). Returns a formatter function callable per-Money.
 *
 * Refs V0.14
 */

import { describe, it, expect } from 'vitest'
import { useMoneyFormat } from '@/composables/useMoneyFormat'

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
