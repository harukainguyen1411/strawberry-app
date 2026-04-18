/**
 * B.2 emulator — importCsv emulator-backed integration tests (Refs V0.8 blocker 2)
 *
 * xfail commit: all tests marked test.failing() — they are expected to fail
 * because the current B.2 test suite uses an in-memory mock, not the emulator.
 * Implementation commit flips them to test().
 *
 * Covers the subset of B.2 that requires real Security Rules enforcement:
 *   B.2.6-emu: import as userA, read as userB → permission denied (rules-enforced)
 *   B.2.emu-idempotency: import same CSV twice → 0 added on second call
 *   B.2.emu-auth: null uid → unauthenticated error
 *
 * Run: firebase emulators:exec --only firestore \
 *   "npx jest test/emulator/importCsv.emulator.test.ts"
 *
 * Requires: @firebase/rules-unit-testing, jest, ts-jest (see test/package.json)
 */

import {
  initializeTestEnvironment,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import * as fs from 'fs'
import * as path from 'path'

const RULES_PATH = path.resolve(__dirname, '../../firestore.rules')
const FIXTURES = path.resolve(__dirname, '../fixtures')

function fixture(name: string): string {
  return fs.readFileSync(path.join(FIXTURES, name), 'utf8')
}

let testEnv: RulesTestEnvironment

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'portfolio-tracker-test',
    firestore: {
      rules: fs.readFileSync(RULES_PATH, 'utf8'),
      host: 'localhost',
      port: 8080,
    },
  })
})

afterAll(async () => {
  await testEnv.cleanup()
})

beforeEach(async () => {
  await testEnv.clearFirestore()
})

// Helper: get Admin Firestore pointing to emulator (bypasses security rules)
async function adminDb() {
  let db: FirebaseFirestore.Firestore | null = null
  await testEnv.withSecurityRulesDisabled((ctx) => {
    // @firebase/rules-unit-testing v3 exposes admin firestore via ctx.firestore()
    db = ctx.firestore() as unknown as FirebaseFirestore.Firestore
    return Promise.resolve()
  })
  return db!
}

// xfail: emulator-based B.2.6 — Security Rules enforce cross-user isolation
// Will fail until emulator wiring is complete (currently in-memory mock only)
test.failing('B.2.6-emu import as userA, read as userB → permission denied (emulator)', async () => {
  const { importCsv } = await require('../../functions/import.js')
  const db = await adminDb()

  // Import as userA (admin context bypasses rules for the import itself — mimics Cloud Function Admin SDK)
  await importCsv({ uid: 'userA', db, source: 'T212', csv: fixture('t212-sample.csv') })

  // userB tries to read userA's trades — must be denied by Security Rules
  const userBCtx = testEnv.authenticatedContext('userB')
  const tradeRef = userBCtx.firestore()
    .collection('users').doc('userA').collection('trades').doc('T212-001')
  await assertFails(tradeRef.get())
})

// xfail: emulator idempotency check via real Firestore
test.failing('B.2.emu-idempotency re-import same CSV returns 0 tradesAdded (emulator)', async () => {
  const { importCsv } = await require('../../functions/import.js')
  const db = await adminDb()

  const csv = fixture('t212-sample.csv')
  const first = await importCsv({ uid: 'userA', db, source: 'T212', csv })
  expect(first.tradesAdded).toBe(47)

  const second = await importCsv({ uid: 'userA', db, source: 'T212', csv })
  expect(second.tradesAdded).toBe(0)
  expect(second.tradesSkipped).toBe(47)
})

// xfail: emulator auth check
test.failing('B.2.emu-auth null uid throws unauthenticated (emulator)', async () => {
  const { importCsv } = await require('../../functions/import.js')
  const db = await adminDb()

  await expect(
    importCsv({ uid: null, db, source: 'T212', csv: fixture('t212-sample.csv') })
  ).rejects.toMatchObject({ code: 'unauthenticated' })
})
