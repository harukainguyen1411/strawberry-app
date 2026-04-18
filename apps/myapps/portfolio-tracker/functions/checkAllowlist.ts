import { HttpsError } from 'firebase-functions/v2/https'

export interface AllowlistDb {
  collection(name: string): {
    doc(id: string): {
      get(): Promise<{ exists: boolean; data(): { emails: string[] } | undefined }>
    }
  }
}

/**
 * Checks that `email` is in the runtime-configurable allowlist stored at
 * Firestore doc `config/auth_allowlist` (field `emails: string[]`).
 *
 * Throws HttpsError on any rejection so callers and beforeSignIn triggers
 * can use this directly.
 */
export async function checkAllowlist(email: string | undefined, db: AllowlistDb): Promise<void> {
  if (email === undefined || email === null || email === '') {
    throw new HttpsError('invalid-argument', 'email is required')
  }

  const snap = await db.collection('config').doc('auth_allowlist').get()

  if (!snap.exists) {
    // Fail closed — a missing allowlist doc is a misconfiguration, not an open door.
    throw new HttpsError('failed-precondition', 'auth_allowlist config doc is missing')
  }

  const data = snap.data()
  const emails: string[] = data?.emails ?? []

  if (emails.length === 0) {
    throw new HttpsError('failed-precondition', 'auth_allowlist is empty — fail closed')
  }

  const normalised = email.toLowerCase()
  const allowed = emails.some((e) => e.toLowerCase() === normalised)

  if (!allowed) {
    throw new HttpsError('permission-denied', `${email} is not on the allowlist`)
  }
}
