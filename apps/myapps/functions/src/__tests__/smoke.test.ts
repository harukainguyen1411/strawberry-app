/**
 * P1.4 — Vitest proof-of-life: smoke test for BEE_INTRO_MESSAGE export.
 * Plan: plans/in-progress/2026-04-17-deployment-pipeline-tasks.md P1.4
 *
 * First commit: this test deliberately fails (wrong expected value) to prove
 * the harness is wired and catches real failures. Second commit makes it pass
 * by correcting the assertion.
 *
 * BEE_INTRO_MESSAGE is a pure exported string constant from beeIntake.ts.
 * It carries a real behavioural contract: the frontend hardcodes the same
 * string in BeeIntake.vue for immediate display — they must stay in sync.
 * A test that pins the value catches accidental drift before it ships.
 *
 * Firebase Admin/Functions SDK modules are mocked at the top so the test
 * does not require a live project, emulator, or GOOGLE_APPLICATION_CREDENTIALS.
 */

import { vi, describe, it, expect } from "vitest";

// ── Module mocks (must precede any import that transitively loads firebase-admin) ──

vi.mock("firebase-admin/app", () => ({
  initializeApp: vi.fn(),
  getApp: vi.fn(),
}));

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: vi.fn(() => ({
    collection: vi.fn(),
    doc: vi.fn(),
  })),
  FieldValue: { serverTimestamp: vi.fn() },
  Timestamp: { now: vi.fn() },
}));

vi.mock("firebase-admin/storage", () => ({
  getStorage: vi.fn(() => ({ bucket: vi.fn() })),
}));

vi.mock("firebase-functions/v2/firestore", () => ({
  onDocumentCreated: vi.fn(),
}));

vi.mock("firebase-functions/v2/https", () => ({
  onCall: vi.fn(),
  HttpsError: class HttpsError extends Error {
    constructor(public code: string, message: string) {
      super(message);
    }
  },
}));

vi.mock("firebase-functions/params", () => ({
  defineString: vi.fn(() => ({ value: vi.fn(() => "") })),
  defineSecret: vi.fn(() => ({ value: vi.fn(() => "") })),
}));

vi.mock("@octokit/rest", () => ({
  Octokit: vi.fn().mockImplementation(() => ({ issues: {} })),
}));

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: vi.fn(),
  HarmCategory: {},
  HarmBlockThreshold: {},
}));

vi.mock("mammoth", () => ({
  extractRawText: vi.fn(),
}));

// ── Test ──────────────────────────────────────────────────────────────────────

import { BEE_INTRO_MESSAGE } from "../beeIntake";

describe("BEE_INTRO_MESSAGE — exported constant contract", () => {
  /**
   * DELIBERATELY FAILING: the expected string below is wrong.
   * This commit proves the harness is wired and catches assertion failures.
   * The second commit corrects the expected value and the test passes.
   */
  it("starts with the correct Vietnamese greeting (xfail-seed — wrong expected value)", () => {
    expect(BEE_INTRO_MESSAGE).toBe("THIS_IS_WRONG_AND_WILL_FAIL");
  });
});
