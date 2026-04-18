/**
 * P1.4 — Vitest proof-of-life: smoke tests for beeIntake Cloud Function exports.
 * Plan: plans/in-progress/2026-04-17-deployment-pipeline-tasks.md P1.4
 *
 * Tests real behavioral contracts of beeIntake.ts:
 *   1. beeIntakeStart rejects unauthenticated callers (throws HttpsError "unauthenticated")
 *   2. beeIntakeTurn rejects callers not in the allowed UID list (throws HttpsError "permission-denied")
 *
 * Both tests exercise the assertBeeAuth guard path without hitting Firebase,
 * Firestore, Gemini, or any external service. The onCall mock returns the raw
 * handler so we can call it directly with a synthetic request object.
 *
 * Firebase Admin/Functions SDK modules are mocked at the top so the test
 * does not require a live project, emulator, or GOOGLE_APPLICATION_CREDENTIALS.
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

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
  FieldValue: { serverTimestamp: vi.fn(), increment: vi.fn() },
  Timestamp: { now: vi.fn(), fromDate: vi.fn() },
}));

vi.mock("firebase-admin/storage", () => ({
  getStorage: vi.fn(() => ({ bucket: vi.fn() })),
}));

vi.mock("firebase-functions/v2/firestore", () => ({
  onDocumentCreated: vi.fn(),
}));

// Key: onCall returns the handler directly so tests can invoke it.
vi.mock("firebase-functions/v2/https", () => ({
  // Capture the handler (second arg when opts object is passed, first arg otherwise)
  onCall: vi.fn((...args: unknown[]) => {
    const handler = args.length === 2 ? args[1] : args[0];
    return handler;
  }),
  HttpsError: class HttpsError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
      this.name = "HttpsError";
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

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { beeIntakeStart, beeIntakeTurn, beeIntakeSubmit } from "../beeIntake";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Minimal CallableRequest shape used by beeIntake handlers. */
function makeRequest(uid: string | undefined, data: Record<string, unknown> = {}) {
  return { auth: uid ? { uid } : undefined, data };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("beeIntakeStart — auth guard", () => {
  it("throws unauthenticated when no auth context is present", async () => {
    // Since onCall is mocked to return the handler directly, beeIntakeStart IS
    // the async handler. Call it with no auth — assertBeeAuth must reject it.
    const handler = beeIntakeStart as unknown as (req: ReturnType<typeof makeRequest>) => Promise<unknown>;
    await expect(handler(makeRequest(undefined, { textInput: "hello" }))).rejects.toMatchObject({
      code: "unauthenticated",
      message: "login_required",
    });
  });

  it("throws permission-denied when UID is not in the allowed list", async () => {
    // beeSisterUids is captured at module-load time as the 3rd defineString call
    // (after GITHUB_TOKEN and BEE_GITHUB_REPO). Its .value() fn is called at
    // handler invocation time — so we can override it here to return a restricted list.
    //
    // defineString call order in beeIntake.ts:
    //   [0] GITHUB_TOKEN, [1] BEE_GITHUB_REPO, [2] BEE_SISTER_UIDS
    const { defineString } = await import("firebase-functions/params");
    const beeSisterUidsMock = vi.mocked(defineString).mock.results[2]?.value as { value: ReturnType<typeof vi.fn> };
    const originalValue = beeSisterUidsMock.value;
    beeSisterUidsMock.value = vi.fn(() => "allowed-uid-1,allowed-uid-2");

    const handler = beeIntakeStart as unknown as (req: ReturnType<typeof makeRequest>) => Promise<unknown>;
    try {
      // "stranger-uid" is authenticated but NOT in "allowed-uid-1,allowed-uid-2"
      // assertBeeAuth must reach the permission-denied branch.
      await expect(handler(makeRequest("stranger-uid", { textInput: "hello" }))).rejects.toMatchObject({
        code: "permission-denied",
        message: "not_authorized_for_bee",
      });
    } finally {
      // Restore original mock so other tests are not affected.
      beeSisterUidsMock.value = originalValue;
    }
  });
});

describe("beeIntakeTurn — input validation guard", () => {
  it("throws unauthenticated when no auth context is present", async () => {
    const handler = beeIntakeTurn as unknown as (req: ReturnType<typeof makeRequest>) => Promise<unknown>;
    await expect(handler(makeRequest(undefined, { sessionId: "s1", userMessage: "hi" }))).rejects.toMatchObject({
      code: "unauthenticated",
      message: "login_required",
    });
  });
});

describe("beeIntakeSubmit — input validation guard", () => {
  it("throws unauthenticated when no auth context is present", async () => {
    const handler = beeIntakeSubmit as unknown as (req: ReturnType<typeof makeRequest>) => Promise<unknown>;
    await expect(handler(makeRequest(undefined, { sessionId: "s1" }))).rejects.toMatchObject({
      code: "unauthenticated",
      message: "login_required",
    });
  });
});
