/**
 * t212.ts — Trading 212 CSV export parser.
 *
 * Pure function: parseT212Csv(text): { trades, positions, errors }
 * No Firestore writes — orchestration lives in import.ts (V0.8).
 *
 * T212 export columns (as of 2026):
 *   Action, Time, ISIN, Ticker, Name, No. of shares, Price / share,
 *   Currency (Price / share), Exchange rate, Result, Currency (Result),
 *   Total, Currency (Total), Withholding tax, Currency (Withholding tax),
 *   Notes, ID, Currency conversion fee, Currency (Currency conversion fee)
 *
 * Trade ID derivation: T212 exports have an "ID" column (e.g. "T212-001").
 * We use it directly as the broker-assigned ID for idempotent upserts.
 * If the ID column is empty, we fall back to a deterministic hash of
 * (Ticker + Time + Action) — documented here per V0.6 acceptance.
 *
 * Refs V0.6
 */

import type { Trade, Position, ImportError } from '../types.js'

// Actions that represent actual market trades. All other action strings
// (Dividend, Deposit, Interest, Fee, Currency conversion, etc.) are skipped.
const TRADE_ACTIONS = new Set([
  'market buy',
  'market sell',
  'limit buy',
  'limit sell',
])


const REQUIRED_HEADERS = [
  'Action',
  'Time',
  'Ticker',
  'No. of shares',
  'Price / share',
  'Currency (Price / share)',
  'ID',
] as const

export interface ParseResult {
  trades: Trade[]
  positions: Position[]
  errors: ImportError[]
}

/**
 * parseT212Csv — pure CSV parser for T212 export format.
 */
