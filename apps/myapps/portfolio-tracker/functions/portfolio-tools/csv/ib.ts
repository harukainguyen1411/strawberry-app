/**
 * ib.ts — Interactive Brokers Activity Statement CSV parser.
 *
 * Pure function: parseIbCsv(text): { trades, positions, errors }
 * No Firestore writes — orchestration lives in import.ts (V0.8).
 *
 * IB Activity Statement format:
 * - CSV with variable sections identified by the first column value
 * - Each section has a "Header" row followed by "Data" rows
 * - Key sections: "Trades", "Open Positions"
 * - Other sections (Statement, Cash Report, etc.) are silently ignored
 *
 * IB Trades columns (relevant subset):
 *   DataDiscriminator, Asset Category, Currency, Symbol,
 *   Date/Time, Quantity, T. Price, C. Price, Proceeds, Comm/Fee,
 *   Basis, Realized P/L, MTM P/L, Code
 *
 * IB Open Positions columns:
 *   DataDiscriminator, Asset Category, Currency, Symbol,
 *   Quantity, Mult, Cost Price, Cost Basis, Close Price, Value,
 *   Unrealized P/L, Code
 *
 * Trade ID: uses the "Code" column (IB-assigned trade ID). Falls back to
 * deterministic hash of (Symbol + Date/Time + Quantity) if Code is empty.
 *
 * Refs V0.7
 */

import type { Trade, Position, ImportError } from '../types.js'

const REQUIRED_TRADE_HEADERS = [
  'DataDiscriminator',
  'Currency',
  'Symbol',
  'Date/Time',
  'Quantity',
  'T. Price',
  'Code',
] as const

const REQUIRED_POSITION_HEADERS = [
  'DataDiscriminator',
  'Currency',
  'Symbol',
  'Quantity',
  'Cost Price',
] as const

export interface IbParseResult {
  trades: Trade[]
  positions: Position[]
  errors: ImportError[]
}

type SectionHeaders = { [col: string]: number }

/**
 * parseIbCsv — pure CSV parser for IB Activity Statement format.
 */
