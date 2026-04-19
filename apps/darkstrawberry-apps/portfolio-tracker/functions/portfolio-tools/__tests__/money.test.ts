/**
 * A.2 — Money + FX convert tests (Refs V0.5)
 *
 * Implementation commit: all tests flipped from it.fails() to it().
 */

import { describe, it, expect } from 'vitest'
import { convert, FxRateMissingError, UnknownCurrencyError } from '../money.js'

describe('A.2 — Money + FX convert', () => {
  it('A.2.1 USD→EUR with rate 0.92 returns 92 EUR for 100 USD', () => {
    expect(convert(100, 'USD', 'EUR', { 'USD->EUR': 0.92 })).toEqual({ amount: 92, currency: 'EUR' })
  })

  it('A.2.2 USD→USD identity (no rate lookup)', () => {
    expect(convert(100, 'USD', 'USD', {})).toEqual({ amount: 100, currency: 'USD' })
  })

  it('A.2.3 override beats base rate', () => {
    expect(
      convert(100, 'USD', 'EUR', { rates: { 'USD->EUR': 0.92 }, overrides: { 'USD->EUR': 0.93 } })
    ).toEqual({ amount: 93, currency: 'EUR' })
  })

  it('A.2.4 unknown pair throws FxRateMissingError', () => {
    expect(() => convert(100, 'USD', 'EUR', {})).toThrow(FxRateMissingError)
  })

  it('A.2.5 zero amount converts correctly', () => {
    expect(convert(0, 'USD', 'EUR', { 'USD->EUR': 0.92 })).toEqual({ amount: 0, currency: 'EUR' })
  })

  it('A.2.6 negative amounts allowed (losses/debits)', () => {
    expect(convert(-100, 'USD', 'EUR', { 'USD->EUR': 0.92 })).toEqual({ amount: -92, currency: 'EUR' })
  })

  it('A.2.7 float amount converts with close tolerance', () => {
    const result = convert(100.005, 'USD', 'EUR', { 'USD->EUR': 0.92 })
    expect(result.currency).toBe('EUR')
    expect(result.amount).toBeCloseTo(92.0046, 4)
  })

  it('A.2.8 unknown currency code throws UnknownCurrencyError', () => {
    expect(() => convert(100, 'USD', 'XXX' as 'USD', { 'USD->EUR': 0.92 })).toThrow(UnknownCurrencyError)
  })
})
