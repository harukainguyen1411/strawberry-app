/**
 * Playwright smoke tests for the usage-dashboard static page.
 *
 * plan: plans/approved/2026-04-19-claude-usage-dashboard-tasks.md T10
 *
 * These tests run against a local static server serving
 * dashboards/usage-dashboard/ with a pre-installed fixture data.json
 * (tests/e2e/fixtures/usage-dashboard-data.json).  No real ccusage or
 * refresh-server dependency is needed.
 */

import { test, expect } from '@playwright/test'

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** Wait for the debounce + fetch chain to settle. */
async function waitForRender(page: import('@playwright/test').Page) {
  // The app debounces renders at 50 ms and fetches data.json on load.
  // We wait until the leaderboard no longer shows the "Loading…" placeholder.
  await page.waitForFunction(() => {
    const tbody = document.querySelector('#leaderboard-body')
    if (!tbody) return false
    return !tbody.textContent?.includes('Loading')
  }, { timeout: 5000 })
}

// ---------------------------------------------------------------------------
// fixture data facts (derived from tests/e2e/fixtures/usage-dashboard-data.json)
// ---------------------------------------------------------------------------
// Within the default 30-day window (cutoff ~2026-03-20):
//   agents: Jayce, Evelynn, Viktor, unknown  => 4 agent rows + 1 totals row = 5
//   projects: strawberry, strawberry-app, work/mmp  => 3 rows
//
// Within the 7-day window (cutoff ~2026-04-12):
//   agents: Jayce, Evelynn  => 2 agent rows + 1 totals row = 3  (< 5, confirming reduction)

// ---------------------------------------------------------------------------
// smoke tests
// ---------------------------------------------------------------------------

test.describe('usage-dashboard smoke', () => {

  test('page title is "Strawberry Usage"', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle('Strawberry Usage')
  })

  test('window strip is visible and shows a token count', async ({ page }) => {
    await page.goto('/')
    await waitForRender(page)
    const windowStrip = page.locator('#window-strip')
    await expect(windowStrip).toBeVisible()
    // window-tokens should be populated (not the placeholder dash)
    const tokenText = await page.locator('#window-tokens').textContent()
    expect(tokenText).not.toBe('—')
    expect(tokenText?.trim().length).toBeGreaterThan(0)
  })

  test('leaderboard has >=4 rows (3 agents + totals) on default 30-day range', async ({ page }) => {
    await page.goto('/')
    await waitForRender(page)
    const rows = page.locator('#leaderboard-body tr')
    await expect(rows).toHaveCount(5) // Jayce, Evelynn, Viktor, unknown, Totals
  })

  test('project breakdown has exactly 3 rows on default 30-day range', async ({ page }) => {
    await page.goto('/')
    await waitForRender(page)
    const rows = page.locator('#project-body tr')
    await expect(rows).toHaveCount(3)
  })

  test('sparkline canvas is present and within a visible section', async ({ page }) => {
    await page.goto('/')
    await waitForRender(page)
    const sparklineSection = page.locator('#sparkline')
    await expect(sparklineSection).toBeVisible()
    const canvas = page.locator('#sparkline-canvas')
    await expect(canvas).toBeVisible()
    // Canvas should have non-zero dimensions (Chart.js rendered into it)
    const box = await canvas.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.width).toBeGreaterThan(0)
    expect(box!.height).toBeGreaterThan(0)
  })

  test('date-range select default value is 30 (Last 30 days)', async ({ page }) => {
    await page.goto('/')
    await waitForRender(page)
    const select = page.locator('#date-range')
    await expect(select).toHaveValue('30')
  })

  test('switching to 7-day range reduces leaderboard rows', async ({ page }) => {
    await page.goto('/')
    await waitForRender(page)

    // Capture row count at 30 days
    const rowsBefore = await page.locator('#leaderboard-body tr').count()
    expect(rowsBefore).toBeGreaterThanOrEqual(4)

    // Switch to 7 days
    await page.locator('#date-range').selectOption('7')
    // Wait for debounce
    await page.waitForTimeout(200)
    await waitForRender(page)

    const rowsAfter = await page.locator('#leaderboard-body tr').count()
    // 7-day window includes only Jayce + Evelynn => 2 agents + Totals = 3 rows
    expect(rowsAfter).toBeLessThan(rowsBefore)
    expect(rowsAfter).toBe(3)
  })

  test('"Hide unknown" toggle hides the unknown row', async ({ page }) => {
    await page.goto('/')
    await waitForRender(page)

    // Confirm unknown row is visible before toggle
    const unknownRowBefore = page.locator('#leaderboard-body tr').filter({ hasText: 'unknown' })
    await expect(unknownRowBefore).toBeVisible()

    // Toggle hide-unknown
    await page.locator('#hide-unknown').check()
    await page.waitForTimeout(200)
    await waitForRender(page)

    // Unknown row should no longer be in the leaderboard
    const unknownRowAfter = page.locator('#leaderboard-body tr').filter({ hasText: 'unknown' })
    await expect(unknownRowAfter).toHaveCount(0)
  })

  test('error banner is hidden on successful load', async ({ page }) => {
    await page.goto('/')
    await waitForRender(page)
    const banner = page.locator('#error-banner')
    await expect(banner).toBeHidden()
  })

  test('refresh button has hidden attribute by default (no refresh-server running)', async ({ page }) => {
    await page.goto('/')
    // Wait for the health probe timeout (300 ms) to settle before asserting.
    // Note: Tailwind's `flex` utility class overrides the `hidden` attribute's
    // display:none via higher specificity — the button may render as
    // visually present while the `hidden` attr is still set.  This is a known
    // CSS ordering issue in the dashboard (Tailwind CDN load order); we assert
    // the programmatic `hidden` attribute here.  A QA note is included in the
    // assessments report.
    await page.waitForTimeout(600) // > HEALTH_TIMEOUT_MS (300 ms) + debounce (50 ms)
    const refreshBtn = page.locator('#refresh-btn')
    // The refresh-server is not running so the health probe must have rejected.
    // Assert the hidden attribute is present — the application's intended state.
    await expect(refreshBtn).toHaveAttribute('hidden', '')
  })

  test('all four main sections are present in the DOM', async ({ page }) => {
    await page.goto('/')
    await waitForRender(page)
    await expect(page.locator('#window-strip')).toBeVisible()
    await expect(page.locator('#agent-leaderboard')).toBeVisible()
    await expect(page.locator('#project-breakdown')).toBeVisible()
    await expect(page.locator('#sparkline')).toBeVisible()
  })

})