export function parseIbCsv(text: string): IbParseResult {
  const clean = text.startsWith('\uFEFF') ? text.slice(1) : text
  const lines = clean.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')

  // Parse all lines into { section, type, cols[] } records
  const records = lines
    .map((line) => {
      if (line.trim() === '') return null
      const cols = parseCsvRow(line)
      if (cols.length < 2) return null
      return { section: cols[0].trim(), type: cols[1].trim(), cols }
    })
    .filter((r): r is { section: string; type: string; cols: string[] } => r !== null)

  // Build section maps: section name → { headers, dataRows[] }
  type SectionData = {
    headers: SectionHeaders
    rawHeaders: string[]
    dataRows: string[][]
  }

  const sections = new Map<string, SectionData>()

  for (const record of records) {
    if (record.type === 'Header') {
      // Columns start at index 2 (after section name + "Header")
      const hdrs = record.cols.slice(2)
      const hdrMap: SectionHeaders = {}
      hdrs.forEach((h, i) => { hdrMap[h.trim()] = i })
      sections.set(record.section, { headers: hdrMap, rawHeaders: hdrs, dataRows: [] })
    } else if (record.type === 'Data') {
      const sec = sections.get(record.section)
      if (sec) {
        sec.dataRows.push(record.cols.slice(2))
      }
      // If no header has been seen yet for this section, silently ignore
    }
    // Other types (Total, SubTotal, etc.) are ignored
  }

  const trades: Trade[] = []
  const positions: Position[] = []
  const errors: ImportError[] = []

  // Parse Trades section
  const tradesSec = sections.get('Trades')
  if (tradesSec) {
    // Validate headers
    const missingTradeHdrs = REQUIRED_TRADE_HEADERS.filter(
      (h) => !(h in tradesSec.headers)
    )
    if (missingTradeHdrs.length > 0) {
      errors.push({
        kind: 'bad_headers',
        section: 'Trades',
        expected: [...REQUIRED_TRADE_HEADERS],
        received: tradesSec.rawHeaders,
        message: `Missing required Trades columns: ${missingTradeHdrs.join(', ')}`,
      })
    } else {
      const h = tradesSec.headers
      for (let i = 0; i < tradesSec.dataRows.length; i++) {
        const row = tradesSec.dataRows[i]
        const rowNum = i + 1

        const discriminator = row[h['DataDiscriminator']] ?? ''
        // Skip Summary/SubTotal rows
        if (discriminator.toLowerCase() !== 'order') continue

        const currency = (row[h['Currency']] ?? 'USD') as 'USD' | 'EUR'
        const symbol = (row[h['Symbol']] ?? '').trim()
        const dateStr = row[h['Date/Time']] ?? ''
        const quantityStr = row[h['Quantity']] ?? ''
        const priceStr = row[h['T. Price']] ?? ''
        const tradeCode = (row[h['Code']] ?? '').trim()

        if (!priceStr || priceStr.trim() === '') {
          errors.push({ kind: 'missing_price', row: rowNum, section: 'Trades', message: `Trades row ${rowNum}: missing price` })
          continue
        }

        const price = parseFloat(priceStr)
        if (isNaN(price)) {
          errors.push({ kind: 'missing_price', row: rowNum, section: 'Trades', message: `Trades row ${rowNum}: invalid price "${priceStr}"` })
          continue
        }

        const executedAt = parseIbDate(dateStr)
        if (!executedAt) {
          errors.push({ kind: 'bad_date', row: rowNum, section: 'Trades', message: `Trades row ${rowNum}: invalid date "${dateStr}"` })
          continue
        }

        const quantity = parseFloat(quantityStr)
        if (isNaN(quantity)) {
          errors.push({ kind: 'missing_quantity', row: rowNum, section: 'Trades', message: `Trades row ${rowNum}: invalid quantity "${quantityStr}"` })
          continue
        }

        const side: 'BUY' | 'SELL' = quantity >= 0 ? 'BUY' : 'SELL'
        const absQty = Math.abs(quantity)

        // Parse IB Code flags (e.g. "O", "C", "O;P", "C;P").
        // O = open trade (new position); C = close trade (reduces position).
        // A short-open has qty < 0 + Code=O; a buy-to-cover has qty > 0 + Code=C.
        // Store the open/close flag in rawPayload so v0.8 position-math can
        // distinguish a cover from a long open without needing a Trade type change.
        const codeFlags = tradeCode.split(';').map((f) => f.trim().toUpperCase())
        const openClose: 'O' | 'C' | undefined = codeFlags.includes('O')
          ? 'O'
          : codeFlags.includes('C')
          ? 'C'
          : undefined

        const id = deterministicId(symbol, dateStr, String(quantity))

        trades.push({
          id,
          broker: 'IB',
          ticker: symbol,
          side,
          quantity: absQty,
          price: { amount: price, currency },
          currency,
          executedAt,
          ...(openClose !== undefined ? { rawPayload: { openClose } } : {}),
        })
      }
    }
  }

  // Parse Open Positions section
  const posSec = sections.get('Open Positions')
  if (posSec) {
    const missingPosHdrs = REQUIRED_POSITION_HEADERS.filter(
      (h) => !(h in posSec.headers)
    )
    if (missingPosHdrs.length > 0) {
      errors.push({
        kind: 'bad_headers',
        section: 'Open Positions',
        expected: [...REQUIRED_POSITION_HEADERS],
        received: posSec.rawHeaders,
        message: `Missing required Open Positions columns: ${missingPosHdrs.join(', ')}`,
      })
    } else {
      const h = posSec.headers
      for (const row of posSec.dataRows) {
        const discriminator = row[h['DataDiscriminator']] ?? ''
        if (discriminator.toLowerCase() !== 'summary') continue

        const currency = (row[h['Currency']] ?? 'USD') as 'USD' | 'EUR'
        const symbol = (row[h['Symbol']] ?? '').trim()
        const quantityStr = row[h['Quantity']] ?? ''
        const costPriceStr = row[h['Cost Price']] ?? ''

        const quantity = parseFloat(quantityStr)
        const costPrice = parseFloat(costPriceStr)

        if (!symbol || isNaN(quantity) || isNaN(costPrice)) continue

        positions.push({
          ticker: symbol,
          broker: 'IB',
          quantity: Math.abs(quantity),
          avgCost: { amount: costPrice, currency },
          currency,
        })
      }
    }
  }

  // If neither section was found but file has some content, it's not necessarily an error
  // (IB statements can have many sections we don't parse)

  return { trades, positions, errors }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function parseIbDate(s: string): Date | null {
  if (!s || s.trim() === '') return null
  // IB format: "2026-04-01 09:30:00" or "2026-04-01, 09:30:00"
  const normalized = s.replace(', ', 'T').replace(' ', 'T')
  const d = new Date(normalized + 'Z')
  if (isNaN(d.getTime())) return null
  return d
}

function deterministicId(symbol: string, time: string, qty: string): string {
  const str = `IB|${symbol}|${time}|${qty}`
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) >>> 0
  }
  return `ib-fallback-${h.toString(16)}`
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
