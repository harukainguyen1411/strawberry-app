/**
 * B.2 emulator — importCsv emulator-backed Security Rules tests (Refs V0.8 blocker 2)
 *
 * Implementation commit: test.failing() → test() (all three now pass).
 *
 * These tests cover the Security Rules aspects of V0.8 imports using the
 * Firestore emulator with @firebase/rules-unit-testing. They complement
 * the vitest unit tests in functions/__tests__/importCsv.integration.test.ts,
 * which use an in-memory mock and cannot exercise rules enforcement.
 *
 * Coverage:
 *   B.2.6-emu: Trades written under users/userA are not readable by userB
 *              (Security Rules enforce cross-user isolation at path level)
 *   B.2.6-emu-cash: Cash docs written under users/userA not readable by userB
 *   B.2.6-emu-trade-immutable: userA cannot update (overwrite) own trade via
 *                               client SDK — trades are create-only (immutability)
 *
 * Scenario: data is seeded via withSecurityRulesDisabled (mimics Admin SDK writes
 * performed by importCsv in Cloud Function context). Client access is then tested
 * via authenticatedContext / unauthenticatedContext.
 *
 * Run: firebase emulators:exec --only firestore \
 *   "npx jest --config test/jest.config.ts test/emulator/importCsv.emulator.test.ts"
 *
 * Requires: @firebase/rules-unit-testing, jest, ts-jest (see test/package.json)
 */

import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import * as fs from 'fs'
import * as path from 'path'

const RULES_PATH = path.resolve(__dirname, '../../firestore.rules')

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

// Seed a representative import result for userA via admin (rules-bypassing) context.
// This mimics what importCsv writes when running as a Cloud Function (Admin SDK).
async function seedImportForUserA(): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    const userA = db.collection('users').doc('userA')

    // Trade
    await userA.collection('trades').doc('T212-001').set({
      broker: 'T212',
      ticker: 'AAPL',
      side: 'BUY',
      quantity: 10,
      price: { amount: 148.5, currency: 'USD' },
      currency: 'USD',
      executedAt: new Date('2026-04-01T09:30:00Z'),
    })

    // Position
    await userA.collection('positions').doc('AAPL').set({
      ticker: 'AAPL',
      broker: 'T212',
      quantity: 10,
      avgCost: { amount: 148.5, currency: 'USD' },
      currency: 'USD',
    })

    // Cash
    await userA.collection('cash').doc('T212').set({
      broker: 'T212',
      currency: 'USD',
      amount: 0,
      updatedAt: new Date(),
    })
  })
}

// B.2.6-emu: userB cannot read userA's trades (cross-user isolation)
test('B.2.6-emu userB cannot read userA trades (Security Rules)', async () => {
  await seedImportForUserA()

  const userBCtx = testEnv.authenticatedContext('userB')
  await assertFails(
    userBCtx.firestore()
      .collection('users').doc('userA').collection('trades').doc('T212-001')
      .get()
  )
})

// B.2.6-emu-cash: userB cannot read userA's cash docs
test('B.2.6-emu-cash userB cannot read userA cash docs (Security Rules)', async () => {
  await seedImportForUserA()

  const userBCtx = testEnv.authenticatedContext('userB')
  await assertFails(
    userBCtx.firestore()
      .collection('users').doc('userA').collection('cash').doc('T212')
      .get()
  )
})

// B.2.6-emu-trade-immutable: userA cannot update own trade via client SDK
// (trades are create-only per Security Rules — immutability invariant ADR §5)
test('B.2.6-emu-trade-immutable userA cannot update own trade (immutability)', async () => {
  await seedImportForUserA()

  const userACtx = testEnv.authenticatedContext('userA')
  await assertFails(
    userACtx.firestore()
      .collection('users').doc('userA').collection('trades').doc('T212-001')
      .update({ ticker: 'MSFT' })
  )
})

// B.2.6-emu-unauthenticated: unauthenticated context cannot read any trade
test('B.2.6-emu-unauthenticated cannot read userA trades without auth', async () => {
  await seedImportForUserA()

  const unauthedCtx = testEnv.unauthenticatedContext()
  await assertFails(
    unauthedCtx.firestore()
      .collection('users').doc('userA').collection('trades').doc('T212-001')
      .get()
  )
})

// B.2.6-emu-own-read: userA CAN read own trade (positive case)
test('B.2.6-emu-own-read userA can read own trade (Security Rules)', async () => {
  await seedImportForUserA()

  const userACtx = testEnv.authenticatedContext('userA')
  await assertSucceeds(
    userACtx.firestore()
      .collection('users').doc('userA').collection('trades').doc('T212-001')
      .get()
  )
})
