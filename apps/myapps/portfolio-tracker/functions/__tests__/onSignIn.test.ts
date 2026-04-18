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
