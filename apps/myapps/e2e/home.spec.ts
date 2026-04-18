import { test, expect } from '@playwright/test'

const APP_ORIGIN = 'http://127.0.0.1:4173'

test.describe('Home page', () => {
  test('loads and shows welcome and app cards', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByText(/Read Tracker/)).toBeVisible()
    await expect(page.getByText(/Portfolio Tracker/)).toBeVisible()
  })

  test('has no failed (4xx/5xx) requests to app', async ({ page }) => {
    const failed: string[] = []
    const badStatus: string[] = []
    page.on('requestfailed', (req) => {
      if (req.url().startsWith(APP_ORIGIN)) {
        failed.push(`${req.url()} → ${req.failure()?.errorText ?? 'unknown'}`)
      }
    })
    page.on('response', (res) => {
      const url = res.request().url()
      if (url.startsWith(APP_ORIGIN) && res.status() >= 400) {
        badStatus.push(`${url} → ${res.status()}`)
      }
    })
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    expect(failed, failed.length ? `Failed: ${failed.join('; ')}` : '').toHaveLength(0)
    expect(badStatus, badStatus.length ? `4xx/5xx: ${badStatus.join('; ')}` : '').toHaveLength(0)
  })
})
