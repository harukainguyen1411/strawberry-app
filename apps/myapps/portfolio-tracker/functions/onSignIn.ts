import * as admin from 'firebase-admin'
import { beforeUserCreated, type AuthBlockingEvent } from 'firebase-functions/v2/identity'
import { checkAllowlist } from './checkAllowlist.js'

if (!admin.apps.length) {
  admin.initializeApp()
}

// Cached per cold start — reduces Firestore reads on repeated sign-ins.
let cachedEmails: string[] | null = null

export const onSignIn = beforeUserCreated(async (event: AuthBlockingEvent) => {
  const email = event.data.email
  const db = admin.firestore()

  if (cachedEmails === null) {
    await checkAllowlist(email, db)
  } else {
    // Use cached allowlist; still fail on undefined email
    if (email === undefined || email === null || email === '') {
      const { HttpsError } = await import('firebase-functions/v2/https')
      throw new HttpsError('invalid-argument', 'email is required')
    }
    const normalised = email.toLowerCase()
    const allowed = cachedEmails.some((e) => e.toLowerCase() === normalised)
    if (!allowed) {
      const { HttpsError } = await import('firebase-functions/v2/https')
      throw new HttpsError('permission-denied', `${email} is not on the allowlist`)
    }
  }
})
