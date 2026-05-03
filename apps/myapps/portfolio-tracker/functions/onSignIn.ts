import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { beforeUserSignedIn, type AuthBlockingEvent } from 'firebase-functions/v2/identity'
import { checkAllowlist } from './checkAllowlist.js'

if (!getApps().length) {
  initializeApp()
}

export const onSignIn = beforeUserSignedIn(async (event: AuthBlockingEvent) => {
  const email = event.data.email
  const db = getFirestore()
  await checkAllowlist(email, db)
})
