import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright config for usage-dashboard E2E smoke tests.
 * Serves the dashboard directory as a static file site so tests run
 * without any real ccusage data or refresh-server dependency.
 *
 * plan: plans/approved/2026-04-19-claude-usage-dashboard-tasks.md T10
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: ['usage-dashboard.spec.ts'],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never', outputFolder: 'test-results/usage-dashboard-report' }]]
    : [['html', { open: 'never', outputFolder: 'test-results/usage-dashboard-report' }], ['list']],
  use: {
    baseURL: 'http://127.0.0.1:7891',
    trace: 'on-first-retry',
    screenshot: 'on',
    video: 'on',
  },
  outputDir: 'test-results/usage-dashboard',
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    // Install the fixture data.json then start a static server.
    command: "node -e \"const fs=require('fs'),p=require('path');fs.copyFileSync(p.resolve('tests/e2e/fixtures/usage-dashboard-data.json'),p.resolve('dashboards/usage-dashboard/data.json'));console.log('fixture installed');\" && npx --yes serve dashboards/usage-dashboard -l 7891 --no-clipboard",
    url: 'http://127.0.0.1:7891',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
})
