import { test, expect } from '@playwright/test'

/**
 * Visual regression tests — screenshot comparison for key portal pages.
 * Catches styling regressions before merge.
 *
 * Update baselines:  npx playwright test e2e/visual-regression.spec.ts --update-snapshots
 */

test.describe('Visual regression — dark mode (default)', () => {
  // TODO: rebaseline after legacy portfolio-tracker removal (PR #84) — home grid
  // changed from 4 cards to 2/3 cards (PT removed from allApps in Home.vue).
  // Re-enable + regenerate via `npx playwright test --update-snapshots`.
  test.skip('Home page', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveScreenshot('home-dark.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.01
    })
  })

  test('Access denied page', async ({ page }) => {
    await page.goto('/access-denied')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveScreenshot('access-denied-dark.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.01
    })
  })

  test('Not found page', async ({ page }) => {
    await page.goto('/this-page-does-not-exist')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveScreenshot('not-found-dark.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.01
    })
  })
})

test.describe('Visual regression — light mode', () => {
  test.beforeEach(async ({ page }) => {
    // Set light theme via localStorage before navigation
    await page.addInitScript(() => {
      localStorage.setItem('ds-theme', 'light')
    })
  })

  // TODO: rebaseline after legacy portfolio-tracker removal (PR #84). See dark-mode TODO above.
  test.skip('Home page (light)', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveScreenshot('home-light.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.01
    })
  })

  test('Access denied page (light)', async ({ page }) => {
    await page.goto('/access-denied')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveScreenshot('access-denied-light.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.01
    })
  })

  test('Not found page (light)', async ({ page }) => {
    await page.goto('/this-page-does-not-exist')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveScreenshot('not-found-light.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.01
    })
  })
})

test.describe('Visual regression — app cards', () => {
  // TODO: rebaseline after legacy portfolio-tracker removal (PR #84). See dark-mode TODO above.
  test.skip('App cards grid on home page', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    const appGrid = page.locator('[data-testid="app-grid"]').or(page.locator('.grid').first())
    if (await appGrid.isVisible()) {
      await expect(appGrid).toHaveScreenshot('app-cards-grid.png', {
        maxDiffPixelRatio: 0.01
      })
    }
  })
})
