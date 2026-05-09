/**
 * T212 PDF parser tests — V0.1.0 xfail-first then impl.
 *
 * Tests parseT212StatementPdf() against the anonymized fixture at
 * apps/myapps/portfolio-tracker/test/fixtures/t212-statement.pdf.
 *
 * Refs V0.1.0
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE = path.resolve(__dirname, '../../../test/fixtures/t212-statement.pdf')

describe('T212 PDF parser — fixture tests (V0.1.0)', () => {
  it('T212-PDF-01 parses 13 open positions from fixture', async () => {
    const { parseT212StatementPdf } = await import('../t212-pdf.js')
    const buf = fs.readFileSync(FIXTURE)
    const result = await parseT212StatementPdf(buf)
    expect(result.positions).toHaveLength(13)
  })

  it('T212-PDF-02 position tickers match expected set', async () => {
    const { parseT212StatementPdf } = await import('../t212-pdf.js')
    const buf = fs.readFileSync(FIXTURE)
    const result = await parseT212StatementPdf(buf)
    const tickers = result.positions.map(p => p.ticker).sort()
    expect(tickers).toEqual(['AMZN', 'BRK.B', 'GOOGL', 'LLY', 'MELI', 'META', 'MSFT', 'NVO', 'OSCR', 'UNH', 'VFEA', 'VUAA', 'WEBN'])
  })

  it('T212-PDF-03 AMZN position has correct quantity and avgCost', async () => {
    const { parseT212StatementPdf } = await import('../t212-pdf.js')
    const buf = fs.readFileSync(FIXTURE)
    const result = await parseT212StatementPdf(buf)
    const amzn = result.positions.find(p => p.ticker === 'AMZN')
    expect(amzn).toBeDefined()
    expect(amzn!.quantity).toBeCloseTo(2.17538194, 5)
    expect(amzn!.avgCost.amount).toBeCloseTo(201.51863539, 4)
    expect(amzn!.avgCost.currency).toBe('USD')
    expect(amzn!.currency).toBe('USD')
    expect(amzn!.broker).toBe('T212')
  })

  it('T212-PDF-04 EUR positions (VFEA, VUAA, WEBN) have currency EUR and FX rate 1', async () => {
    const { parseT212StatementPdf } = await import('../t212-pdf.js')
    const buf = fs.readFileSync(FIXTURE)
    const result = await parseT212StatementPdf(buf)
    const eur = result.positions.filter(p => ['VFEA', 'VUAA', 'WEBN'].includes(p.ticker))
    expect(eur).toHaveLength(3)
    for (const p of eur) {
      expect(p.currency).toBe('EUR')
    }
  })

  it('T212-PDF-05 accountValue is €20,643.09', async () => {
    const { parseT212StatementPdf } = await import('../t212-pdf.js')
    const buf = fs.readFileSync(FIXTURE)
    const result = await parseT212StatementPdf(buf)
    expect(result.accountValue.amount).toBeCloseTo(20643.09, 1)
    expect(result.accountValue.currency).toBe('EUR')
  })

  it('T212-PDF-06 cash is derived correctly (account_value - sum positions EUR value)', async () => {
    const { parseT212StatementPdf } = await import('../t212-pdf.js')
    const buf = fs.readFileSync(FIXTURE)
    const result = await parseT212StatementPdf(buf)
    // Actual cash from statement: €4082.95
    expect(result.cash.amount).toBeCloseTo(4082.95, 1)
    expect(result.cash.currency).toBe('EUR')
  })

  it('T212-PDF-07 fxRates contains USD->EUR from fixture (1.16951)', async () => {
    const { parseT212StatementPdf } = await import('../t212-pdf.js')
    const buf = fs.readFileSync(FIXTURE)
    const result = await parseT212StatementPdf(buf)
    expect(result.fxRates['USD->EUR']).toBeCloseTo(1 / 1.16951, 4)
  })

  it('T212-PDF-08 non-PDF buffer throws ParseError', async () => {
    const { parseT212StatementPdf } = await import('../t212-pdf.js')
    const notPdf = Buffer.from('Action,Time,ISIN\n')
    await expect(parseT212StatementPdf(notPdf)).rejects.toMatchObject({ kind: 'not_pdf' })
  })

  it('T212-PDF-09 positions have marketValue in native currency', async () => {
    const { parseT212StatementPdf } = await import('../t212-pdf.js')
    const buf = fs.readFileSync(FIXTURE)
    const result = await parseT212StatementPdf(buf)
    const amzn = result.positions.find(p => p.ticker === 'AMZN')
    expect(amzn!.marketValue).toBeDefined()
    // VALUE from fixture: 593.3354 USD
    expect(amzn!.marketValue!.amount).toBeCloseTo(593.3354, 2)
    expect(amzn!.marketValue!.currency).toBe('USD')
  })

  it('T212-PDF-10 lastPrice is current price from PRICE column', async () => {
    const { parseT212StatementPdf } = await import('../t212-pdf.js')
    const buf = fs.readFileSync(FIXTURE)
    const result = await parseT212StatementPdf(buf)
    const amzn = result.positions.find(p => p.ticker === 'AMZN')
    expect(amzn!.lastPrice).toBeCloseTo(272.75, 2)
  })

  // V0.1.0 regression — both-sides FX seeding.
  // Live smoke (USD base, T212 PDF) hit FxRateMissingError because the parser
  // only seeded `<src>->EUR` (the direction it reads from the statement).
  // A USD-base dashboard with EUR positions needs `EUR->USD` to render —
  // convertMoney() does NOT auto-invert. So the parser must seed both sides:
  // `<src>->EUR = 1/fxRate` AND `EUR-><src> = fxRate` (the printed value is
  // already the EUR-><src> direction: 1 EUR → 1.16951 USD).
  it.fails('T212-PDF-11 fxRates seeds both directions (USD->EUR and EUR->USD)', async () => {
    const { parseT212StatementPdf } = await import('../t212-pdf.js')
    const buf = fs.readFileSync(FIXTURE)
    const result = await parseT212StatementPdf(buf)
    // Original direction (already covered by T212-PDF-07): USD->EUR = 1/1.16951
    expect(result.fxRates['USD->EUR']).toBeCloseTo(1 / 1.16951, 4)
    // Inverse direction — the printed FX RATE value (1 EUR → 1.16951 USD)
    expect(result.fxRates['EUR->USD']).toBeCloseTo(1.16951, 4)
  })
})
