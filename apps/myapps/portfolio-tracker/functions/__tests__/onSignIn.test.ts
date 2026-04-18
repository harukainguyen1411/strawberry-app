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
// A.1.7 is marked it.fails because onSignIn currently uses beforeUserCreated (fires only at
// account creation). The fix is to switch to beforeUserSignedIn (fires on every sign-in).
// Refs: Jhin blocker findings on PR #32.

describe('A.1 — onSignIn handler trigger and per-invocation guard', () => {
  const allowlistedEmail = 'harukainguyen1411@gmail.com'

  // Mock firebase-admin before importing onSignIn so admin.initializeApp() and
  // admin.firestore() don't require a live Firebase project.
  const mockGet = vi.fn()

  beforeEach(() => {
    mockGet.mockReset()
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ emails: [allowlistedEmail] }),
    })

    vi.doMock('firebase-admin', () => ({
      default: {
        apps: ['stub'], // non-empty so initializeApp() is skipped
        initializeApp: vi.fn(),
        firestore: vi.fn().mockReturnValue({
          collection: vi.fn().mockReturnValue({
            doc: vi.fn().mockReturnValue({ get: mockGet }),
          }),
        }),
      },
      apps: ['stub'],
      initializeApp: vi.fn(),
      firestore: vi.fn().mockReturnValue({
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockReturnValue({ get: mockGet }),
        }),
      }),
    }))
  })

  // A.1.7 — trigger type must be beforeSignIn (fires on every sign-in), not beforeCreate
  // (fires only at account creation). Pre-existing Firebase Auth UIDs must not bypass the
  // allowlist on subsequent sign-ins.
  // xfail: current impl uses beforeUserCreated → eventType is "user.beforeCreate".
  // After fix (beforeUserSignedIn) → eventType becomes "user.beforeSignIn".
  it.fails('A.1.7 onSignIn blocking trigger eventType is beforeSignIn not beforeCreate', async () => {
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