export function parseT212Csv(text: string): ParseResult {
  // Strip BOM
  const clean = text.startsWith('\uFEFF') ? text.slice(1) : text

  // Normalize line endings
  const lines = clean.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')

  // Filter blank trailing lines
  const nonEmpty = lines.filter((l) => l.trim().length > 0)

  if (nonEmpty.length === 0) {
    return { trades: [], positions: [], errors: [] }
  }

  const headerLine = nonEmpty[0]
  const headers = parseCsvRow(headerLine)

  // Validate headers
  const missingHeaders = REQUIRED_HEADERS.filter((h) => !headers.includes(h))
  if (missingHeaders.length > 0) {
    return {
      trades: [],
      positions: [],
      errors: [
        {
          kind: 'bad_headers',
          expected: [...REQUIRED_HEADERS],
          received: headers,
          message: `Missing required columns: ${missingHeaders.join(', ')}`,
        },
      ],
    }
  }

  const idx = (name: string) => headers.indexOf(name)

  const dataRows = nonEmpty.slice(1)

  if (dataRows.length === 0) {
    return { trades: [], positions: [], errors: [] }
  }

  const trades: Trade[] = []
  const errors: ImportError[] = []
  const positionMap = new Map<string, Position>()

  for (let i = 0; i < dataRows.length; i++) {
    const rowNum = i + 2 // 1-indexed, +1 for header
    const row = parseCsvRow(dataRows[i])

    const action = row[idx('Action')] ?? ''
    const ticker = row[idx('Ticker')] ?? ''
    const timeStr = row[idx('Time')] ?? ''
    const sharesStr = row[idx('No. of shares')] ?? ''
    const priceStr = row[idx('Price / share')] ?? ''
    const priceCurrency = (row[idx('Currency (Price / share)')] ?? 'USD') as 'USD' | 'EUR'
    const tradeId = row[idx('ID')] ?? ''

    // Skip non-trade rows (dividends, deposits, interest, fees, etc.)
    if (!TRADE_ACTIONS.has(action.toLowerCase())) {
      continue
    }


    // Validate price
    if (!priceStr || priceStr.trim() === '') {
      errors.push({ kind: 'missing_price', row: rowNum, message: `Row ${rowNum}: missing price` })
      continue
    }

    const price = parseDecimal(priceStr)
    if (isNaN(price)) {
      errors.push({ kind: 'missing_price', row: rowNum, message: `Row ${rowNum}: invalid price "${priceStr}"` })
      continue
    }

    // Validate date
    const executedAt = parseT212Date(timeStr)
    if (!executedAt) {
      errors.push({ kind: 'bad_date', row: rowNum, message: `Row ${rowNum}: invalid date "${timeStr}"`, ...(timeStr ? { received: [timeStr] } : {}) })
      continue
    }

    const quantity = parseFloat(sharesStr)
    if (isNaN(quantity)) {
      errors.push({ kind: 'missing_quantity', row: rowNum, message: `Row ${rowNum}: invalid quantity "${sharesStr}"` })
      continue
    }

    const side: 'BUY' | 'SELL' = action.toLowerCase().includes('sell') ? 'SELL' : 'BUY'

    // ID fallback: hash of ticker+time+action for idempotency
    const id = tradeId.trim() || deterministicId(ticker, timeStr, action)

    const trade: Trade = {
      id,
      broker: 'T212',
      ticker,
      side,
      quantity,
      price: { amount: price, currency: priceCurrency },
      currency: priceCurrency,
      executedAt,
    }

    trades.push(trade)

    // Update position map (materialized view from trades)
    updatePositionMap(positionMap, trade)
  }

  const positions = [...positionMap.values()]

  return { trades, positions, errors }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * parseDecimal — parses a numeric string in either standard (1,234.56)
 * or EU (1.234,56) decimal format.
 *
 * Detection logic:
 *   - If the string contains a comma followed by exactly 2 digits at the end
 *     (e.g. "1.234,56" or "1234,56"), treat as EU format: strip dots, replace
 *     trailing comma with a period.
 *   - Otherwise fall through to standard parseFloat (handles "1,234.56" and
 *     bare "148.50").
 */
function parseDecimal(s: string): number {
  const trimmed = s.trim()
  // EU format: optional thousands (dot-separated groups), comma-decimal
  // e.g. "1.234,56" or "1234,56"
  if (/^\d{1,3}(\.\d{3})*,\d+$/.test(trimmed)) {
    const normalized = trimmed.replace(/\./g, '').replace(',', '.')
    return parseFloat(normalized)
  }
  // Standard format or bare integer — strip thousands commas then parse
  return parseFloat(trimmed.replace(/,(?=\d{3})/g, ''))
}


function parseT212Date(s: string): Date | null {
  if (!s || s.trim() === '') return null
  // T212 format: "2026-04-01 09:30:00"
  const d = new Date(s.replace(' ', 'T') + 'Z')
  if (isNaN(d.getTime())) return null
  return d
}

function deterministicId(ticker: string, time: string, action: string): string {
  // Simple hash for fallback ID — not cryptographic, just stable
  const str = `${ticker}|${time}|${action}`
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) >>> 0
  }
  return `t212-fallback-${h.toString(16)}`
}

function updatePositionMap(map: Map<string, Position>, trade: Trade): void {
  const existing = map.get(trade.ticker)
  if (!existing) {
    if (trade.side === 'BUY') {
      map.set(trade.ticker, {
        ticker: trade.ticker,
        broker: 'T212',
        quantity: trade.quantity,
        avgCost: { amount: trade.price.amount, currency: trade.currency },
        currency: trade.currency,
      })
    }
    return
  }

  if (trade.side === 'BUY') {
    const totalShares = existing.quantity + trade.quantity
    const totalCost = existing.avgCost.amount * existing.quantity + trade.price.amount * trade.quantity
    existing.quantity = totalShares
    existing.avgCost = { amount: totalCost / totalShares, currency: existing.currency }
  } else {
    existing.quantity = Math.max(0, existing.quantity - trade.quantity)
    if (existing.quantity === 0) {
      map.delete(trade.ticker)
    }
  }
}

/**
 * parseCsvRow — handles quoted fields with commas inside.
 */
function parseCsvRow(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}
