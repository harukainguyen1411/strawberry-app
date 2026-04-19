/**
 * B.1 — Firestore Security Rules tests (Refs V0.3)
 *
 * xfail commit: all tests marked xtest() (Jest's skip-but-expected-to-fail equivalent).
 * Implementation commit: flipped to test().
 *
 * Run: firebase emulators:exec --only firestore \
 *   "npx jest test/rules/firestore.rules.test.ts"
 *
 * Requires: @firebase/rules-unit-testing, jest, ts-jest
 */

import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import * as fs from 'fs'
import * as path from 'path'

let testEnv: RulesTestEnvironment

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'portfolio-tracker-test',
    firestore: {
      rules: fs.readFileSync(
        path.resolve(__dirname, '../../firestore.rules'),
        'utf8'
      ),
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

// B.1.1
test('B.1.1 user A reads own profile', async () => {
  const ctx = testEnv.authenticatedContext('userA')
  await assertSucceeds(ctx.firestore().collection('users').doc('userA').get())
})

// B.1.2
test('B.1.2 user A cannot read user B profile', async () => {
  const ctx = testEnv.authenticatedContext('userA')
  await assertFails(ctx.firestore().collection('users').doc('userB').get())
})

// B.1.3
test('B.1.3 user A writes own position', async () => {
  const ctx = testEnv.authenticatedContext('userA')
  await assertSucceeds(
    ctx.firestore().collection('users').doc('userA').collection('positions').doc('AAPL').set({
      ticker: 'AAPL',
      quantity: 10,
      avgCost: { amount: 148.5, currency: 'USD' },
      broker: 'T212',
    })
  )
})

// B.1.4
test('B.1.4 user A cannot write to user B positions', async () => {
  const ctx = testEnv.authenticatedContext('userA')
  await assertFails(
    ctx.firestore().collection('users').doc('userB').collection('positions').doc('AAPL').set({
      ticker: 'AAPL',
    })
  )
})

// B.1.5
test('B.1.5 user A cannot read user B trades', async () => {
  const ctx = testEnv.authenticatedContext('userA')
  await assertFails(
    ctx.firestore().collection('users').doc('userB').collection('trades').doc('T1').get()
  )
})

// B.1.6
test('B.1.6 unauthenticated cannot read any user positions', async () => {
  const ctx = testEnv.unauthenticatedContext()
  await assertFails(
    ctx.firestore().collection('users').doc('userA').collection('positions').doc('AAPL').get()
  )
})

// B.1.7
test('B.1.7 user A cannot create own profile without baseCurrency', async () => {
  const ctx = testEnv.authenticatedContext('userA')
  await assertFails(
    ctx.firestore().collection('users').doc('userA').set({
      email: 'a@test.com',
      displayName: 'A',
      // no baseCurrency
    })
  )
})

// B.1.8
test('B.1.8 user A cannot create profile with baseCurrency GBP (not USD or EUR)', async () => {
  const ctx = testEnv.authenticatedContext('userA')
  await assertFails(
    ctx.firestore().collection('users').doc('userA').set({
      email: 'a@test.com',
      baseCurrency: 'GBP',
    })
  )
})

// B.1.9
test('B.1.9 user A can create profile with baseCurrency USD', async () => {
  const ctx = testEnv.authenticatedContext('userA')
  await assertSucceeds(
    ctx.firestore().collection('users').doc('userA').set({
      email: 'a@test.com',
      displayName: 'A',
      baseCurrency: 'USD',
    })
  )
})

// B.1.10
test('B.1.10 user A can update own baseCurrency to EUR', async () => {
  const adminCtx = testEnv.withSecurityRulesDisabled(async (db) => {
    await db.firestore().collection('users').doc('userA').set({
      email: 'a@test.com',
      displayName: 'A',
      baseCurrency: 'USD',
    })
  })
  await adminCtx
  const ctx = testEnv.authenticatedContext('userA')
  await assertSucceeds(
    ctx.firestore().collection('users').doc('userA').update({ baseCurrency: 'EUR' })
  )
})

// B.1.11
test('B.1.11 user A cannot update (overwrite) an existing trade (immutability)', async () => {
  // Seed a trade via admin
  await testEnv.withSecurityRulesDisabled(async (db) => {
    await db.firestore()
      .collection('users')
      .doc('userA')
      .collection('trades')
      .doc('T1')
      .set({ broker: 'T212', ticker: 'AAPL', side: 'BUY' })
  })
  const ctx = testEnv.authenticatedContext('userA')
  await assertFails(
    ctx.firestore()
      .collection('users')
      .doc('userA')
      .collection('trades')
      .doc('T1')
      .update({ ticker: 'MSFT' })
  )
})

// B.1.12
test('B.1.12 firestore.rules contains no allow read/write: if true', () => {
  const rulesText = fs.readFileSync(
    path.resolve(__dirname, '../../firestore.rules'),
    'utf8'
  )
  expect(rulesText).not.toMatch(/allow\s+read.*if\s+true/)
  expect(rulesText).not.toMatch(/allow\s+write.*if\s+true/)
  expect(rulesText).not.toMatch(/allow\s+read,\s*write.*if\s+true/)
})

// B.1.13 — xfail: hasOnly enforcement on create (Refs V0.10 Senna review)
// Flip xtest -> test when firestore.rules has hasOnly([...]) on users/{uid} create.
xtest('B.1.13 user A cannot create profile with extra field isAdmin (hasOnly enforcement)', async () => {
  const ctx = testEnv.authenticatedContext('userA')
  await assertFails(
    ctx.firestore().collection('users').doc('userA').set({
      email: 'a@test.com',
      displayName: 'A',
      baseCurrency: 'USD',
      isAdmin: true,
    })
  )
})

// B.1.14 — xfail: hasOnly enforcement on update (Refs V0.10 Senna review)
// Flip xtest -> test when firestore.rules has hasOnly([...]) on users/{uid} update.
xtest('B.1.14 user A cannot update profile with extra field isAdmin (hasOnly enforcement)', async () => {
  await testEnv.withSecurityRulesDisabled(async (db) => {
    await db.firestore().collection('users').doc('userA').set({
      email: 'a@test.com',
      displayName: 'A',
      baseCurrency: 'USD',
    })
  })
  const ctx = testEnv.authenticatedContext('userA')
  await assertFails(
    ctx.firestore().collection('users').doc('userA').update({
      baseCurrency: 'EUR',
      isAdmin: true,
    })
  )
})
