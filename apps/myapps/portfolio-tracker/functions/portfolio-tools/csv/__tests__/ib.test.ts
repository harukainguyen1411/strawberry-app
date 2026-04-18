/**
 * A.5 — IB CSV parser tests (Refs V0.7)
 *
 * xfail-first: all tests use it.fails() until implementation lands.
 *
 * Note: uses synthetic fixtures (TODO: replace with real anonymized IB Activity
 * Statement at V0.20 when DV0-4 lands — see plans/approved/2026-04-19-portfolio-tracker-v0-tasks.md §DV0-4).
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

describe('A.5 — IB CSV parser', () => {
  it.fails('A.5.1 happy-path multi-section: trades from Trades section, positions from Open Positions', async () => {
    const { parseIbCsv } = await import('../ib.js')
    const result = parseIbCsv(fixture('ib-sample.csv'))
    expect(result.trades.length).toBeGreaterThan(0)
    expect(result.positions.length).toBeGreaterThan(0)
    expect(result.errors.length).toBe(0)
    expect(result.trades[0].broker).toBe('IB')
  })

  it.fails('A.5.2 bad-headers: both sections rejected, errors[0].kind === bad_headers', async () => {
    const { parseIbCsv } = await import('../ib.js')
    const result = parseIbCsv(fixture('ib-bad-headers.csv'))
    expect(result.trades.length).toBe(0)
    expect(result.positions.length).toBe(0)
    expect(result.errors[0].kind).toBe('bad_headers')
  })

  it.fails('A.5.3 missing Open Positions section: positions.length === 0, no error', async () => {
    const { parseIbCsv } = await import('../ib.js')
    const csv = [
      'Statement,Header,Field Name,Field Value',
      'Trades,Header,DataDiscriminator,Asset Category,Currency,Symbol,Date/Time,Quantity,T. Price,C. Price,Proceeds,Comm/Fee,Basis,Realized P/L,MTM P/L,Code',
      'Trades,Data,Order,Stocks,USD,AAPL,2026-04-01 09:30:00,10,148.50,150.00,-1485.00,-1.00,-1486.00,0.00,15.00,IB-T001',
    ].join('\n')
    const result = parseIbCsv(csv)
    expect(result.trades.length).toBe(1)
    expect(result.positions.length).toBe(0)
    expect(result.errors.length).toBe(0)
  })

  it.fails('A.5.4 only Open Positions section: trades.length === 0, positions populated', async () => {
    const { parseIbCsv } = await import('../ib.js')
    const csv = [
      'Statement,Header,Field Name,Field Value',
      'Open Positions,Header,DataDiscriminator,Asset Category,Currency,Symbol,Quantity,Mult,Cost Price,Cost Basis,Close Price,Value,Unrealized P/L,Code',
      'Open Positions,Data,Summary,Stocks,USD,AAPL,10,1,148.50,1485.00,152.00,1520.00,35.00,',
    ].join('\n')
    const result = parseIbCsv(csv)
    expect(result.trades.length).toBe(0)
    expect(result.positions.length).toBe(1)
    expect(result.errors.length).toBe(0)
  })

  it.fails('A.5.5 partial-bad: one bad row in Trades has section name in errors[i].section', async () => {
    const { parseIbCsv } = await import('../ib.js')
    const result = parseIbCsv(fixture('ib-partial-bad.csv'))
    expect(result.errors.length).toBe(1)
    expect(result.errors[0].section).toBe('Trades')
    expect(result.trades.length).toBe(3)  // 4 data rows minus 1 bad
  })

  it.fails('A.5.6 trade IDs are stable across two parses of the same fixture', async () => {
    const { parseIbCsv } = await import('../ib.js')
    const csv = fixture('ib-sample.csv')
    const r1 = parseIbCsv(csv)
    const r2 = parseIbCsv(csv)
    expect(r1.trades[0].id).toBe(r2.trades[0].id)
  })

  it.fails('A.5.7 unknown section (e.g. Statement Info) is silently ignored', async () => {
    const { parseIbCsv } = await import('../ib.js')
    const result = parseIbCsv(fixture('ib-sample.csv'))
    // The Statement section in ib-sample.csv should be silently ignored
    expect(result.errors.length).toBe(0)
  })

  it.fails('A.5.8 sections in different order: Positions before Trades both parsed', async () => {
    const { parseIbCsv } = await import('../ib.js')
    const csv = [
      'Open Positions,Header,DataDiscriminator,Asset Category,Currency,Symbol,Quantity,Mult,Cost Price,Cost Basis,Close Price,Value,Unrealized P/L,Code',
      'Open Positions,Data,Summary,Stocks,USD,AAPL,10,1,148.50,1485.00,152.00,1520.00,35.00,',
      'Trades,Header,DataDiscriminator,Asset Category,Currency,Symbol,Date/Time,Quantity,T. Price,C. Price,Proceeds,Comm/Fee,Basis,Realized P/L,MTM P/L,Code',
      'Trades,Data,Order,Stocks,USD,AAPL,2026-04-01 09:30:00,10,148.50,150.00,-1485.00,-1.00,-1486.00,0.00,15.00,IB-T001',
    ].join('\n')
    const result = parseIbCsv(csv)
    expect(result.trades.length).toBe(1)
    expect(result.positions.length).toBe(1)
    expect(result.errors.length).toBe(0)
  })
})
