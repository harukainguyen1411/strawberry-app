/**
 * B.2.x xfail — id: undefined Firestore set() regression (Refs V0.8)
 *
 * Senna review finding: import.ts line 74-78 does:
 *   await tradeRef.set({ ...trade, id: undefined, ... })
 *
 * firebase-admin Firestore throws on undefined field values unless
 * ignoreUndefinedProperties is set on init (it is not set in this repo).
 * The lenient in-memory mock hides this — prod/staging throws.
 *
 * This test uses a strict mock that propagates the real Firestore
 * behavior. It is committed as it.fails() before the fix.
 * The fix commit (destructuring id out before spread) flips it to it().
 *
 * Fix: const { id: _, ...tradeData } = trade; await tradeRef.set(tradeData)
 */

import { describe, it, expect, vi } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURES = path.resolve(__dirname, '../../test/fixtures')

function fixture(name: string) {
  return fs.readFileSync(path.join(FIXTURES, name), 'utf8')
}

/**
 * Strict Firestore mock: rejects set() when any field value is undefined,
 * matching firebase-admin default behavior (no ignoreUndefinedProperties).
 */
function makeStrictFirestoreMock() {
  const store: Map<string, Record<string, unknown>> = new Map()

  function assertNoUndefined(data: Record<string, unknown>, docPath: string) {
    for (const [field, value] of Object.entries(data)) {
      if (value === undefined) {
        throw new Error(
          `Value for argument "data" is not a valid Firestore document. ` +
          `Cannot use "undefined" as a Firestore value (field: ${field}, doc: ${docPath})`
        )
      }
    }
  }

  return {
    store,
    collection: (colName: string) => ({
      doc: (docId: string) => {
        const key = `${colName}/${docId}`
        return {
          id: docId,
          get: vi.fn().mockResolvedValue({ exists: store.has(key), data: () => store.get(key) }),
          set: vi.fn().mockImplementation(async (data: Record<string, unknown>) => {
            assertNoUndefined(data, key)
            store.set(key, data)
          }),
          collection: (subCol: string) => ({
            doc: (subDocId: string) => {
              const subKey = `${colName}/${docId}/${subCol}/${subDocId}`
              return {
                id: subDocId,
                get: vi.fn().mockResolvedValue({ exists: store.has(subKey), data: () => store.get(subKey) }),
                set: vi.fn().mockImplementation(async (data: Record<string, unknown>) => {
                  assertNoUndefined(data, subKey)
                  store.set(subKey, data)
                }),
              }
            },
          }),
        }
      },
    }),
  }
}

describe('B.2.x — id: undefined Firestore regression', () => {
  it(
    'B.2.x strict-mock: set() with id: undefined throws (prod behavior), importCsv must not pass undefined fields',
    async () => {
      vi.resetModules()
      const { importCsv } = await import('../import.js')
      const db = makeStrictFirestoreMock()
      // Should complete without throwing — currently throws because id: undefined is spread
      await expect(
        importCsv({ uid: 'userA', db, source: 'T212', csv: fixture('t212-sample.csv') })
      ).resolves.toMatchObject({ tradesAdded: 47 })
    }
  )
})
