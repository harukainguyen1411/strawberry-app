/**
 * Regression guard: E2E build must succeed even when VITE_FIREBASE_* env vars
 * are empty (as they are in CI when real secrets are not configured).
 *
 * Root cause (fixed): firebase/config.ts threw "Missing Firebase configuration"
 * at module load time when apiKey was falsy.  The Playwright webServer ran
 * `vite build` which imported config.ts; the throw crashed the build, the
 * preview server never started, and every page.goto() saw an empty page.
 *
 * Fix: VITE_E2E guard in config.ts skips the throw; .env.e2e provides
 * VITE_E2E=true; playwright.config.ts builds with --mode e2e.  Firebase SDK
 * initialises with empty/placeholder values, fails to auth, and the 3-second
 * timeout in auth.ts falls back to local mode — exactly what the E2E tests
 * exercise.
 *
 * References: PR #46 fix/tdd-gate-enable-functions
 */
import { test, expect } from '@playwright/test'

test('home page heading visible even with empty Firebase credentials (E2E mode)', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10_000 })
})
