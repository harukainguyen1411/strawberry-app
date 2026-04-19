/**
 * Regression test for Senna review finding on PR #34:
 * portfolio_get_snapshot sets position `id` to `d.data()` (the full data object)
 * instead of `d.id` (the Firestore document ID string).
 *
 * Ref: Senna review findings on #34
 * xfail commit: precedes the fix per Rule 12.
 */

import { describe, it, expect } from 'vitest'
import { portfolio_get_snapshot } from '../index.js'

/** Minimal Firestore QueryDocumentSnapshot stub. */
function makeDocStub(id: string, data: Record<string, unknown>) {
  return { id, data: () => data }
}

function makeCtx(positionDocs: ReturnType<typeof makeDocStub>[]) {
  return {
    uid: 'test-uid',
    db: {
      collection: () => ({
        doc: () => ({
          collection: (name: string) => ({
            get: async () => ({
              docs: name === 'positions' ? positionDocs : [],
            }),
          }),
        }),
      }),
    },
  }
}

describe('Regression — portfolio_get_snapshot position id shape (PR #34)', () => {
  it(
    'A.7.1 each position.id is a string (Firestore doc ID), not an object',
    async () => {
      const docs = [
        makeDocStub('pos-abc', { ticker: 'AAPL', qty: 10 }),
        makeDocStub('pos-xyz', { ticker: 'TSLA', qty: 5 }),
      ]
      const ctx = makeCtx(docs)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await portfolio_get_snapshot(ctx as any)
      for (const pos of result.positions) {
        expect(typeof pos.id).toBe('string')
        expect(pos.id).not.toBeTypeOf('object')
      }
    }
  )
})
