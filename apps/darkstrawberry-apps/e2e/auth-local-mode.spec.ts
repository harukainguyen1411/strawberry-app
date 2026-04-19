import { test, expect } from '@playwright/test'

test.describe('Authentication flows – local mode', () => {
  test('can access Read Tracker without signing in (local mode)', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await page.getByRole('button', { name: /open app/i }).first().click()
    await expect(page).toHaveURL(/\/read-tracker/)
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible()
  })

  test('can access Portfolio Tracker without signing in (local mode)', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await page.getByRole('button', { name: /open app/i }).nth(1).click()
    await expect(page).toHaveURL(/\/portfolio-tracker/)
    await expect(page.getByRole('heading', { name: 'My Holdings' })).toBeVisible()
  })

  test('protected routes redirect to home when not ready then allow access after local mode', async ({ page }) => {
    await page.goto('/read-tracker/sessions')
    await page.waitForURL(/\/(read-tracker|$)/, { timeout: 10000 })
    if (page.url().endsWith('/')) {
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await page.goto('/read-tracker/sessions')
    }
    await expect(page).toHaveURL(/\/read-tracker\/sessions/)
    await expect(page.getByText(/Reading Sessions/)).toBeVisible()
  })
})
