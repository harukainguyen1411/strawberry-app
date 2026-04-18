import { it, expect } from "vitest";

// Regression: C1 — Vitest setup (plans/approved/2026-04-17-test-dashboard-phase1-tasks.md)
it("unit framework wired", () => {
  expect(true).toBe(true);
});
