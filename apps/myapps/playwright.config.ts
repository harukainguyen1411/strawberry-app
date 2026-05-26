import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E config. Runs against production build via `vite preview`.
 *
 * Two projects:
 *   chromium           — shell specs (port 4173, no emulator, local-mode auth)
 *   portfolio-tracker  — PT specs (port 4174, Firebase emulator stack, real auth)
 *
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['html'], ['list']],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      testDir: './e2e',
      testIgnore: ['**/portfolio-tracker/**'],
      use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4173' },
    },
    {
      name: 'portfolio-tracker',
      testDir: './e2e/portfolio-tracker',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4174' },
      // Workers=1: emulator state is global — avoid parallel test interference
      fullyParallel: false,
    },
  ],
  webServer: [
    {
      // Shell — no emulator; VITE_E2E=true lets Firebase SDK init with
      // placeholder keys and fall back to local mode after 3 s timeout.
      // Uses --outDir dist-shell to avoid colliding with the PT build (dist-pt).
      command: 'npm run build -- --outDir dist-shell && npx vite preview --host 127.0.0.1 --outDir dist-shell',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
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
    },
    {
      // Portfolio-tracker — Firebase emulator stack (auth + firestore + functions)
      // booted via `firebase emulators:exec`. Seed runs inside the exec wrapper
      // before vite preview starts. JAVA_HOME pin: temurin-21 on dev machine.
      //
      // Both function codebases are pre-compiled before emulators:exec starts
      // because the functions emulator loads compiled JS at startup time.
      //
      // globalSetup / globalTeardown are NOT used: emulators:exec handles the
      // full lifecycle (boot → seed → app → teardown on process exit).
      // In-spec beforeAll also re-seeds the allowlist to handle reuseExistingServer
      // cases where the seed step was skipped.
      command:
        // Kill any stale emulator processes from interrupted prior runs before
        // starting fresh. lsof -ti:PORT | xargs kill -9 is a no-op when the
        // port is free. The `2>/dev/null || true` pattern suppresses errors when
        // no process is found or the kill fails (e.g. already exited).
        "(lsof -ti:8080 | xargs kill -9 2>/dev/null; lsof -ti:9099 | xargs kill -9 2>/dev/null; lsof -ti:5001 | xargs kill -9 2>/dev/null; lsof -ti:4174 | xargs kill -9 2>/dev/null; true) && " +
        "JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home " +
        "PATH=/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home/bin:$PATH " +
        "firebase emulators:exec --only auth,firestore,functions --project myapps-e2e " +
        "'node e2e/seed-allowlist.mjs && npm run build -- --outDir dist-pt && npx vite preview --host 127.0.0.1 --port 4174 --outDir dist-pt'",
      url: 'http://127.0.0.1:4174/yourApps/portfolio-tracker',
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        VITE_USE_FIREBASE_EMULATOR: 'true',
        // VITE_E2E=true bypasses missing-config guard in firebase/config.ts;
        // required when .env.local is absent (e.g. fresh worktrees in CI).
        VITE_E2E: 'true',
        VITE_FIREBASE_API_KEY:
          process.env.VITE_FIREBASE_API_KEY || 'e2e-placeholder-api-key',
        VITE_FIREBASE_AUTH_DOMAIN:
          process.env.VITE_FIREBASE_AUTH_DOMAIN || 'myapps-e2e.firebaseapp.com',
        VITE_FIREBASE_PROJECT_ID:
          process.env.VITE_FIREBASE_PROJECT_ID || 'myapps-e2e',
        VITE_FIREBASE_STORAGE_BUCKET:
          process.env.VITE_FIREBASE_STORAGE_BUCKET || 'myapps-e2e.appspot.com',
        VITE_FIREBASE_MESSAGING_SENDER_ID:
          process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '000000000000',
        VITE_FIREBASE_APP_ID:
          process.env.VITE_FIREBASE_APP_ID || '1:000000000000:web:e2e-placeholder',
        VITE_FIREBASE_MEASUREMENT_ID:
          process.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-E2EPLCHLDR'
      }
    },
  ]
})
