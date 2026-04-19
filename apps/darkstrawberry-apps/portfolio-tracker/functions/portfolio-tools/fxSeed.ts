/**
 * fxSeed.ts — static default FX rates for v0.
 *
 * These are approximate rates used as a fallback when users/{uid}/meta/fx
 * is missing. The ECB daily reference rate fetch lands in v1.
 *
 * Refs V0.5
 */

import type { CurrencyCode } from './types.js'

export const FX_SEED_RATES: Record<string, number> = {
  'USD->EUR': 0.92,
  'EUR->USD': 1.087,
}

/** All supported currency codes at v0 */
export const SUPPORTED_CURRENCIES: ReadonlySet<CurrencyCode> = new Set(['USD', 'EUR'])
