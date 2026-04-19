/**
 * money.ts — pure Money type and FX conversion.
 *
 * No Firestore dependencies — this module is purely functional.
 * FX loading from Firestore lives in fx.ts.
 *
 * Refs V0.5
 */

import type { Money, CurrencyCode } from './types.js'

export type { Money, CurrencyCode }

const KNOWN_CURRENCIES: ReadonlySet<string> = new Set(['USD', 'EUR'])

export class FxRateMissingError extends Error {
  constructor(pair: string) {
    super(`FX rate missing for pair: ${pair}`)
    this.name = 'FxRateMissingError'
  }
}

export class UnknownCurrencyError extends Error {
  constructor(currency: string) {
    super(`Unknown currency code: ${currency}`)
    this.name = 'UnknownCurrencyError'
  }
}

/** Flat or structured FX rate map accepted by convert(). */
export type FxRateInput =
  | Record<string, number>
  | { rates: Record<string, number>; overrides?: Record<string, number> }

/**
 * convert — pure FX conversion.
 *
 * @param amount  - numeric amount in `from` currency
 * @param from    - source currency code
 * @param to      - target currency code
 * @param fxRates - flat rate map (e.g. `{ 'USD->EUR': 0.92 }`) or structured
 *                  `{ rates: {...}, overrides: {...} }`. Overrides take precedence.
 * @returns Money in target currency
 *
 * Note: Money.amount is a float at v0 (cent-level precision tolerable per
 * V0.5 acceptance criteria). Reassess at v1 if reconciliation requires
 * decimal/arbitrary precision.
 */
export function convert(
  amount: number,
  from: CurrencyCode | string,
  to: CurrencyCode | string,
  fxRates: FxRateInput
): Money {
  if (!KNOWN_CURRENCIES.has(to)) {
    throw new UnknownCurrencyError(to)
  }
  if (!KNOWN_CURRENCIES.has(from)) {
    throw new UnknownCurrencyError(from)
  }

  // Identity: same currency, no conversion needed
  if (from === to) {
    return { amount, currency: to as CurrencyCode }
  }

  // Resolve rate map: support both flat and structured inputs
  let rates: Record<string, number>
  let overrides: Record<string, number> | undefined

  if ('rates' in fxRates && typeof fxRates.rates === 'object') {
    rates = fxRates.rates
    overrides = fxRates.overrides
  } else {
    rates = fxRates as Record<string, number>
  }

  const pair = `${from}->${to}`

  // Override takes precedence over base rate
  const rate = overrides?.[pair] ?? rates[pair]

  if (rate === undefined) {
    throw new FxRateMissingError(pair)
  }

  return { amount: amount * rate, currency: to as CurrencyCode }
}
