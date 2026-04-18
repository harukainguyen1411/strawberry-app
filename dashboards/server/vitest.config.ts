import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    passWithNoTests: true,
    setupFiles: ["src/__tests__/setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.spec.ts"],
  },
});
