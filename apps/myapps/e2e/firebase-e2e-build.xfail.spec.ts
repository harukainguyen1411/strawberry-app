/**
 * xfail regression: E2E build fails when VITE_FIREBASE_* env vars are empty.
 *
 * Root cause: firebase/config.ts throws "Missing Firebase configuration" at
 * module load time when apiKey is falsy.  The Playwright webServer runs
 * `vite build` which imports config.ts; the throw crashes the build, the
 * preview server never starts, and every page.goto() sees an empty page.
 *
 * Fix: add VITE_E2E guard in config.ts + .env.e2e placeholder file +
 * playwright.config.ts builds with --mode e2e.
 *
 * References: plans/approved/ (PR #46 fix/tdd-gate-enable-functions)
 */
import { test, expect } from '@playwright/test'

// This test should PASS once the fix lands.  It is marked test.fail() to
// pin the regression until then — CI will report it green as an expected
// failure and flip to a real failure if the bug regresses.
test.fail()
test('home page heading visible even with empty Firebase credentials (E2E mode)', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10_000 })
})
