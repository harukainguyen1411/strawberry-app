import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { beforeUserSignedIn, type AuthBlockingEvent } from 'firebase-functions/v2/identity'
import { checkAllowlist, type AllowlistDb } from './checkAllowlist.js'

// Subpath imports are required: the functions package is ESM ("type":"module")
// and firebase-admin v12's top-level CJS namespace doesn't bind cleanly through
// `import * as admin` — `admin.apps` resolves to undefined at runtime under
// Node 20 ESM, crashing the emulator load with "Cannot read properties of
// undefined (reading 'length')".
if (!getApps().length) {
  initializeApp()
}

export const onSignIn = beforeUserSignedIn(async (event: AuthBlockingEvent) => {
  const email = event.data.email
  const db = getFirestore()
  await checkAllowlist(email, db as unknown as AllowlistDb)
})
