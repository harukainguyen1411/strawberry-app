import * as admin from 'firebase-admin'
import { beforeUserSignedIn, type AuthBlockingEvent } from 'firebase-functions/v2/identity'
import { checkAllowlist } from './checkAllowlist.js'

if (!admin.apps.length) {
  admin.initializeApp()
}

export const onSignIn = beforeUserSignedIn(async (event: AuthBlockingEvent) => {
  const email = event.data.email
  const db = admin.firestore()
  await checkAllowlist(email, db)
})
