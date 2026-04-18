import { test, expect } from '@playwright/test'

test.describe('Portfolio Tracker functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Welcome to MyApps' })).toBeVisible()
  })

  test('Dashboard: shows portfolio dashboard and holdings section', async ({ page }) => {
    await page.goto('/portfolio-tracker/dashboard')
    await expect(page.getByText(/Manage your stock portfolio/)).toBeVisible()
    await expect(page.getByRole('heading', { name: 'My Holdings' })).toBeVisible()
  })

  test('Transactions: shows title, Add Transaction, and list or empty state', async ({ page }) => {
    await page.goto('/portfolio-tracker/transactions')
    await expect(page.getByRole('heading', { name: 'Transactions' })).toBeVisible()
    await expect(page.getByRole('button', { name: /add transaction/i })).toBeVisible()
    await expect(page.getByText(/No transactions|Transaction Type|Buy|Sell/i).first()).toBeVisible()
  })

  test('Transactions: add transaction with source and filter by source', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Welcome to MyApps' })).toBeVisible()
    await page.getByRole('button', { name: /open app/i }).nth(1).click()
    await expect(page).toHaveURL(/\/portfolio-tracker/)
    await page.goto('/portfolio-tracker/transactions')
    await expect(page.getByRole('heading', { name: 'Transactions' })).toBeVisible()
    await page.getByRole('button', { name: /add transaction/i }).click()

    await expect(page.getByRole('heading', { name: /add transaction/i })).toBeVisible()
    await page.getByLabel(/symbol/i).fill('AAPL')
    await page.getByLabel(/quantity/i).fill('10')
    await page.getByLabel(/price per share/i).fill('150')
    const sourceInput = page.getByLabel(/source|broker/i)
    await sourceInput.fill('Trading 212')
    await page.getByRole('button', { name: /save/i }).click()

    const transactionsTable = page.getByRole('table')
    await expect(transactionsTable.getByText('Trading 212')).toBeVisible({ timeout: 5000 })
    await expect(transactionsTable.getByText('AAPL')).toBeVisible()

    const filterSelect = page.getByRole('combobox', { name: /filter by source/i })
    await expect(filterSelect).toBeVisible()
    await filterSelect.selectOption('Trading 212')
    await expect(transactionsTable.getByText('Trading 212')).toBeVisible()
    await expect(transactionsTable.getByText('AAPL')).toBeVisible()
  })

  test('Dashboard: stock performance and NAV% columns display correctly (#46)', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /open app/i }).nth(1).click()
    await expect(page).toHaveURL(/\/portfolio-tracker/)

    await page.goto('/portfolio-tracker/transactions')
    await page.getByRole('button', { name: /add transaction/i }).click()
    await page.getByLabel(/symbol/i).fill('AAPL')
    await page.getByLabel(/quantity/i).fill('10')
    await page.getByLabel(/price per share/i).fill('150')
    await page.getByRole('button', { name: /save/i }).click()

    await page.goto('/portfolio-tracker/dashboard')
    await expect(page.getByRole('heading', { name: 'My Holdings' })).toBeVisible({ timeout: 5000 })
    const holdingsTable = page.getByRole('table')

    await expect(holdingsTable.getByText('AAPL')).toBeVisible()
    await expect(holdingsTable.getByText('Performance')).toBeVisible()
    await expect(holdingsTable.getByText('NAV %')).toBeVisible()

    const navPercentHeader = holdingsTable.getByRole('columnheader', { name: /NAV %/i })
    await expect(navPercentHeader).toBeVisible()
  })

  test('Settings: exchange rates and base currency can be configured (#47)', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /open app/i }).nth(1).click()
    await expect(page).toHaveURL(/\/portfolio-tracker/)

    await page.goto('/portfolio-tracker/settings')
    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible()

    await expect(page.getByText(/exchange rates/i)).toBeVisible()
    await page.getByLabel(/1 EUR = X USD/i).fill('1.19')
    await page.getByLabel(/base currency/i).selectOption('EUR')
    await page.getByRole('button', { name: /save/i }).click()
    await expect(page.getByText(/account updated/i)).toBeVisible({ timeout: 3000 })
  })

  test('Transactions: currency can be selected when adding transaction (#47)', async ({ page }) => {
    await page.goto('/portfolio-tracker/transactions')
    await page.getByRole('button', { name: /add transaction/i }).click()
    await page.getByLabel(/symbol/i).fill('AAPL')
    await page.getByLabel(/quantity/i).fill('5')
    await page.getByLabel(/price per share/i).fill('100')
    const currencySelect = page.getByRole('combobox', { name: /price currency/i })
    await currencySelect.selectOption('EUR')
    await page.getByRole('button', { name: /save/i }).click()

    const table = page.getByRole('table')
    await expect(table.getByText('EUR')).toBeVisible({ timeout: 5000 })
  })

  test('Dashboard: CASH is displayed like a stock in My Holdings when cash > 0 (#43)', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /open app/i }).nth(1).click()
    await expect(page).toHaveURL(/\/portfolio-tracker/)

    await page.goto('/portfolio-tracker/settings')
    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible()

    await page.getByLabel(/total invested/i).fill('1000')
    await page.getByLabel(/total cash/i).fill('5000')
    await page.getByRole('button', { name: /save/i }).click()

    await page.goto('/portfolio-tracker/dashboard')
    await expect(page.getByRole('heading', { name: 'My Holdings' })).toBeVisible()
    const holdingsTable = page.getByRole('table')
    await expect(holdingsTable.getByText('CASH')).toBeVisible({ timeout: 8000 })
    await expect(holdingsTable.getByText('$5,000.00')).toBeVisible()
  })
})
