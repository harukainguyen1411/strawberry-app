/**
 * B.2 — importCsv HTTPS callable integration tests (Refs V0.8)
 *
 * Implementation commit: all tests flipped from it.fails() to it().
 *
 * Uses in-memory Firestore mock (no emulator needed for unit tests).
 * Cross-user isolation is proven at the handler level: data written under
 * users/{uid}/ is only accessible with the same uid.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURES = path.resolve(__dirname, '../../test/fixtures')

function fixture(name: string) {
  return fs.readFileSync(path.join(FIXTURES, name), 'utf8')
}

/** Simple in-memory Firestore mock that tracks set/create operations */
function makeFirestoreMock() {
  const store: Map<string, Record<string, unknown>> = new Map()
  const writes: string[] = []

  return {
    store,
    writes,
    collection: (colName: string) => ({
      doc: (docId: string) => {
        const key = `${colName}/${docId}`
        return {
          id: docId,
          get: vi.fn().mockResolvedValue({
            exists: store.has(key),
            data: () => store.get(key),
          }),
          set: vi.fn().mockImplementation(async (data: Record<string, unknown>, opts?: { merge?: boolean }) => {
            if (opts?.merge) {
              store.set(key, { ...(store.get(key) ?? {}), ...data })
            } else {
              store.set(key, data)
            }
            writes.push(`set:${key}`)
          }),
          collection: (subCol: string) => ({
            doc: (subDocId: string) => {
              const subKey = `${colName}/${docId}/${subCol}/${subDocId}`
              return {
                id: subDocId,
                get: vi.fn().mockResolvedValue({
                  exists: store.has(subKey),
                  data: () => store.get(subKey),
                }),
                set: vi.fn().mockImplementation(async (data: Record<string, unknown>) => {
                  store.set(subKey, data)
                  writes.push(`set:${subKey}`)
                }),
                create: vi.fn().mockImplementation(async (data: Record<string, unknown>) => {
                  if (store.has(subKey)) throw Object.assign(new Error('exists'), { code: 'already-exists' })
                  store.set(subKey, data)
                  writes.push(`create:${subKey}`)
                }),
              }
            },
            get: vi.fn().mockResolvedValue({
              docs: [...store.entries()]
                .filter(([k]) => k.startsWith(`${colName}/${docId}/${subCol}/`))
                .map(([k, v]) => ({ id: k.split('/').pop(), data: () => v })),
            }),
          }),
        }
      },
    }),
  }
}

