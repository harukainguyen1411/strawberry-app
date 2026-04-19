/**
 * A.5 xfail-first tests for IB CSV parser bug fixes (Refs V0.7)
 *
 * Covers two bugs from Senna's changes-requested review on PR #41:
 *   1. Signed-qty SHORT/COVER misclassification — Code flag not read
 *   2. Asset Category absent from required headers — options/futures parsed as stocks
 *
 * These tests are committed as it.fails() before the fix exists.
 * The fix commits flip them to it().
 */

import { describe, it, expect } from 'vitest'

// Full header row used across inline CSV fixtures in this file
const TRADE_HEADERS =
  'DataDiscriminator,Asset Category,Currency,Symbol,Date/Time,Quantity,T. Price,C. Price,Proceeds,Comm/Fee,Basis,Realized P/L,MTM P/L,Code'

function tradesCsv(...dataRows: string[]): string {
  return [
    `Trades,Header,${TRADE_HEADERS}`,
    ...dataRows.map((r) => `Trades,Data,${r}`),
  ].join('\n')
}

describe('A.5 — IB CSV parser xfail: short/cover + asset-category bugs', () => {
  it.fails(
    'A.5.9 short-open: negative qty + Code=O classified as SELL with rawPayload.openClose=O',
    async () => {
      const { parseIbCsv } = await import('../ib.js')
      // qty=-5 (short open), Code contains O flag
      const csv = tradesCsv(
        'Order,Stocks,USD,AAPL,2026-04-10 09:30:00,-5,150.00,150.00,750.00,-0.50,750.50,0.00,-5.00,O'
      )
      const result = parseIbCsv(csv)
      expect(result.errors.length).toBe(0)
      expect(result.trades.length).toBe(1)
      const trade = result.trades[0]
      expect(trade.side).toBe('SELL')
      expect(trade.quantity).toBe(5)
      expect(trade.rawPayload?.openClose).toBe('O')
    }
  )

  it.fails(
    'A.5.10 buy-to-cover: positive qty + Code=C classified as BUY with rawPayload.openClose=C',
    async () => {
      const { parseIbCsv } = await import('../ib.js')
      // qty=+5 (buy to cover), Code contains C flag
      const csv = tradesCsv(
        'Order,Stocks,USD,AAPL,2026-04-11 09:30:00,5,152.00,152.00,-760.00,-0.50,-760.50,10.00,0.00,C'
      )
      const result = parseIbCsv(csv)
      expect(result.errors.length).toBe(0)
      expect(result.trades.length).toBe(1)
      const trade = result.trades[0]
      expect(trade.side).toBe('BUY')
      expect(trade.quantity).toBe(5)
      expect(trade.rawPayload?.openClose).toBe('C')
    }
  )

  it.fails(
    'A.5.11 missing Asset Category in Trades header → bad_headers error, no trades parsed',
    async () => {
      const { parseIbCsv } = await import('../ib.js')
      // Header row deliberately omits Asset Category
      const csv = [
        'Trades,Header,DataDiscriminator,Currency,Symbol,Date/Time,Quantity,T. Price,C. Price,Proceeds,Comm/Fee,Basis,Realized P/L,MTM P/L,Code',
        'Trades,Data,Order,USD,AAPL,2026-04-10 09:30:00,10,150.00,150.00,-1500.00,-1.00,-1501.00,0.00,0.00,IB-X001',
      ].join('\n')
      const result = parseIbCsv(csv)
      expect(result.trades.length).toBe(0)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0].kind).toBe('bad_headers')
      expect(result.errors[0].section).toBe('Trades')
    }
  )

  it.fails(
    'A.5.12 options row (Asset Category=Options) bucketed as unsupported, not added to trades',
    async () => {
      const { parseIbCsv } = await import('../ib.js')
      // Mix: one Stocks row + one Options row
      const csv = tradesCsv(
        'Order,Stocks,USD,AAPL,2026-04-10 09:30:00,10,150.00,150.00,-1500.00,-1.00,-1501.00,0.00,0.00,IB-T100',
        'Order,Options,USD,AAPL 20261218C00150000,2026-04-10 10:00:00,2,3.50,3.50,-700.00,-0.50,-700.50,0.00,0.00,IB-T101'
      )
      const result = parseIbCsv(csv)
      // Only the Stocks trade is added
      expect(result.trades.length).toBe(1)
      expect(result.trades[0].ticker).toBe('AAPL')
      // An unsupported_asset_category warning is emitted for the Options row
      const unsupportedErrors = result.errors.filter(
        (e) => e.kind === 'unsupported_asset_category'
      )
      expect(unsupportedErrors.length).toBe(1)
    }
  )
})
