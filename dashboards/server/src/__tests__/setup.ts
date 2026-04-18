import { vi, beforeAll, afterAll } from "vitest";

// QA layer 3: block real network calls globally across all unit tests.
// Any test that needs fetch must mock it explicitly — silent real requests
// are not allowed in the unit tier.
beforeAll(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockRejectedValue(
      new Error("fetch is not allowed in unit tests — mock it explicitly")
    )
  );
});

afterAll(() => {
  vi.unstubAllGlobals();
});
