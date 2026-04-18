import { test, expect } from '@playwright/test'

test.describe('Form submissions and CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('Add Session: open form, fill date and duration, save', async ({ page }) => {
    await page.goto('/read-tracker/sessions')
    await expect(page.getByText(/Reading Sessions/)).toBeVisible()

    await page.getByRole('button', { name: /add session/i }).click()
    await expect(page.getByRole('heading', { name: /add session/i })).toBeVisible()

    const form = page.locator('form')
    const today = new Date().toISOString().slice(0, 10)
    await form.locator('input[type="date"]').fill(today)
    await form.getByRole('spinbutton').first().fill('1')
    await form.getByRole('spinbutton').nth(1).fill('30')

    await form.getByRole('button', { name: /add session/i }).click()

    await expect(page.getByRole('heading', { name: /add session/i })).not.toBeVisible({ timeout: 5000 })
    await expect(page.getByText(/Reading Sessions/)).toBeVisible()
  })

  test('Add Session then reload: session persists (data persistence)', async ({ page }) => {
    await page.goto('/read-tracker/sessions')
    await expect(page.getByText(/Reading Sessions/)).toBeVisible()

    await page.getByRole('button', { name: /add session/i }).click()
    const form = page.locator('form')
    const today = new Date().toISOString().slice(0, 10)
    await form.locator('input[type="date"]').fill(today)
    await form.getByRole('spinbutton').first().fill('0')
    await form.getByRole('spinbutton').nth(1).fill('15')
    await form.getByRole('button', { name: /add session/i }).click()

    await expect(page.getByRole('heading', { name: /add session/i })).not.toBeVisible({ timeout: 5000 })

    await page.reload()
    await expect(page).toHaveURL(/\/read-tracker\/sessions/)
    await expect(page.getByText(/Reading Sessions/)).toBeVisible()
    await expect(page.getByText(/15\s*m|0h\s*15m|15\s*min/i).first()).toBeVisible()
  })
})
