/**
 * Shared types for portfolio-tools handlers.
 * These mirror the Firestore types in src/types/firestore.ts but are
 * plain-object runtime types (not Firestore Timestamp, etc.) for use
 * in handler logic and tests.
 */

export type CurrencyCode = 'USD' | 'EUR'

export interface Money {
  amount: number
  currency: CurrencyCode
}

export interface Snapshot {
  baseCurrency: CurrencyCode
  totalValueBase: number
  perBroker: Record<string, number>
  perAsset: Record<string, number>
  takenAt: Date
}

export interface Trade {
  id: string          // broker-assigned, used as Firestore doc ID
  broker: 'T212' | 'IB'
  ticker: string
  side: 'BUY' | 'SELL'
  quantity: number
  price: Money
  fee?: Money
  currency: CurrencyCode
  executedAt: Date
  rawPayload?: Record<string, unknown>
}

export interface Position {
  ticker: string
  broker: 'T212' | 'IB'
  quantity: number
  avgCost: Money
  currency: CurrencyCode
  lastPrice?: number
  lastPriceAt?: Date
  marketValue?: Money
  sector?: string
  assetClass?: string
}

export interface Holding {
  ticker: string
  broker: 'T212' | 'IB'
  quantity: number
  avgCost: Money          // native currency
  marketValue: Money      // base currency (converted)
  pl: Money               // base currency
  plPct: number
  sector?: string
  assetClass?: string
  lastPriceAt?: Date
}

export interface ImportResult {
  tradesAdded: number
  tradesSkipped: number
  positionsWritten: number
  errors: ImportError[]
}

export interface ImportError {
  kind: string
  row?: number
  section?: string
  message?: string
  expected?: string[]
  received?: string[]
}

/** Minimal context passed to every tool handler */
export interface HandlerContext {
  uid: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any  // Firestore Admin instance — typed loosely to avoid firebase-admin dep in tests
}
