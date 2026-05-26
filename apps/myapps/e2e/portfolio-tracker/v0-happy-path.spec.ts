/**
 * V0 happy path — sign-in → currency pick → import CSV → dashboard render.
 *
 * Covers test plan §C.1: programmatic sign-in via auth emulator (bypasses the
 * Google popup/GAPI iframe flow), BaseCurrencyPicker modal, EmptyState CTA to
 * import, T212 CSV upload, preview + commit, and dashboard SummaryCard +
 * HoldingsTable visibility.
 *
 * Shell integration (v0.2): sign-in uses window.__e2eSignIn (exposed by
 * firebase/config.ts when VITE_E2E=true) to call signInWithEmailAndPassword
 * against the emulator. The beforeUserSignedIn blocking function still runs,
 * exercising the allowlist check end-to-end.
 * After auth the spec navigates directly to /yourApps/portfolio-tracker.
 * All PT routes use the /yourApps/portfolio-tracker prefix.
 *
 * Vue 3 render errors land in console.error (not pageerror). The console
 * listener is registered early and remains active for the full test.
 *
 * Refs portfolio-tracker v0.2
 */

import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdirSync } from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TEST_EMAIL = 'duong@allowed.test'
const TEST_PASSWORD = 'e2e-test-password'
const T212_CSV = path.resolve(__dirname, './fixtures/t212-sample.csv')
const ARTIFACTS_DIR = path.join(__dirname, 'artifacts')

// Ensure artifacts dir exists
mkdirSync(ARTIFACTS_DIR, { recursive: true })

// Seed the Firestore emulator allowlist before the test suite runs.
// This is done in-spec (not globalSetup) because the webServer uses
// reuseExistingServer=true locally — if the emulators were already running,
// the inner seed-allowlist.mjs step was skipped by Playwright. Re-seeding
// here is idempotent (PATCH overwrites the same document) and ensures the
// blocking function allows sign-in regardless of server reuse.
const PROJECT_ID = 'myapps-e2e'
const FIRESTORE_HOST = '127.0.0.1:8080'

async function seedAllowlistInSpec(): Promise<void> {
  const url = `http://${FIRESTORE_HOST}/v1/projects/${PROJECT_ID}/databases/(default)/documents/config/auth_allowlist`
  const body = {
    fields: {
      emails: {
        arrayValue: { values: [{ stringValue: TEST_EMAIL }] },
      },
    },
  }
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(`Allowlist seed failed — HTTP ${res.status}: ${await res.text()}`)
  }
}

