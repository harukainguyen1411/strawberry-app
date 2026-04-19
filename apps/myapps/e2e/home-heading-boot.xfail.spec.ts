/**
 * xfail — home page H1 heading regression
 *
 * The E2E workflow (`.github/workflows/e2e.yml`) was missing `npm ci` and the
 * `VITE_FIREBASE_*` environment variables required at build time.  Without
 * those variables `firebase/config.ts` throws on module load, the Vue app
 * fails to mount, and `<div id="app">` remains empty — so every test that
 * asserts `getByRole('heading', { level: 1 })` fails with "element(s) not found".
 *
 * These tests are marked `test.fail()` to pin the regression until the
 * workflow is fixed.  Once the fix lands they will be converted to normal
 * passing tests (the `test.fail()` wrappers are removed).
 *
 * Introduced by: fix/e2e-workflow-npm-install
 * Related plan: (no approved plan — this is a self-contained workflow bug fix)
 */

import { test, expect } from '@playwright/test'

test.describe('Home page heading — xfail regression pin', () => {
  test.fail(
    true,
    'e2e.yml missing npm ci + Firebase env vars — app does not mount, H1 not rendered'
  )

  test('home page renders H1 heading on load', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('home page shows Read Tracker app card', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByText(/Read Tracker/)).toBeVisible()
  })
})
