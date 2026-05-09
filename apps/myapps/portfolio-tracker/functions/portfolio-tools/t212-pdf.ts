/**
 * t212-pdf.ts — Trading 212 Activity Statement PDF parser.
 *
 * Exports parseT212StatementPdf(buf: Buffer): Promise<T212PdfResult>
 *
 * Parsing strategy:
 *   1. Use pdf-parse (PDFParse class, server-side) to extract text per page.
 *   2. Find the page with "Invest account - open positions summary".
 *   3. Within that page, locate "Open positions" section.
 *   4. Parse tab-delimited rows after the header row.
 *   5. Extract account value from the Overview page ("Account value  \t€N,NNN.NN").
 *   6. Derive cash = account_value − sum(position.valueEur).
 *   7. Seed FX rates: for each non-1 FX rate found in positions rows,
 *      emit "<instrument_ccy>->EUR" = 1 / fxRate  (the PDF shows EUR/USD,
 *      we need USD->EUR for convertMoney).
 *
 * Position columns (tab-separated, from fixture):
 *   INSTRUMENT | ISIN | INSTRUMENT CURRENCY | QUANTITY | AVERAGE PRICE |
 *   PRICE | RETURN | VALUE | FX RATE | RETURN (EUR) | VALUE (EUR)
 *
 * Refs V0.1.0
 */

import { PDFParse } from 'pdf-parse'
import type { Position, Money } from './types.js'

// PDF magic bytes
const PDF_MAGIC = '%PDF'

export interface T212PdfParseError {
  kind: 'not_pdf' | 'no_positions_section' | 'no_account_value' | 'parse_row_error'
  message: string
  row?: string
}

export class T212PdfError extends Error {
  kind: T212PdfParseError['kind']
  row?: string

  constructor(err: T212PdfParseError) {
    super(err.message)
    this.name = 'T212PdfError'
    this.kind = err.kind
    this.row = err.row
  }
}

export interface T212PdfResult {
  positions: Position[]
  cash: Money
  fxRates: Record<string, number>
  accountValue: Money
}

// Expected column names (trimmed) in order:
// INSTRUMENT | ISIN | INSTRUMENT CURRENCY | QUANTITY | AVERAGE PRICE |
// PRICE | RETURN | VALUE | FX RATE | RETURN | VALUE
// Indices are resolved dynamically from the actual header row to tolerate
// trailing spaces that pdf-parse emits per column.
const EXPECTED_COLUMNS = [
  'INSTRUMENT',
  'ISIN',
  'INSTRUMENT CURRENCY',
  'QUANTITY',
  'AVERAGE PRICE',
  'PRICE',
  'RETURN',
  'VALUE',
  'FX RATE',
  'RETURN',
  'VALUE',
] as const

const POSITIONS_SECTION_MARKER = 'Open positions'
// The header line must contain these required columns (trimmed) to be recognized
const REQUIRED_POSITION_COLS = ['INSTRUMENT', 'ISIN', 'QUANTITY', 'FX RATE']

/**
 * parseT212StatementPdf — parse a T212 Activity Statement PDF.
 *
 * @throws T212PdfError with kind='not_pdf' if buffer is not a PDF.
 * @throws T212PdfError with kind='no_positions_section' if the open-positions
 *         section cannot be found.
 * @throws T212PdfError with kind='no_account_value' if account value cannot
 *         be extracted.
 */
