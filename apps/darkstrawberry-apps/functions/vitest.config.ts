/// <reference types="vitest" />
import { defineConfig } from "vitest/config";

/**
 * Vitest configuration for apps/darkstrawberry-apps/functions (Cloud Functions unit tests).
 * Plan: plans/in-progress/2026-04-17-deployment-pipeline-tasks.md P1.4
 *
 * Notes:
 * - Functions source is CommonJS (tsc target) but Vitest runs under ESM
 *   internally and handles the interop.
 * - Firebase Admin/Functions SDKs are mocked at the test level via vi.mock()
 *   so tests do not require a live Firebase project or emulator.
 * - test:run is the CI-safe command (no watch mode).
 */
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/__tests__/**/*.{test,spec}.ts"],
    // coverage block removed — @vitest/coverage-v8 not installed; add with P1.5
  },
});
