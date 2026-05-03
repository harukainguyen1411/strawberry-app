#!/usr/bin/env node
// Seed config/auth_allowlist in the Firestore emulator with one or more emails.
// Used by `npm run dev:e2e` so the V0 sign-in flow accepts your test email
// without needing the production allowlist.
//
// Usage:
//   node e2e/seed-allowlist.mjs                       # defaults to duong@allowed.test
//   node e2e/seed-allowlist.mjs you@example.com a@b.c # one or more emails
//
// Refs V0.18

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'portfolio-tracker-e2e'
const FIRESTORE_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080'

const emails = process.argv.slice(2)
if (emails.length === 0) emails.push('duong@allowed.test')

const url = `http://${FIRESTORE_HOST}/v1/projects/${PROJECT_ID}/databases/(default)/documents/config/auth_allowlist`
const body = {
  fields: {
    emails: {
      arrayValue: {
        values: emails.map((stringValue) => ({ stringValue })),
      },
    },
  },
}

const res = await fetch(url, {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    Authorization: 'Bearer owner', // emulator admin bypass — skips security rules
  },
  body: JSON.stringify(body),
})

if (!res.ok) {
  const text = await res.text()
  console.error(`[seed-allowlist] HTTP ${res.status}: ${text}`)
  process.exit(1)
}
console.log(`[seed-allowlist] Seeded ${emails.length} email(s): ${emails.join(', ')}`)
