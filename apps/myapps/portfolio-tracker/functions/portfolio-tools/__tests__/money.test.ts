/**
 * A.2 — Money + FX convert tests (Refs V0.5)
 *
 * xfail-first: all tests use it.fails() until implementation lands.
 */

import { describe, it, expect } from 'vitest'

describe('A.2 — Money + FX convert', () => {
  it.fails('A.2.1 USD→EUR with rate 0.92 returns 92 EUR for 100 USD', async () => {
    const { convert } = await import('../money.js')
    expect(convert(100, 'USD', 'EUR', { 'USD->EUR': 0.92 })).toEqual({ amount: 92, currency: 'EUR' })
  })

  it.fails('A.2.2 USD→USD identity (no rate lookup)', async () => {
    const { convert } = await import('../money.js')
    expect(convert(100, 'USD', 'USD', {})).toEqual({ amount: 100, currency: 'USD' })
  })

  it.fails('A.2.3 override beats base rate', async () => {
    const { convert } = await import('../money.js')
    expect(
      convert(100, 'USD', 'EUR', { rates: { 'USD->EUR': 0.92 }, overrides: { 'USD->EUR': 0.93 } })
    ).toEqual({ amount: 93, currency: 'EUR' })
  })

  it.fails('A.2.4 unknown pair throws FxRateMissingError', async () => {
    const { convert, FxRateMissingError } = await import('../money.js')
    expect(() => convert(100, 'USD', 'GBP', { 'USD->EUR': 0.92 })).toThrow(FxRateMissingError)
  })

  it.fails('A.2.5 zero amount converts correctly', async () => {
    const { convert } = await import('../money.js')
    expect(convert(0, 'USD', 'EUR', { 'USD->EUR': 0.92 })).toEqual({ amount: 0, currency: 'EUR' })
  })

  it.fails('A.2.6 negative amounts allowed (losses/debits)', async () => {
    const { convert } = await import('../money.js')
    expect(convert(-100, 'USD', 'EUR', { 'USD->EUR': 0.92 })).toEqual({ amount: -92, currency: 'EUR' })
  })

  it.fails('A.2.7 float amount converts with close tolerance', async () => {
    const { convert } = await import('../money.js')
    const result = convert(100.005, 'USD', 'EUR', { 'USD->EUR': 0.92 })
    expect(result.currency).toBe('EUR')
    expect(result.amount).toBeCloseTo(92.0046, 4)
  })

  it.fails('A.2.8 unknown currency code throws UnknownCurrencyError', async () => {
    const { convert, UnknownCurrencyError } = await import('../money.js')
    expect(() => convert(100, 'USD', 'XXX' as 'USD', { 'USD->EUR': 0.92 })).toThrow(UnknownCurrencyError)
  })
})
