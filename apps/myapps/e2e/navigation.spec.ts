import { test, expect } from '@playwright/test'

test.describe('Navigation between views', () => {
  test('home shows app cards and navigates to Read Tracker', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Welcome to MyApps' })).toBeVisible()
    await expect(page.getByText(/Read Tracker/)).toBeVisible()

    await page.getByRole('button', { name: /open app/i }).first().click()
    await expect(page).toHaveURL(/\/read-tracker/)
    await expect(page.getByText(/Track your reading time/)).toBeVisible()
    await expect(page.getByRole('link', { name: /dashboard/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /sessions/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /books/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /goals/i })).toBeVisible()
  })

  test('Read Tracker inner navigation: Dashboard, Sessions, Books, Goals', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Welcome to MyApps' })).toBeVisible()
    await page.goto('/read-tracker/dashboard')

    await expect(page).toHaveURL(/\/read-tracker\/dashboard/)
    await expect(page.getByText(/Track your reading time/)).toBeVisible()

    await page.getByRole('link', { name: /sessions/i }).click()
    await expect(page).toHaveURL(/\/read-tracker\/sessions/)
    await expect(page.getByText(/Reading Sessions/)).toBeVisible()

    await page.getByRole('link', { name: /books/i }).click()
    await expect(page).toHaveURL(/\/read-tracker\/books/)
    await expect(page.getByText(/My Books/)).toBeVisible()

    await page.getByRole('link', { name: /goals/i }).click()
    await expect(page).toHaveURL(/\/read-tracker\/goals/)
    await expect(page.getByText(/Reading Goals/)).toBeVisible()
  })

  test('can go back to home from Read Tracker via header', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Welcome to MyApps' })).toBeVisible()
    await page.goto('/read-tracker/dashboard')
    await expect(page).toHaveURL(/\/read-tracker\/dashboard/)

    await page.getByRole('link', { name: 'Dark Strawberry home' }).click()
    await expect(page).toHaveURL('/')
  })
})
