import { test, expect } from '@playwright/test'

/**
 * Visual regression tests — screenshot comparison for key portal pages.
 * Catches styling regressions before merge.
 *
 * Update baselines:  npx playwright test e2e/visual-regression.spec.ts --update-snapshots
 */

test.describe('Visual regression — dark mode (default)', () => {
  test('Home page', async ({ page }) => {
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

  test('Home page (light)', async ({ page }) => {
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
  test('App cards grid on home page', async ({ page }) => {
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
