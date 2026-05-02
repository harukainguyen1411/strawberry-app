/**
 * V0.17 — usePortfolio (stub).
 *
 * Throws at call time so Vite static import-analysis succeeds at transform
 * time (V0.13 lesson). Tests mock this composable; the real Firestore
 * subscription lands in the V0.17 impl commit.
 */

import type { ComputedRef } from 'vue'
import type { CurrencyCode, Holding, Money } from '@/types/firestore'

export type PortfolioStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface PortfolioSummary {
  totalValue: Money
  dayChange: Money | null
  dayChangePct: number | null
  positionsCount: number
  cashTotal: Money
}

export interface UsePortfolioReturn {
  status: ComputedRef<PortfolioStatus>
  loading: ComputedRef<boolean>
  holdings: ComputedRef<Holding[]>
  summary: ComputedRef<PortfolioSummary | null>
  baseCurrency: ComputedRef<CurrencyCode | null>
  error: ComputedRef<Error | null>
}

export function usePortfolio(): UsePortfolioReturn {
  throw new Error('V0.17 usePortfolio not yet implemented')
}
