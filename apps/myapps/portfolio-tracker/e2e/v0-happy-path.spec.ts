/**
 * V0 happy path — sign-in → currency pick → import CSV → dashboard render.
 *
 * Covers test plan §C.1: email-link sign-in via auth emulator oobCodes,
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
const PROJECT_ID = 'portfolio-tracker-e2e'
const TEST_EMAIL = 'duong@allowed.test'
const T212_CSV = path.resolve(__dirname, '../test/fixtures/t212-sample.csv')
const ARTIFACTS_DIR = path.join(__dirname, 'artifacts')

// Ensure artifacts dir exists
mkdirSync(ARTIFACTS_DIR, { recursive: true })

test.describe('V0 happy path — sign-in → import → render', () => {
  test('full happy path', async ({ page, request }) => {
    // xfail-first commit per TDD rule 12.
    // Remove this line after local emulator run green and flip to impl commit.
    test.fixme()

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
    await expect(page).toHaveURL(/\/sign-in/)
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '01-signin.png') })

    // ---------------------------------------------------------------------------
    // Step 2 — email link sign-in via auth emulator oobCodes
    // ---------------------------------------------------------------------------
    const emailInput = page.locator('input[type="email"]')
    await expect(emailInput).toBeVisible()
    await emailInput.fill(TEST_EMAIL)

    const sendBtn = page.getByRole('button', { name: /send sign-in link/i })
    await sendBtn.click()

    // Wait for "Check your email" confirmation state
    await expect(page.getByText(/check your email/i)).toBeVisible({ timeout: 10_000 })
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '02-link-sent.png') })

    // Fetch oob link from auth emulator
    const oobRes = await request.get(
      `http://127.0.0.1:9099/emulator/v1/projects/${PROJECT_ID}/oobCodes`,
    )
    expect(oobRes.ok()).toBeTruthy()
    const oobBody = await oobRes.json()
    const oobCodes: { email: string; oobLink: string }[] = oobBody.oobCodes ?? []
    const oobEntry = oobCodes.find((c) => c.email === TEST_EMAIL)
    expect(oobEntry, `Expected oob code for ${TEST_EMAIL} but got: ${JSON.stringify(oobCodes)}`).toBeTruthy()

    // Navigate to the sign-in callback link to complete auth
    await page.goto(oobEntry!.oobLink)
    // Callback view (SignInCallbackView.vue) calls completeSignIn then router.replace('/')
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
    // Step 7b — Click "Commit import →" and verify toast + redirect to /
    // ---------------------------------------------------------------------------
    const commitBtn = page.getByTestId('commit-btn')
    await expect(commitBtn).toBeEnabled({ timeout: 5_000 })
    await commitBtn.click()

    // Toast message: "Imported N trades" (from CsvImport.vue showToast)
    await expect(page.getByText(/imported \d+ trades/i)).toBeVisible({ timeout: 20_000 })
    // Router redirects to /
    await page.waitForURL(/\/$/, { timeout: 20_000 })

    // ---------------------------------------------------------------------------
    // Step 8 — Dashboard with SummaryCard + HoldingsTable rows
    // ---------------------------------------------------------------------------
    // SummaryCard section: look for "Total value" label (from SummaryCard.vue template)
    await expect(page.getByText('Total value')).toBeVisible({ timeout: 15_000 })

    // HoldingsTable: data-testid="holdings-root" per HoldingsTable.vue
    const holdingsRoot = page.getByTestId('holdings-root')
    await expect(holdingsRoot).toBeVisible({ timeout: 10_000 })

    // Expect at least one ticker row (AAPL from t212-sample.csv)
    await expect(page.getByRole('cell', { name: 'AAPL' }).or(
      page.getByText('AAPL')
    )).toBeVisible({ timeout: 10_000 })

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '05-dashboard-filled.png') })

    // Final Vue render error check
    const vueErrors = consoleErrors.filter(
      (e) => e.includes('[Vue warn]') || e.includes('Uncaught Error'),
    )
    expect(vueErrors, `Unexpected Vue render errors: ${vueErrors.join('\n')}`).toHaveLength(0)
  })
})
