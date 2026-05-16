/**
 * V0 happy path — sign-in → currency pick → import CSV → dashboard render.
 *
 * Covers test plan §C.1: Google popup sign-in via auth emulator chooser,
 * BaseCurrencyPicker modal, EmptyState CTA to import, T212 CSV upload,
 * preview + commit, and dashboard SummaryCard + HoldingsTable visibility.
 *
 * Vue 3 render errors land in console.error (not pageerror). The console
 * listener is registered early and remains active for the full test.
 *
 * Refs V0.18
 */

import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdirSync } from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TEST_EMAIL = 'duong@allowed.test'
const T212_CSV = path.resolve(__dirname, '../test/fixtures/t212-sample.csv')
const ARTIFACTS_DIR = path.join(__dirname, 'artifacts')

// Ensure artifacts dir exists
mkdirSync(ARTIFACTS_DIR, { recursive: true })

test.describe('V0 happy path — sign-in → import → render', () => {
  test('full happy path', async ({ page }) => {
    // Vue 3 render exception guard: listen early so the whole test is covered.
    // Render errors show in console.error, not window.onerror / pageerror.
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })

    // ---------------------------------------------------------------------------
    // Step 1 — unauthenticated / → redirected to /sign-in
    // ---------------------------------------------------------------------------
    await page.goto('/')
    await expect(page).toHaveURL(/\/sign-in/, { timeout: 10_000 })
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '01-signin.png') })

    // ---------------------------------------------------------------------------
    // Step 2 — Google popup sign-in via auth emulator chooser
    // ---------------------------------------------------------------------------
    const signInBtn = page.getByRole('button', { name: /continue with google/i })
    await expect(signInBtn).toBeVisible()

    // signInWithPopup → emulator opens a popup at /emulator/auth/handler
    const [popup] = await Promise.all([page.waitForEvent('popup'), signInBtn.click()])
    await popup.waitForLoadState('domcontentloaded')
    await popup.screenshot({ path: path.join(ARTIFACTS_DIR, '02-popup-chooser.png') })

    // Add a new account with TEST_EMAIL (seeded into the allowlist by seed-allowlist.mjs)
    await popup.getByRole('button', { name: /add new account/i }).click()
    await popup.getByLabel(/email/i).fill(TEST_EMAIL)
    await popup.getByLabel(/display name/i).fill('Duong Test')
    await popup.getByRole('button', { name: /sign in with google\.com/i }).click()

    // Wait for the popup to finish processing the submission before listening for close
    await popup.waitForLoadState('domcontentloaded')

    // Popup closes; main page navigates to / once auth state propagates
    await popup.waitForEvent('close', { timeout: 10_000 })
    await page.waitForURL(/\/$/, { timeout: 15_000 })

    // ---------------------------------------------------------------------------
    // Step 3 — BaseCurrencyPicker modal visible; pick USD and continue
    // ---------------------------------------------------------------------------
    const modal = page.getByRole('dialog')
    await expect(modal).toBeVisible({ timeout: 10_000 })
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '03-currency-picker.png') })

    // Click the USD radio label (data-testid="radio-USD" per BaseCurrencyPicker.vue)
    const usdLabel = page.getByTestId('radio-USD')
    await usdLabel.click()

    const continueBtn = page.getByTestId('continue-btn')
    await expect(continueBtn).toBeEnabled()
    await continueBtn.click()

    // Modal should dismiss after setBaseCurrency completes
    await expect(modal).toBeHidden({ timeout: 10_000 })

    // ---------------------------------------------------------------------------
    // Step 4 — Dashboard EmptyState visible ("No portfolio data yet")
    // ---------------------------------------------------------------------------
    await expect(page).toHaveURL(/\/$/)
    // DashboardView.vue renders EmptyState with title="No portfolio data yet"
    const emptyStateTitle = page.getByText('No portfolio data yet')
    await expect(emptyStateTitle).toBeVisible({ timeout: 10_000 })
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '04-empty-state.png') })

    // ---------------------------------------------------------------------------
    // Step 5 — Click "Import CSV →" CTA → navigate to /import
    // ---------------------------------------------------------------------------
    // EmptyState renders ctaLabel="Import CSV →" as a RouterLink
    const importCta = page.getByRole('link', { name: /import csv/i })
    await importCta.click()
    await expect(page).toHaveURL(/\/import/)

    // ---------------------------------------------------------------------------
    // Step 6 — Select "Trading 212" source and upload t212-sample.csv
    // ---------------------------------------------------------------------------
    // SourceSelect.vue renders a native <select> with aria-label="Select CSV source"
    const sourceSelect = page.getByLabel('Select CSV source')
    await sourceSelect.selectOption('T212')

    // DropZone renders a hidden <input type="file"> — use setInputFiles
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(T212_CSV)

    // ---------------------------------------------------------------------------
    // Step 7a — Click "Parse →" and wait for Step 2 preview
    // ---------------------------------------------------------------------------
    const parseBtn = page.getByTestId('parse-btn')
    await expect(parseBtn).toBeEnabled({ timeout: 5_000 })
    await parseBtn.click()

    // CsvImport.vue Step 2 heading: "Preview · {N} trades, {M} positions"
    await expect(page.getByText(/preview/i)).toBeVisible({ timeout: 15_000 })
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '05-import-preview.png') })

    // ---------------------------------------------------------------------------
    // Step 7b — Click "Commit import →" and verify redirect to /
    //
    // The toast in CsvImport.vue is shown synchronously with router.push('/'),
    // which means the CsvImport view (and its Toast child) unmounts before
    // Playwright can reliably observe the toast text. We instead verify the
    // commit succeeded by:
    //   a) waiting for the URL to change to / (router.push only fires on success)
    //   b) verifying dashboard content appears (positions exist in Firestore)
    // ---------------------------------------------------------------------------
    const commitBtn = page.getByTestId('commit-btn')
    await expect(commitBtn).toBeEnabled({ timeout: 5_000 })

    // Race: listen for the toast before clicking (it may appear briefly)
    const toastPromise = page.waitForSelector('[data-testid="toast"]', { timeout: 5_000 }).catch(() => null)
    await commitBtn.click()

    // Either the toast appears, or the page navigates to /
    await page.waitForURL(/\/$/, { timeout: 30_000 })
    await toastPromise  // await it (may resolve or not — we don't assert on it)

    // ---------------------------------------------------------------------------
    // Step 8 — Dashboard with SummaryCard + HoldingsTable rows
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

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '05-dashboard-filled.png') })

    // Final Vue render error check
    const vueErrors = consoleErrors.filter(
      (e) => e.includes('[Vue warn]') || e.includes('Uncaught Error'),
    )
    expect(vueErrors, `Unexpected Vue render errors: ${vueErrors.join('\n')}`).toHaveLength(0)
  })
})
