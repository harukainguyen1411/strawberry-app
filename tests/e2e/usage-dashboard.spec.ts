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
 *
 * Fixture install is handled deterministically in beforeAll/afterAll so tests
 * pass regardless of whether a pre-existing data.json is present (i.e. whether
 * reuseExistingServer is true or false).
 */

import { test, expect } from '@playwright/test'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

// ---------------------------------------------------------------------------
// paths
// ---------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, '../..')
const LIVE_DATA   = path.join(ROOT, 'dashboards/usage-dashboard/data.json')
const FIXTURE     = path.join(ROOT, 'tests/e2e/fixtures/usage-dashboard-data.json')
const BACKUP      = path.join(ROOT, 'dashboards/usage-dashboard/data.json.bak')

// ---------------------------------------------------------------------------
// fixture setup / teardown
// ---------------------------------------------------------------------------

test.beforeAll(async () => {
  // Back up existing data.json (may or may not exist)
  try {
    await fs.copyFile(LIVE_DATA, BACKUP)
  } catch {
    // No pre-existing data.json — nothing to back up
  }
  // Install fixture unconditionally
  await fs.copyFile(FIXTURE, LIVE_DATA)
})

test.afterAll(async () => {
  try {
    // Check if a backup exists
    await fs.access(BACKUP)
    // Restore the original
    await fs.rename(BACKUP, LIVE_DATA)
  } catch {
    // No backup means there was no original; remove the fixture we installed
    try { await fs.unlink(LIVE_DATA) } catch { /* ignore */ }
  }
})

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
    // Assert at least one row; fixture has 2 projects but we avoid hardcoding to stay resilient
    await expect(rows).not.toHaveCount(0)
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

  test('UI-1: thead and tbody column counts stay in sync when hide-unphased toggles', async ({ page }) => {
    await page.goto('/')
    await waitForGrid(page)

    // Helper: count columns from thead and first grid-row tbody tr
    const getColCounts = () => page.evaluate(() => {
      const theadCols = document.querySelectorAll('#grid-head th').length
      const firstRow  = document.querySelector('#grid-body .grid-row')
      const tbodyCols = firstRow ? firstRow.querySelectorAll('td').length : 0
      return { theadCols, tbodyCols }
    })

    // Unchecked: all phases visible (8 phases + Project + Total = 10)
    const before = await getColCounts()
    expect(before.theadCols).toBe(before.tbodyCols)
    expect(before.theadCols).toBe(10)

    // Check hide-unphased
    await page.locator('#hide-unphased').check()
    await page.waitForTimeout(150)
    await waitForGrid(page)

    // Checked: (unphased) hidden (7 phases + Project + Total = 9)
    const after = await getColCounts()
    expect(after.theadCols).toBe(after.tbodyCols)
    expect(after.theadCols).toBe(9)
  })

  test('I5: plan-row drill is scoped to the plan and yields fewer sessions than project-row drill', async ({ page }) => {
    await page.goto('/')
    await waitForGrid(page)

    // Expand the first project row to reveal plan rows
    const firstRow = page.locator('#grid-body .grid-row').first()
    await firstRow.locator('td').first().click()
    const planRows = page.locator('#grid-body .plan-row:not(.hidden)')
    await expect(planRows).not.toHaveCount(0)

    // Click a phase cell on the first project row (project-level drill)
    const projectPhaseCell = firstRow.locator('td.heatmap-cell').first()
    await projectPhaseCell.click()
    const projectDrillCount = await page.locator('#drill-panel tbody tr').count()

    // Close the drill panel
    await page.locator('#drill-close').click()
    await expect(page.locator('#drill-panel')).toHaveCount(0)

    // Click a phase cell on a plan row (plan-level drill)
    const firstPlanRow = planRows.first()
    const planPhaseCell = firstPlanRow.locator('td[data-phase]').first()
    await planPhaseCell.click()
    const planDrillCount = await page.locator('#drill-panel tbody tr').count()

    // Plan drill should be scoped: result count <= project drill count
    // (fixture has multiple plans per project, so plan drill < project drill)
    expect(planDrillCount).toBeLessThan(projectDrillCount)
  })

})