export async function parseT212StatementPdf(buf: Buffer): Promise<T212PdfResult> {
  // Magic bytes check
  if (buf.length < 4 || buf.subarray(0, 4).toString('ascii') !== PDF_MAGIC) {
    throw new T212PdfError({ kind: 'not_pdf', message: 'Buffer is not a PDF (missing %PDF magic)' })
  }

  const parser = new PDFParse({ data: buf })
  const extracted = await parser.getText()
  await parser.destroy()

  const pages: string[] = extracted.pages.map((p: { text: string }) => p.text)
  const fullText = pages.join('\n')

  // --- Extract account value from Overview page ---
  const accountValue = extractAccountValue(fullText)

  // --- Find open positions section ---
  const positions = extractPositions(pages)

  // --- Derive FX rates ---
  // The PDF's FX RATE column shows the EUR/nativeCcy rate (e.g. 1.16951 means 1 EUR = 1.16951 USD).
  // Seed BOTH directions because convertMoney in usePortfolio does not
  // auto-invert: a USD-base dashboard with EUR positions needs EUR->USD;
  // a EUR-base dashboard with USD positions needs USD->EUR.
  //   src->EUR  = 1 / fxRate  (the inversion of what's printed)
  //   EUR->src  = fxRate      (what's printed in the FX RATE column)
  const fxRates: Record<string, number> = {}
  for (const pos of positions) {
    if (pos.currency !== 'EUR' && pos._fxRate != null && pos._fxRate !== 1) {
      const srcToEur = `${pos.currency}->EUR`
      const eurToSrc = `EUR->${pos.currency}`
      // Round to 6 decimal places to avoid floating-point noise
      if (!(srcToEur in fxRates)) {
        fxRates[srcToEur] = Math.round((1 / pos._fxRate) * 1_000_000) / 1_000_000
      }
      if (!(eurToSrc in fxRates)) {
        fxRates[eurToSrc] = Math.round(pos._fxRate * 1_000_000) / 1_000_000
      }
    }
  }

  // --- Derive cash ---
  // Sum the EUR-converted position values from the VALUE_EUR column
  const totalPositionsEur = positions.reduce((acc, p) => acc + (p._valueEur ?? 0), 0)
  const cashAmount = Math.round((accountValue.amount - totalPositionsEur) * 100) / 100

  // Clean up internal fields before returning
  const cleanPositions: Position[] = positions.map(({ _fxRate: _f, _valueEur: _v, ...rest }) => rest as Position)

  return {
    positions: cleanPositions,
    cash: { amount: cashAmount, currency: 'EUR' },
    fxRates,
    accountValue,
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Internal position shape with extra parsed fields for cash derivation */
interface PositionInternal extends Position {
  _fxRate?: number
  _valueEur?: number
}

function extractAccountValue(fullText: string): Money {
  // Match "Account value \t€N,NNN.NN" — tabs in the tab-extracted text
  const match = fullText.match(/Account value\s*\t€([\d,]+\.?\d*)/)
  if (!match) {
    throw new T212PdfError({
      kind: 'no_account_value',
      message: 'Could not find "Account value" in PDF text',
    })
  }
  const amount = parseEuroAmount(match[1])
  if (isNaN(amount)) {
    throw new T212PdfError({
      kind: 'no_account_value',
      message: `Could not parse account value: "${match[1]}"`,
    })
  }
  return { amount, currency: 'EUR' }
}

function extractPositions(pages: string[]): PositionInternal[] {
  // Find the page with open positions
  let positionsPage: string | null = null
  for (const page of pages) {
    if (page.includes(POSITIONS_SECTION_MARKER)) {
      positionsPage = page
      break
    }
  }

  if (!positionsPage) {
    throw new T212PdfError({
      kind: 'no_positions_section',
      message: 'Could not find "Open positions" section in PDF',
    })
  }

  // Find the "Open positions" marker, then search for the header line after it
  const sectionIdx = positionsPage.indexOf(POSITIONS_SECTION_MARKER)
  const afterSection = positionsPage.slice(sectionIdx + POSITIONS_SECTION_MARKER.length)

  // Split into lines and find the header row dynamically
  // The header row has tab-separated column names (potentially with trailing spaces)
  const allLines = afterSection.split('\n')
  let headerLineIdx = -1
  let colIndices: { INSTRUMENT: number; ISIN: number; CURRENCY: number; QUANTITY: number; AVERAGE_PRICE: number; PRICE: number; VALUE: number; FX_RATE: number; VALUE_EUR: number } | null = null

  for (let i = 0; i < allLines.length; i++) {
    const trimmedCols = allLines[i].split('\t').map(c => c.trim())
    const isHeader = REQUIRED_POSITION_COLS.every(req => trimmedCols.includes(req))
    if (isHeader) {
      headerLineIdx = i
      // Build column index map
      colIndices = {
        INSTRUMENT: trimmedCols.indexOf('INSTRUMENT'),
        ISIN: trimmedCols.indexOf('ISIN'),
        CURRENCY: trimmedCols.indexOf('INSTRUMENT CURRENCY'),
        QUANTITY: trimmedCols.indexOf('QUANTITY'),
        AVERAGE_PRICE: trimmedCols.indexOf('AVERAGE PRICE'),
        PRICE: trimmedCols.indexOf('PRICE'),
        VALUE: trimmedCols.indexOf('VALUE'),
        FX_RATE: trimmedCols.indexOf('FX RATE'),
        // VALUE appears twice: col 7 (native) and col 10 (EUR) — take last
        VALUE_EUR: trimmedCols.lastIndexOf('VALUE'),
      }
      break
    }
  }

  if (headerLineIdx === -1 || !colIndices) {
    // "No data available" means empty positions — not an error
    if (afterSection.includes('No data available')) {
      return []
    }
    throw new T212PdfError({
      kind: 'no_positions_section',
      message: 'Could not find open positions header row',
    })
  }

  // Parse data rows after the header
  const dataLines = allLines.slice(headerLineIdx + 1).map(l => l.trim()).filter(l => l.length > 0)
  const positions: PositionInternal[] = []

  for (const line of dataLines) {
    // Stop at disclaimer text
    if (line.startsWith('Your cash is safeguarded') || line.startsWith('Trading 212')) {
      break
    }

    const rawCols = line.split('\t')
    const cols = rawCols.map(c => c.trim())

    // Need at least enough columns for VALUE_EUR
    if (cols.length < colIndices.VALUE_EUR + 1) {
      continue
    }

    const ticker = cols[colIndices.INSTRUMENT]
    // Tickers are all-caps letters, digits, and dots (e.g. BRK.B, IE-prefixed ETFs)
    if (!ticker || !/^[A-Z0-9.]+$/.test(ticker)) {
      continue
    }

    try {
      const pos = parsePositionRow(cols, colIndices)
      positions.push(pos)
    } catch {
      // Log offending row loudly — don't silently drop
      console.error(`[t212-pdf] Failed to parse position row: "${line}"`)
      throw new T212PdfError({
        kind: 'parse_row_error',
        message: `Could not parse position row for ticker "${ticker}"`,
        row: line,
      })
    }
  }

  return positions
}

type ColIndices = { INSTRUMENT: number; ISIN: number; CURRENCY: number; QUANTITY: number; AVERAGE_PRICE: number; PRICE: number; VALUE: number; FX_RATE: number; VALUE_EUR: number }

function parsePositionRow(cols: string[], idx: ColIndices): PositionInternal {
  const ticker = cols[idx.INSTRUMENT]
  const isin = cols[idx.ISIN]
  const currencyRaw = cols[idx.CURRENCY]
  const currency = currencyRaw as 'USD' | 'EUR'

  const quantity = parseNum(cols[idx.QUANTITY])
  const avgCostAmount = parseNum(cols[idx.AVERAGE_PRICE])
  const lastPrice = parseNum(cols[idx.PRICE])
  const valueNative = parseNum(cols[idx.VALUE])
  const fxRate = parseNum(cols[idx.FX_RATE])
  const valueEurRaw = cols[idx.VALUE_EUR]
  const valueEur = parseEuroAmount(valueEurRaw)

  return {
    ticker,
    broker: 'T212',
    quantity,
    avgCost: { amount: avgCostAmount, currency },
    currency,
    lastPrice,
    marketValue: { amount: valueNative, currency },
    // Internal fields for derivation
    _fxRate: fxRate,
    _valueEur: isNaN(valueEur) ? valueNative / (fxRate || 1) : valueEur,
    // Optional fields
    ...(isin ? { isin } : {}),
  } as PositionInternal
}

/** Parse a plain numeric string (no € prefix, may have commas) */
function parseNum(s: string): number {
  const trimmed = s.trim().replace(/,/g, '')
  return parseFloat(trimmed)
}

/**
 * Parse a euro amount string that may include:
 *  - Commas as thousands separators: "20,643.09"
 *  - € prefix (caller strips it or we handle it here)
 *  - Negative sign: "-4.5" or "€-4.5"
 */
function parseEuroAmount(s: string): number {
  const trimmed = s.trim().replace(/€/g, '').replace(/,/g, '')
  return parseFloat(trimmed)
}
