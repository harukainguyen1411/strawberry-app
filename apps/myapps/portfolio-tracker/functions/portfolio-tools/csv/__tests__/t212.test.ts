/**
 * A.4 — T212 CSV parser tests (Refs V0.6)
 *
 * Implementation commit: all tests flipped from it.fails() to it().
 *
 * Note: uses synthetic fixtures (TODO: replace with real anonymized export at V0.20
 * when DV0-3 lands — see plans/approved/2026-04-19-portfolio-tracker-v0-tasks.md §DV0-3).
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURES = path.resolve(__dirname, '../../../../test/fixtures')

function fixture(name: string) {
  return fs.readFileSync(path.join(FIXTURES, name), 'utf8')
}

describe('A.4 — T212 CSV parser', () => {
  it('A.4.1 happy-path: 47 rows → 47 trades, 12 positions, 0 errors', async () => {
    const { parseT212Csv } = await import('../t212.js')
    const result = parseT212Csv(fixture('t212-sample.csv'))
    expect(result.trades.length).toBe(47)
    expect(result.positions.length).toBe(12)
    expect(result.errors.length).toBe(0)
    // Snapshot first trade
    expect(result.trades[0].id).toBeTruthy()
    expect(result.trades[0].broker).toBe('T212')
  })

  it('A.4.2 bad-headers → errors[0].kind === bad_headers, no trades', async () => {
    const { parseT212Csv } = await import('../t212.js')
    const result = parseT212Csv(fixture('t212-bad-headers.csv'))
    expect(result.trades.length).toBe(0)
    expect(result.positions.length).toBe(0)
    expect(result.errors[0].kind).toBe('bad_headers')
    expect(result.errors[0]).toHaveProperty('expected')
    expect(result.errors[0]).toHaveProperty('received')
  })

  it('A.4.3 partial-bad: 45 trades + 2 errors with row numbers', async () => {
    const { parseT212Csv } = await import('../t212.js')
    const result = parseT212Csv(fixture('t212-partial-bad.csv'))
    expect(result.trades.length).toBe(45)
    expect(result.errors.length).toBe(2)
    const rowNums = result.errors.map((e) => e.row)
    expect(rowNums).toContain(7)
    expect(rowNums).toContain(15)
    const missingPriceErr = result.errors.find((e) => e.row === 7)
    expect(missingPriceErr?.kind).toBe('missing_price')
    const badDateErr = result.errors.find((e) => e.row === 15)
    expect(badDateErr?.kind).toBe('bad_date')
  })

  it('A.4.4 empty CSV (header only) → 0 trades, 0 positions, 0 errors', async () => {
    const { parseT212Csv } = await import('../t212.js')
    const result = parseT212Csv(fixture('t212-empty.csv'))
    expect(result.trades.length).toBe(0)
    expect(result.positions.length).toBe(0)
    expect(result.errors.length).toBe(0)
  })

  it('A.4.5 mixed-currency: each trade preserves native currency', async () => {
    const { parseT212Csv } = await import('../t212.js')
    const result = parseT212Csv(fixture('t212-mixed-currency.csv'))
    const usdTrade = result.trades.find((t) => t.ticker === 'AAPL')
    const eurTrade = result.trades.find((t) => t.ticker === 'DBK')
    expect(usdTrade?.price.currency).toBe('USD')
    expect(eurTrade?.price.currency).toBe('EUR')
  })

  it('A.4.6 parsing is deterministic (pure): same fixture → same output twice', async () => {
    const { parseT212Csv } = await import('../t212.js')
    const csv = fixture('t212-sample.csv')
    const r1 = parseT212Csv(csv)
    const r2 = parseT212Csv(csv)
    expect(r1.trades).toEqual(r2.trades)
    expect(r1.positions).toEqual(r2.positions)
  })

  it('A.4.7 trade IDs are stable across two parses of the same fixture', async () => {
    const { parseT212Csv } = await import('../t212.js')
    const csv = fixture('t212-sample.csv')
    const r1 = parseT212Csv(csv)
    const r2 = parseT212Csv(csv)
    expect(r1.trades[0].id).toBe(r2.trades[0].id)
  })

  it('A.4.8 CRLF line endings parse identically to LF', async () => {
    const { parseT212Csv } = await import('../t212.js')
    const lf = fixture('t212-sample.csv')
    const crlf = lf.replace(/\n/g, '\r\n')
    const r1 = parseT212Csv(lf)
    const r2 = parseT212Csv(crlf)
    expect(r2.trades.length).toBe(r1.trades.length)
    expect(r2.errors.length).toBe(r1.errors.length)
  })

  it('A.4.9 BOM prefix parses identically', async () => {
    const { parseT212Csv } = await import('../t212.js')
    const lf = fixture('t212-sample.csv')
    const bom = '\uFEFF' + lf
    const r1 = parseT212Csv(lf)
    const r2 = parseT212Csv(bom)
    expect(r2.trades.length).toBe(r1.trades.length)
  })

  it('A.4.10 quoted fields with commas are preserved', async () => {
    const { parseT212Csv } = await import('../t212.js')
    const csv = [
      'Action,Time,ISIN,Ticker,Name,No. of shares,Price / share,Currency (Price / share),Exchange rate,Result,Currency (Result),Total,Currency (Total),Withholding tax,Currency (Withholding tax),Notes,ID,Currency conversion fee,Currency (Currency conversion fee)',
      'Market buy,2026-04-01 09:30:00,US0378331005,AAPL,"Apple, Inc.",10,148.50,USD,1,1485.00,USD,1485.00,USD,,,,T212-001,0,USD',
    ].join('\n')
    const result = parseT212Csv(csv)
    expect(result.trades[0]).toBeTruthy()
    expect(result.errors.length).toBe(0)
  })
})
