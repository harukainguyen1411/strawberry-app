import { describe, it, expect } from "vitest";

// Proves the setup.ts global stub is active: calling fetch without mocking it
// must throw, not silently make a real network request.
describe("unit-test env guard", () => {
  it("fetch throws without an explicit mock (hermetic guard active)", async () => {
    await expect(fetch("http://example.com")).rejects.toThrow(
      "fetch is not allowed in unit tests"
    );
  });
});