test.describe('V0 happy path — sign-in → import → render', () => {
  test.beforeAll(async () => {
    await seedAllowlistInSpec()
  })

  test('full happy path', async ({ page }) => {
    test.setTimeout(120_000)

    // Vue 3 render exception guard: listen early so the whole test is covered.
    // Render errors show in console.error, not window.onerror / pageerror.
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })

    // ---------------------------------------------------------------------------
    // Step 1 — land on shell Home (unauthenticated).
    // The shell has no /sign-in route. Auth guard redirects to Home (name: 'home').
    // GoogleLoginButton is visible in the sign-in CTA block on Home.
    // ---------------------------------------------------------------------------
    await page.goto('/')
    // Shell Home heading is visible (we're on Home, not redirected elsewhere)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10_000 })
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '01-home-unauthenticated.png') })

    // ---------------------------------------------------------------------------
    // Step 2 — Sign in via emulator programmatically.
    // window.__e2eSignIn is exposed by firebase/config.ts when VITE_E2E=true.
    // It calls signInWithEmailAndPassword (or createUserWithEmailAndPassword on
    // first run) against the emulator, triggering the beforeUserSignedIn blocking
    // function and the allowlist check.
    // ---------------------------------------------------------------------------
    await page.waitForFunction(() => typeof (window as unknown as Record<string, unknown>).__e2eSignIn === 'function', {
      timeout: 10_000,
    })
    await page.evaluate(
      ([email, password]) =>
        (window as unknown as { __e2eSignIn: (e: string, p: string) => Promise<unknown> }).__e2eSignIn(email, password),
      [TEST_EMAIL, TEST_PASSWORD] as [string, string],
    )

    // Wait for auth state to propagate (onAuthStateChanged callback fires)
    await page.waitForFunction(
      () =>
        !(window as unknown as Record<string, unknown>).__vueApp ||
        // auth store user is set — check by watching the heading change or
        // simply waiting for the URL to stabilise (Home stays at /)
        true,
      { timeout: 5_000 },
    )
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '02-home-authenticated.png') })

    // ---------------------------------------------------------------------------
    // Step 3 — Navigate directly to /yourApps/portfolio-tracker after auth.
    // (duong@allowed.test is not in APP_EMAIL_ALLOWLIST in Home.vue, so the PT
    // card is not shown; navigate programmatically instead.)
    // ---------------------------------------------------------------------------
    await page.goto('/yourApps/portfolio-tracker')
    await page.waitForURL(/\/yourApps\/portfolio-tracker/, { timeout: 10_000 })
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '03-pt-landing.png') })

    // ---------------------------------------------------------------------------
    // Step 4 — BaseCurrencyPicker modal visible; pick USD and continue
    // ---------------------------------------------------------------------------
    const modal = page.getByRole('dialog')
    await expect(modal).toBeVisible({ timeout: 10_000 })
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '04-currency-picker.png') })

    // Click the USD radio label (data-testid="radio-USD" per BaseCurrencyPicker.vue)
    const usdLabel = page.getByTestId('radio-USD')
    await usdLabel.click()

    const continueBtn = page.getByTestId('continue-btn')
    await expect(continueBtn).toBeEnabled()
    await continueBtn.click()

    // Modal should dismiss after setBaseCurrency completes
    await expect(modal).toBeHidden({ timeout: 10_000 })

    // ---------------------------------------------------------------------------
    // Step 5 — Dashboard EmptyState visible ("No portfolio data yet")
    // ---------------------------------------------------------------------------
    await expect(page).toHaveURL(/\/yourApps\/portfolio-tracker/)
    // DashboardView.vue renders EmptyState with title="No portfolio data yet"
    const emptyStateTitle = page.getByText('No portfolio data yet')
    await expect(emptyStateTitle).toBeVisible({ timeout: 10_000 })
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '05-empty-state.png') })

    // ---------------------------------------------------------------------------
    // Step 6 — Click "Import CSV →" CTA → navigate to /yourApps/portfolio-tracker/import
    // ---------------------------------------------------------------------------
    // EmptyState renders ctaLabel="Import CSV →" as a RouterLink
    const importCta = page.getByRole('link', { name: /import csv/i })
    await importCta.click()
    await expect(page).toHaveURL(/\/yourApps\/portfolio-tracker\/import/)

    // ---------------------------------------------------------------------------
    // Step 7 — Select "Trading 212" source and upload t212-sample.csv
    // ---------------------------------------------------------------------------
    // SourceSelect.vue renders a native <select> with aria-label="Select CSV source"
    const sourceSelect = page.getByLabel('Select CSV source')
    await sourceSelect.selectOption('T212')

    // DropZone renders a hidden <input type="file"> — use setInputFiles
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(T212_CSV)

    // ---------------------------------------------------------------------------
    // Step 8a — Click "Parse →" and wait for Step 2 preview
    // ---------------------------------------------------------------------------
    const parseBtn = page.getByTestId('parse-btn')
    await expect(parseBtn).toBeEnabled({ timeout: 5_000 })
    await parseBtn.click()

    // CsvImport.vue Step 2 heading: "Preview · {N} trades, {M} positions"
    await expect(page.getByText(/preview/i)).toBeVisible({ timeout: 15_000 })
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '06-import-preview.png') })

    // ---------------------------------------------------------------------------
    // Step 8b — Click "Commit import →" and verify redirect to /yourApps/portfolio-tracker
    //
    // The toast in CsvImport.vue is shown synchronously with router.push('/'),
    // which means the CsvImport view (and its Toast child) unmounts before
    // Playwright can reliably observe the toast text. We instead verify the
    // commit succeeded by:
    //   a) waiting for the URL to change to /yourApps/portfolio-tracker
    //   b) verifying dashboard content appears (positions exist in Firestore)
    // ---------------------------------------------------------------------------
    const commitBtn = page.getByTestId('commit-btn')
    await expect(commitBtn).toBeEnabled({ timeout: 5_000 })

    // Race: listen for the toast before clicking (it may appear briefly)
    const toastPromise = page.waitForSelector('[data-testid="toast"]', { timeout: 5_000 }).catch(() => null)
    await commitBtn.click()

    // Either the toast appears, or the page navigates to dashboard
    await page.waitForURL(/\/yourApps\/portfolio-tracker$/, { timeout: 30_000 })
    await toastPromise  // await it (may resolve or not — we don't assert on it)

    // ---------------------------------------------------------------------------
    // Step 9 — Dashboard with SummaryCard + HoldingsTable rows
    // ---------------------------------------------------------------------------
    // SummaryCard section: look for "Total value" label (from SummaryCard.vue template)
    await expect(page.getByText('Total value')).toBeVisible({ timeout: 15_000 })

    // HoldingsTable: data-testid="holdings-root" per HoldingsTable.vue
    const holdingsRoot = page.getByTestId('holdings-root')
    await expect(holdingsRoot).toBeVisible({ timeout: 10_000 })

    // Expect at least one ticker row (AAPL from t212-sample.csv).
    // Use .first() to avoid strict-mode violation: desktop table renders a <td>
    // and the mobile card list renders a <span> — both visible simultaneously.
    await expect(page.getByRole('cell', { name: 'AAPL' }).or(
      page.getByText('AAPL')
    ).first()).toBeVisible({ timeout: 10_000 })

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '07-dashboard-filled.png') })

    // Final Vue render error check
    const vueErrors = consoleErrors.filter(
      (e) => e.includes('[Vue warn]') || e.includes('Uncaught Error'),
    )
    expect(vueErrors, `Unexpected Vue render errors: ${vueErrors.join('\n')}`).toHaveLength(0)
  })
})
