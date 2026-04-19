/**
 * fx.ts — Firestore loader for users/{uid}/meta/fx.
 *
 * Loads FX rates and overrides for a user. Falls back to fxSeed.ts defaults
 * when the document is missing, and logs a structured warning.
 *
 * This module does NOT perform conversion — use money.ts convert() for that.
 *
 * Refs V0.5
 */

import { FX_SEED_RATES } from './fxSeed.js'

export interface FxData {
  rates: Record<string, number>
  overrides?: Record<string, number>
  updatedAt: Date | null
}

/**
 * loadFx — loads users/{uid}/meta/fx from Firestore.
 *
 * @param uid - user ID
 * @param db  - Firestore Admin instance (typed loosely to avoid hard dep in tests)
 * @returns FxData with rates, optional overrides, and updatedAt
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadFx(uid: string, db: any): Promise<FxData> {
  const docRef = db.collection('users').doc(uid).collection('meta').doc('fx')
  const snap = await docRef.get()

  if (!snap.exists) {
    console.warn(`[portfolio-tools/fx] meta/fx missing for uid=${uid} — falling back to seed rates`)
    return {
      rates: { ...FX_SEED_RATES },
      overrides: undefined,
      updatedAt: null,
    }
  }

  const data = snap.data() as {
    rates?: Record<string, number>
    overrides?: Record<string, number>
    updatedAt?: { toDate?: () => Date } | Date
  }

  const updatedAt =
    data.updatedAt && typeof (data.updatedAt as { toDate?: () => Date }).toDate === 'function'
      ? (data.updatedAt as { toDate: () => Date }).toDate()
      : (data.updatedAt as Date | null | undefined) ?? null

  return {
    rates: data.rates ?? {},
    overrides: data.overrides,
    updatedAt,
  }
}
