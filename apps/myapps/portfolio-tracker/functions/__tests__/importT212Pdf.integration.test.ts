/**
 * importT212Pdf integration tests — V0.1.0 xfail-first then impl.
 *
 * Tests the importT212Pdf handler (functions/importT212Pdf.ts) against
 * the anonymized T212 Activity Statement PDF fixture.
 *
 * Uses an in-memory Firestore mock matching the shape in importCsv.integration.test.ts.
 *
 * Refs V0.1.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURES = path.resolve(__dirname, '../../test/fixtures')

function fixture(name: string): Buffer {
  return fs.readFileSync(path.join(FIXTURES, name))
}

/** Extended in-memory Firestore mock that supports batch writes and merge */
function makeFirestoreMock() {
  const store: Map<string, Record<string, unknown>> = new Map()
  const writes: string[] = []

  const docRef = (key: string) => ({
    _key: key,
    id: key.split('/').pop()!,
    get: vi.fn().mockImplementation(async () => ({
      exists: store.has(key),
      data: () => store.get(key),
    })),
    set: vi.fn().mockImplementation(async (data: Record<string, unknown>, opts?: { merge?: boolean }) => {
      if (opts?.merge) {
        store.set(key, { ...(store.get(key) ?? {}), ...data })
      } else {
        store.set(key, data)
      }
      writes.push(`set:${key}`)
    }),
    delete: vi.fn().mockImplementation(async () => {
      store.delete(key)
      writes.push(`delete:${key}`)
    }),
  })

  const buildCollection = (prefix: string) => ({
    doc: (id: string) => {
      const key = `${prefix}/${id}`
      return {
        ...docRef(key),
        collection: (subCol: string) => buildCollection(`${key}/${subCol}`),
      }
    },
    get: vi.fn().mockImplementation(async () => ({
      docs: [...store.entries()]
        .filter(([k]) => k.startsWith(prefix + '/') && k.split('/').length === prefix.split('/').length + 1)
        .map(([k, v]) => {
          const ref = { ...docRef(k), collection: (subCol: string) => buildCollection(`${k}/${subCol}`) }
          return { id: k.split('/').pop(), data: () => v, ref }
        }),
    })),
  })

  const batch = () => {
    const ops: Array<() => void> = []
    return {
      set: (ref: { _key: string }, data: Record<string, unknown>) => {
        ops.push(() => {
          store.set(ref._key, data)
          writes.push(`batch-set:${ref._key}`)
        })
        return undefined
      },
      delete: (ref: { _key: string }) => {
        ops.push(() => {
          store.delete(ref._key)
          writes.push(`batch-delete:${ref._key}`)
        })
        return undefined
      },
      commit: vi.fn().mockImplementation(async () => {
        for (const op of ops) op()
      }),
    }
  }

  return {
    store,
    writes,
    batch,
    collection: (col: string) => buildCollection(col),
  }
}

describe('V0.1.0 — importT212Pdf callable integration', () => {
  let db: ReturnType<typeof makeFirestoreMock>

  beforeEach(() => {
    db = makeFirestoreMock()
    vi.resetModules()
  })

  it('PDF-INT-01 import T212 PDF fixture: 13 positions written, cash set, fxRates seeded', async () => {
    const { importT212Pdf } = await import('../importT212Pdf.js')
    const buf = fixture('t212-statement.pdf')
    const result = await importT212Pdf({ uid: 'userA', db, pdfBuffer: buf })
    expect(result.positionsWritten).toBe(13)
    expect(result.errors).toEqual([])
    // Cash should be written
    const cash = db.store.get('users/userA/cash/T212')
    expect(cash?.amount).toBeCloseTo(4082.95, 1)
    expect(cash?.currency).toBe('EUR')
    // FX rates should be merged
    const fx = db.store.get('users/userA/meta/fx')
    expect((fx?.rates as Record<string, number>)?.['USD->EUR']).toBeDefined()
  })

  it('PDF-INT-02 positions are full-replaced (old position removed)', async () => {
    const { importT212Pdf } = await import('../importT212Pdf.js')
    // Pre-seed a stale position that won't be in the PDF
    db.store.set('users/userA/positions/STALE', { ticker: 'STALE', broker: 'T212', quantity: 10 })
    const buf = fixture('t212-statement.pdf')
    await importT212Pdf({ uid: 'userA', db, pdfBuffer: buf })
    // STALE should be gone (full replace)
    const stale = db.store.get('users/userA/positions/STALE')
    expect(stale).toBeUndefined()
  })

  it('PDF-INT-03 fxRates merged (not overwritten) — preserves existing pairs', async () => {
    const { importT212Pdf } = await import('../importT212Pdf.js')
    // Pre-seed a custom FX rate
    db.store.set('users/userA/meta/fx', { rates: { 'GBP->EUR': 0.85 } })
    const buf = fixture('t212-statement.pdf')
    await importT212Pdf({ uid: 'userA', db, pdfBuffer: buf })
    const fx = db.store.get('users/userA/meta/fx')
    const rates = fx?.rates as Record<string, number>
    // Custom rate should be preserved
    expect(rates?.['GBP->EUR']).toBe(0.85)
    // PDF rate should be added
    expect(rates?.['USD->EUR']).toBeDefined()
  })

  it('PDF-INT-04 unauthenticated call throws with code unauthenticated', async () => {
    const { importT212Pdf } = await import('../importT212Pdf.js')
    const buf = fixture('t212-statement.pdf')
    await expect(
      importT212Pdf({ uid: null as unknown as string, db, pdfBuffer: buf })
    ).rejects.toMatchObject({ code: 'unauthenticated' })
  })

  it('PDF-INT-05 non-PDF buffer returns error in result', async () => {
    const { importT212Pdf } = await import('../importT212Pdf.js')
    const notPdf = Buffer.from('Action,Time\n1,2\n')
    const result = await importT212Pdf({ uid: 'userA', db, pdfBuffer: notPdf })
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors[0].kind).toBe('not_pdf')
    // No Firestore writes on parse error
    expect(db.writes.length).toBe(0)
  })

  it('PDF-INT-06 IB cash unaffected by T212 PDF import', async () => {
    const { importT212Pdf } = await import('../importT212Pdf.js')
    db.store.set('users/userA/cash/IB', { broker: 'IB', currency: 'USD', amount: 5000 })
    const buf = fixture('t212-statement.pdf')
    await importT212Pdf({ uid: 'userA', db, pdfBuffer: buf })
    // IB cash should be unchanged
    const ibCash = db.store.get('users/userA/cash/IB')
    expect(ibCash?.amount).toBe(5000)
  })
})
