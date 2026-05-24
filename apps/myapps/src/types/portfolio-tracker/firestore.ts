import type { Timestamp } from 'firebase/firestore'

export type CurrencyCode = 'USD' | 'EUR'

export interface Money {
  amount: number
  currency: CurrencyCode
}

/** users/{uid} */
export interface User {
  email: string
  displayName: string
  baseCurrency: CurrencyCode
  createdAt: Timestamp
  updatedAt: Timestamp
}

/** users/{uid}/positions/{ticker} */
export interface Position {
  ticker: string
  broker: 'T212' | 'IB'
  quantity: number
  avgCost: Money
  currency: CurrencyCode
  lastPrice: number
  lastPriceAt: Timestamp
  marketValue: Money
  sector?: string
  assetClass?: string
}

/** users/{uid}/trades/{tradeId} — immutable; tradeId = broker-assigned ID */
export interface Trade {
  broker: 'T212' | 'IB'
  ticker: string
  side: 'BUY' | 'SELL'
  quantity: number
  price: Money
  fee?: Money
  currency: CurrencyCode
  executedAt: Timestamp
  rawPayload?: Record<string, unknown>
}

/** users/{uid}/cash/{broker} */
export interface Cash {
  broker: 'T212' | 'IB'
  currency: CurrencyCode
  amount: number
  updatedAt: Timestamp
}

/** users/{uid}/intents/{intentId} */
export interface Intent {
  rawText: string
  parsed?: {
    ticker?: string
    side?: 'BUY' | 'SELL'
    size?: number
    priceTarget?: number
    rationale?: string
  }
  status: 'open' | 'executed' | 'stale'
  matchedTradeId?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

/** users/{uid}/meta/fx */
export interface FxMeta {
  rates: Record<string, number>  // e.g. "USD->EUR": 0.92
  overrides?: Record<string, number>
  updatedAt: Timestamp
}

/** users/{uid}/snapshots/{YYYY-MM-DD} */
export interface Snapshot {
  baseCurrency: CurrencyCode
  totalValueBase: number
  perBroker: Record<string, number>
  perAsset: Record<string, number>
  takenAt: Timestamp
}

/** users/{uid}/digests/{YYYY-MM-DD} */
export interface Digest {
  kind: 'morning' | 'weekly'
  markdown: string
  model: string
  createdAt: Timestamp
  discordMessageId?: string
}

/** Holding — derived view model used by the UI (not stored in Firestore) */
export interface Holding {
  ticker: string
  broker: 'T212' | 'IB'
  quantity: number
  avgCost: Money
  marketValue: Money
  pl: Money
  plPct: number
  sector?: string
  assetClass?: string
  lastPriceAt?: Date
}
