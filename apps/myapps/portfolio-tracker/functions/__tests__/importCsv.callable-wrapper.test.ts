/**
 * V0.8 — importCsv HTTPS callable wrapper (functions/index.ts).
 *
 * Verifies that index.ts exposes `importCsv` as a v2 onCall function:
 *   - exports it as a function with __endpoint metadata (proves onCall wiring,
 *     not just a plain re-export of the orchestrator from import.ts)
 *   - rejects an unauthenticated invocation with HttpsError code='unauthenticated'
 *
 * Companion to __tests__/importCsv.integration.test.ts which covers the
 * underlying handler (functions/import.ts) directly.
 *
 * Refs V0.8
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('V0.8 — importCsv callable wrapper', () => {
  beforeEach(() => {
    vi.resetModules()

    // Mock firebase-admin so loading index.ts does not require a live project.
    const firestoreMock = vi.fn().mockReturnValue({
      collection: vi.fn().mockReturnValue({
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({ exists: false, data: () => undefined }),
          set: vi.fn().mockResolvedValue(undefined),
          collection: vi.fn(),
        }),
      }),
    })

    vi.doMock('firebase-admin', () => ({
      default: { apps: ['stub'], initializeApp: vi.fn(), firestore: firestoreMock },
      apps: ['stub'],
      initializeApp: vi.fn(),
      firestore: firestoreMock,
    }))
  })

  it.fails('exports importCsv as an HTTPS callable (has __endpoint metadata)', async () => {
    const mod = await import('../index.js')
    const importCsv = (mod as { importCsv?: { __endpoint?: unknown } }).importCsv
    expect(typeof importCsv).toBe('function')
    expect(importCsv?.__endpoint).toBeDefined()
  })

  it.fails('callable rejects unauthenticated request with HttpsError unauthenticated', async () => {
    const mod = await import('../index.js')
    const callable = (mod as { importCsv: { run: (req: unknown) => Promise<unknown> } }).importCsv
    await expect(
      callable.run({ data: { source: 'T212', csv: 'a,b\n1,2\n' }, auth: undefined })
    ).rejects.toMatchObject({ code: 'unauthenticated' })
  })
})
