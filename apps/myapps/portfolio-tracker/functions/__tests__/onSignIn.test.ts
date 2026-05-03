import { describe, it, vi, expect, beforeEach } from 'vitest'
import { checkAllowlist } from '../checkAllowlist.js'

// A.1 — onSignIn allowlist guard tests (Refs V0.2)

describe('A.1 — onSignIn allowlist guard', () => {
  const allowlistedEmail = 'harukainguyen1411@gmail.com'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('A.1.1 allowlisted email resolves without throwing', async () => {
    const mockDb = makeMockDb([allowlistedEmail])
    await expect(checkAllowlist(allowlistedEmail, mockDb)).resolves.toBeUndefined()
  })

  it('A.1.2 plus-alias of allowlisted email is denied (exact match only)', async () => {
    const mockDb = makeMockDb([allowlistedEmail])
    await expect(checkAllowlist('harukainguyen1411+alias@gmail.com', mockDb)).rejects.toMatchObject({
      code: 'permission-denied',
    })
  })

  it('A.1.3 unknown email throws HttpsError permission-denied', async () => {
    const mockDb = makeMockDb([allowlistedEmail])
    await expect(checkAllowlist('stranger@example.test', mockDb)).rejects.toMatchObject({
      code: 'permission-denied',
    })
  })

  it('A.1.4 uppercase email matches case-insensitively', async () => {
    const mockDb = makeMockDb([allowlistedEmail])
    await expect(checkAllowlist('HARUKAINGUYEN1411@GMAIL.COM', mockDb)).resolves.toBeUndefined()
  })

  it('A.1.5 undefined email throws HttpsError invalid-argument', async () => {
    const mockDb = makeMockDb([allowlistedEmail])
    await expect(checkAllowlist(undefined, mockDb)).rejects.toMatchObject({
      code: 'invalid-argument',
    })
  })

  it('A.1.6 empty allowlist throws HttpsError failed-precondition (fail closed)', async () => {
    const mockDb = makeMockDb([])
    await expect(checkAllowlist(allowlistedEmail, mockDb)).rejects.toMatchObject({
      code: 'failed-precondition',
    })
  })
})

// A.1.7–A.1.8 — onSignIn handler-level tests (trigger type + per-invocation allowlist check)
// Refs: Jhin blocker findings on PR #32.

describe('A.1 — onSignIn handler trigger and per-invocation guard', () => {
  const allowlistedEmail = 'harukainguyen1411@gmail.com'

  // Mock firebase-admin subpath modules before importing onSignIn so
  // initializeApp() and getFirestore() don't require a live Firebase project.
  // Subpath imports (firebase-admin/app + firebase-admin/firestore) are required
  // at runtime under ESM — see onSignIn.ts for the reason — so the mock must
  // intercept those subpaths, not the top-level 'firebase-admin' module.
  const mockGet = vi.fn()
  const firestoreStub = {
    collection: vi.fn().mockReturnValue({
      doc: vi.fn().mockReturnValue({ get: mockGet }),
    }),
  }

  beforeEach(() => {
    mockGet.mockReset()
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ emails: [allowlistedEmail] }),
    })

    vi.doMock('firebase-admin/app', () => ({
      getApps: vi.fn().mockReturnValue(['stub']), // non-empty → skip initializeApp()
      initializeApp: vi.fn(),
    }))
    vi.doMock('firebase-admin/firestore', () => ({
      getFirestore: vi.fn().mockReturnValue(firestoreStub),
    }))
  })

  // A.1.7 — trigger type must be beforeSignIn (fires on every sign-in), not beforeCreate
  // (fires only at account creation). Pre-existing Firebase Auth UIDs must not bypass the
  // allowlist on subsequent sign-ins.
  it('A.1.7 onSignIn blocking trigger eventType is beforeSignIn not beforeCreate', async () => {
    vi.resetModules()
    const { onSignIn } = await import('../onSignIn.js')
    const endpoint = (onSignIn as any).__endpoint
    expect(endpoint.blockingTrigger.eventType).toMatch(/beforeSignIn/)
  })

  // A.1.8 — allowlist is consulted (Firestore get() called) on every handler invocation.
  // This is a regression guard: if a future cache implementation incorrectly skips the
  // allowlist on second call, this test will catch it.
  it('A.1.8 allowlist Firestore read occurs on every onSignIn invocation', async () => {
    vi.resetModules()
    const { onSignIn } = await import('../onSignIn.js')
    const event = makeAuthBlockingEvent(allowlistedEmail)

    await (onSignIn as any).run(event)
    await (onSignIn as any).run(event)

    expect(mockGet).toHaveBeenCalledTimes(2)
  })
})

function makeMockDb(emails: string[]) {
  return {
    collection: vi.fn().mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({
          exists: emails !== null,
          data: () => ({ emails }),
        }),
      }),
    }),
  }
}

function makeAuthBlockingEvent(email: string) {
  return {
    data: { email },
  }
}
