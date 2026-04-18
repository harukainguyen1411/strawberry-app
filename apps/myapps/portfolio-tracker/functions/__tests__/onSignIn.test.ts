import { describe, it, vi, expect, beforeEach } from 'vitest'

// xfail: allowlist guard tests for onSignIn beforeSignIn blocking trigger.
// Flipped to passing in the V0.2 implementation commit.

// Mock firebase-admin so tests run without a real Firebase project
vi.mock('firebase-admin/firestore', () => ({
  getFirestore: vi.fn(),
}))
vi.mock('firebase-admin/app', () => ({
  initializeApp: vi.fn(),
  getApps: vi.fn(() => []),
}))

// Import the function under test after mocks are set up
// The actual module path is resolved once the file is created in impl commit
let checkAllowlist: (email: string | undefined, db: unknown) => Promise<void>

describe('A.1 — onSignIn allowlist guard (Refs V0.2)', () => {
  const allowlistedEmail = 'harukainguyen1411@gmail.com'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.fails('A.1.1 allowlisted email resolves without throwing', async () => {
    const { checkAllowlist: fn } = await import('../checkAllowlist.js')
    const mockDb = makeMockDb([allowlistedEmail])
    await expect(fn(allowlistedEmail, mockDb)).resolves.toBeUndefined()
  })

  it.fails('A.1.2 plus-alias of allowlisted email is denied (exact match only)', async () => {
    const { checkAllowlist: fn } = await import('../checkAllowlist.js')
    const mockDb = makeMockDb([allowlistedEmail])
    await expect(fn('harukainguyen1411+alias@gmail.com', mockDb)).rejects.toMatchObject({
      code: 'permission-denied',
    })
  })

  it.fails('A.1.3 unknown email throws HttpsError permission-denied', async () => {
    const { checkAllowlist: fn } = await import('../checkAllowlist.js')
    const mockDb = makeMockDb([allowlistedEmail])
    await expect(fn('stranger@example.test', mockDb)).rejects.toMatchObject({
      code: 'permission-denied',
    })
  })

  it.fails('A.1.4 uppercase email matches case-insensitively', async () => {
    const { checkAllowlist: fn } = await import('../checkAllowlist.js')
    const mockDb = makeMockDb([allowlistedEmail])
    await expect(fn('HARUKAINGUYEN1411@GMAIL.COM', mockDb)).resolves.toBeUndefined()
  })

  it.fails('A.1.5 undefined email throws HttpsError invalid-argument', async () => {
    const { checkAllowlist: fn } = await import('../checkAllowlist.js')
    const mockDb = makeMockDb([allowlistedEmail])
    await expect(fn(undefined, mockDb)).rejects.toMatchObject({
      code: 'invalid-argument',
    })
  })

  it.fails('A.1.6 empty allowlist throws HttpsError failed-precondition (fail closed)', async () => {
    const { checkAllowlist: fn } = await import('../checkAllowlist.js')
    const mockDb = makeMockDb([])
    await expect(fn(allowlistedEmail, mockDb)).rejects.toMatchObject({
      code: 'failed-precondition',
    })
  })
})

function makeMockDb(emails: string[]) {
  return {
    collection: vi.fn().mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({ emails }),
        }),
      }),
    }),
  }
}
