/**
 * Playwright smoke tests for the usage-dashboard phase × project grid.
 *
 * Replaces the pre-cutover agent-leaderboard spec (schemaVersion 1).
 * plan: plans/personal/active/raspberry-usage-dashboard/2026-05-02-raspberry-usage-dashboard.md T8
 *
 * Tests run against a local static server (configured in playwright.config.ts)
 * serving dashboards/usage-dashboard/ with a pre-installed schemaVersion 2
 * fixture at tests/e2e/fixtures/usage-dashboard-data.json.
 * No real ccusage or refresh-server dependency needed.
 */

import { test, expect } from '@playwright/test'

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** Wait for the phase grid to finish rendering (at least one .grid-row present). */
async function waitForGrid(page: import('@playwright/test').Page) {
  await page.waitForFunction(() => {
    const rows = document.querySelectorAll('#grid-body .grid-row')
    return rows.length > 0
  }, { timeout: 5000 })
}

// ---------------------------------------------------------------------------
// smoke tests
// ---------------------------------------------------------------------------

test.describe('usage-dashboard phase-grid smoke', () => {

  test('page title is "Raspberry Usage"', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle('Raspberry Usage')
  })

  test('grid tbody has at least one .grid-row after data load', async ({ page }) => {
    await page.goto('/')
    await waitForGrid(page)
    const rows = page.locator('#grid-body .grid-row')
    await expect(rows).toHaveCount(2)  // strawberry-app + strawberry
  })

  test('clicking first row sets aria-expanded="true" and reveals plan rows', async ({ page }) => {
    await page.goto('/')
    await waitForGrid(page)

    const firstRow = page.locator('#grid-body .grid-row').first()
    // Before click: collapsed
    await expect(firstRow).toHaveAttribute('aria-expanded', 'false')

    // Click the project name cell (not a phase cell) to expand
    await firstRow.locator('td').first().click()
    await expect(firstRow).toHaveAttribute('aria-expanded', 'true')

    // At least one .plan-row should now be visible
    const planRows = page.locator('#grid-body .plan-row:not(.hidden)')
    await expect(planRows).not.toHaveCount(0)
  })

  test('clicking a heatmap cell shows the drill panel', async ({ page }) => {
    await page.goto('/')
    await waitForGrid(page)

    // Click the first non-empty heatmap cell in the first grid row
    const firstRow = page.locator('#grid-body .grid-row').first()
    const heatmapCell = firstRow.locator('td.heatmap-cell').first()
    await heatmapCell.click()

    // Drill panel should become visible inside #panel-grid
    const drillPanel = page.locator('#drill-panel')
    await expect(drillPanel).toBeVisible()
  })

  test('switching metric to Time changes cell text to duration format', async ({ page }) => {
    await page.goto('/')
    await waitForGrid(page)

    await page.locator('#metric').selectOption('time')
    // Allow debounce (50ms) + render to complete
    await page.waitForTimeout(150)
    await waitForGrid(page)

    // At least one non-empty heatmap cell should show a duration like 7h, 1m, 30s, etc.
    const cells = page.locator('#grid-body .grid-row td.heatmap-cell')
    const count = await cells.count()
    let foundDuration = false
    for (let i = 0; i < count; i++) {
      const text = (await cells.nth(i).textContent()) ?? ''
      if (/^\d+(s|m|h)/.test(text.trim())) {
        foundDuration = true
        break
      }
    }
    expect(foundDuration).toBe(true)
  })

  test('toggling "Hide unphased" removes all (unphased) cells from the DOM', async ({ page }) => {
    await page.goto('/')
    await waitForGrid(page)

    // Confirm (unphased) cells are present before toggle
    const unphasedBefore = page.locator('#grid-body td[data-phase="(unphased)"]')
    await expect(unphasedBefore).not.toHaveCount(0)

    // Enable the toggle
    await page.locator('#hide-unphased').check()
    await page.waitForTimeout(150)
    await waitForGrid(page)

    // No (unphased) cells should remain in the rendered grid
    const unphasedAfter = page.locator('#grid-body td[data-phase="(unphased)"]')
    await expect(unphasedAfter).toHaveCount(0)
  })

})
