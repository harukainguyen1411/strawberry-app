import { defineConfig, devices } from '@playwright/test'

/**
 * Portfolio Tracker V0 — Playwright E2E config.
 *
 * Separate from the legacy apps/myapps playwright.config.ts.
 * Runs against a Vite preview build on port 4174 (not 4173 to avoid collision).
 * Firebase emulators are started in globalSetup and torn down in globalTeardown.
 *
 * Refs V0.18
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: 'http://127.0.0.1:4174/myApps/portfolio-tracker',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  webServer: {
    command: 'npx vite build && npx vite preview --host 127.0.0.1 --port 4174',
    url: 'http://127.0.0.1:4174/myApps/portfolio-tracker/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      VITE_USE_FIREBASE_EMULATOR: 'true',
      VITE_FIREBASE_API_KEY:
        process.env.VITE_FIREBASE_API_KEY || 'e2e-placeholder-api-key',
      VITE_FIREBASE_AUTH_DOMAIN:
        process.env.VITE_FIREBASE_AUTH_DOMAIN || 'portfolio-tracker-e2e.firebaseapp.com',
      VITE_FIREBASE_PROJECT_ID:
        process.env.VITE_FIREBASE_PROJECT_ID || 'portfolio-tracker-e2e',
      VITE_FIREBASE_STORAGE_BUCKET:
        process.env.VITE_FIREBASE_STORAGE_BUCKET || 'portfolio-tracker-e2e.appspot.com',
      VITE_FIREBASE_MESSAGING_SENDER_ID:
        process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '000000000000',
      VITE_FIREBASE_APP_ID:
        process.env.VITE_FIREBASE_APP_ID || '1:000000000000:web:e2e-placeholder',
      VITE_FIREBASE_MEASUREMENT_ID:
        process.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-E2EPLCHLDR',
    },
  },
})