describe('B.2 — importCsv callable', () => {
  let db: ReturnType<typeof makeFirestoreMock>

  beforeEach(() => {
    db = makeFirestoreMock()
    vi.resetModules()
  })

  it('B.2.1 import T212 fixture: 47 trades added, 0 skipped, 12 positions written', async () => {
    const { importCsv } = await import('../import.js')
    const result = await importCsv({ uid: 'userA', db, source: 'T212', csv: fixture('t212-sample.csv') })
    expect(result.tradesAdded).toBe(47)
    expect(result.tradesSkipped).toBe(0)
    expect(result.positionsWritten).toBe(12)
    expect(result.errors).toEqual([])
  })

  it('B.2.2 re-import same fixture is idempotent (0 trades added, 47 skipped)', async () => {
    const { importCsv } = await import('../import.js')
    const csv = fixture('t212-sample.csv')
    await importCsv({ uid: 'userA', db, source: 'T212', csv })
    const result2 = await importCsv({ uid: 'userA', db, source: 'T212', csv })
    expect(result2.tradesAdded).toBe(0)
    expect(result2.tradesSkipped).toBe(47)
  })

  it('B.2.3 import fixture + 1 new trade row → tradesAdded === 1', async () => {
    const { importCsv } = await import('../import.js')
    const csv = fixture('t212-sample.csv')
    await importCsv({ uid: 'userA', db, source: 'T212', csv })
    const extraRow = 'Market buy,2026-04-20 09:30:00,US0378331005,AAPL,Apple Inc.,1,160.00,USD,1,160.00,USD,160.00,USD,,,,T212-EXTRA,0,USD'
    const csvPlus1 = csv.trimEnd() + '\n' + extraRow
    const result = await importCsv({ uid: 'userA', db, source: 'T212', csv: csvPlus1 })
    expect(result.tradesAdded).toBe(1)
  })

  it('B.2.4 mutated existing trade (same ID, different price) is NOT updated (immutability)', async () => {
    const { importCsv } = await import('../import.js')
    const csv = fixture('t212-sample.csv')
    await importCsv({ uid: 'userA', db, source: 'T212', csv })
    // Mutate first trade by changing price but same ID T212-001
    const mutated = csv.replace('10,148.50,USD,1,1485.00,USD,1485.00,USD,,,,T212-001', '10,999.00,USD,1,9990.00,USD,9990.00,USD,,,,T212-001')
    const result2 = await importCsv({ uid: 'userA', db, source: 'T212', csv: mutated })
    expect(result2.tradesSkipped).toBeGreaterThanOrEqual(1)
    // Verify the original price is intact
    const tradeKey = 'users/userA/trades/T212-001'
    const storedTrade = db.store.get(tradeKey)
    expect((storedTrade?.price as { amount: number })?.amount).toBe(148.50)
  })

  it('B.2.5 unauthenticated call throws HttpsError unauthenticated', async () => {
    const { importCsv } = await import('../import.js')
    await expect(
      importCsv({ uid: null as unknown as string, db, source: 'T212', csv: fixture('t212-sample.csv') })
    ).rejects.toMatchObject({ code: 'unauthenticated' })
  })

  it('B.2.6 import as userA, data not visible to userB (cross-user isolation)', async () => {
    const { importCsv } = await import('../import.js')
    await importCsv({ uid: 'userA', db, source: 'T212', csv: fixture('t212-sample.csv') })
    // userB queries should return zero trades (separate uid path)
    const userBTrades = [...db.store.keys()].filter((k) => k.startsWith('users/userB/trades/'))
    expect(userBTrades.length).toBe(0)
  })

  it('B.2.7 source T212 but body is IB CSV → parser error, no Firestore write', async () => {
    const { importCsv } = await import('../import.js')
    const initialWriteCount = db.writes.length
    const result = await importCsv({ uid: 'userA', db, source: 'T212', csv: fixture('ib-sample.csv') })
    expect(result.tradesAdded).toBe(0)
    expect(result.errors[0].kind).toBe('bad_headers')
    // No trades written
    expect(db.writes.length).toBe(initialWriteCount)
  })

  it('B.2.8 partial-bad fixture: 45 good rows written + 2 errors', async () => {
    const { importCsv } = await import('../import.js')
    const result = await importCsv({ uid: 'userA', db, source: 'T212', csv: fixture('t212-partial-bad.csv') })
    expect(result.tradesAdded).toBe(45)
    expect(result.errors.length).toBe(2)
  })

  it('B.2.9 unknown source throws HttpsError invalid-argument', async () => {
    const { importCsv } = await import('../import.js')
    await expect(
      importCsv({ uid: 'userA', db, source: 'UNKNOWN' as 'T212', csv: fixture('t212-sample.csv') })
    ).rejects.toMatchObject({ code: 'invalid-argument' })
  })

  it('B.2.10 import overwrites T212 cash but leaves IB cash intact', async () => {
    const { importCsv } = await import('../import.js')
    // Pre-seed IB cash
    db.store.set('users/userA/cash/IB', { broker: 'IB', currency: 'USD', amount: 5000 })
    await importCsv({ uid: 'userA', db, source: 'T212', csv: fixture('t212-sample.csv') })
    // IB cash should be unchanged
    const ibCash = db.store.get('users/userA/cash/IB')
    expect(ibCash?.amount).toBe(5000)
  })

  it('B.2.12 IB import with EUR account writes cash.currency = EUR not USD', async () => {
    const { importCsv } = await import('../import.js')
    const result = await importCsv({ uid: 'userA', db, source: 'IB', csv: fixture('ib-eur-account.csv') })
    expect(result.errors).toEqual([])
    const ibCash = db.store.get('users/userA/cash/IB')
    // Must write 'EUR' derived from Cash Report section, not hardcoded 'USD'
    expect(ibCash?.currency).toBe('EUR')
  })

  it('B.2.11 positions are overwritten not merged on re-import', async () => {
    const { importCsv } = await import('../import.js')
    // First import
    await importCsv({ uid: 'userA', db, source: 'T212', csv: fixture('t212-sample.csv') })
    // Mutate AAPL position in store (simulates stale data)
    db.store.set('users/userA/positions/AAPL', { ticker: 'AAPL', quantity: 999, broker: 'T212', avgCost: { amount: 99.00, currency: 'USD' }, currency: 'USD' })
    // Re-import same CSV
    await importCsv({ uid: 'userA', db, source: 'T212', csv: fixture('t212-sample.csv') })
    // Position should be overwritten to the CSV-derived value, not 999
    const aapl = db.store.get('users/userA/positions/AAPL')
    expect(aapl?.quantity).not.toBe(999)
  })
})
