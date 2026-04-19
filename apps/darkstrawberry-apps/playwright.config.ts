import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E config. Runs against production build via `vite preview`.
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['html'], ['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // VITE_E2E=true (injected via env below) disables the hard throw in
    // firebase/config.ts when VITE_FIREBASE_* values are empty/placeholder
    // (as they are in CI without real secrets).  Firebase SDK initialises
    // successfully; auth times out after 3 s; local mode kicks in.
    command: 'npm run build && npx vite preview --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      // Placeholder values so vite build succeeds when GitHub Actions secrets
      // are empty.  VITE_E2E=true (from .env.e2e) gates off the hard throw;
      // these non-empty values prevent the Firebase SDK from rejecting the
      // config object at initializeApp() time.
      VITE_E2E: 'true',
      VITE_FIREBASE_API_KEY:
        process.env.VITE_FIREBASE_API_KEY || 'e2e-placeholder-api-key',
      VITE_FIREBASE_AUTH_DOMAIN:
        process.env.VITE_FIREBASE_AUTH_DOMAIN || 'e2e-placeholder.firebaseapp.com',
      VITE_FIREBASE_PROJECT_ID:
        process.env.VITE_FIREBASE_PROJECT_ID || 'e2e-placeholder-project',
      VITE_FIREBASE_STORAGE_BUCKET:
        process.env.VITE_FIREBASE_STORAGE_BUCKET || 'e2e-placeholder.appspot.com',
      VITE_FIREBASE_MESSAGING_SENDER_ID:
        process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '000000000000',
      VITE_FIREBASE_APP_ID:
        process.env.VITE_FIREBASE_APP_ID || '1:000000000000:web:e2e-placeholder',
      VITE_FIREBASE_MEASUREMENT_ID:
        process.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-E2EPLCHLDR'
    }
  }
})
