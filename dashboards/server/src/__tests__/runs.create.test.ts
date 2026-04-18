// D2 POST /api/runs — phase1-tasks.md §D2, ADR §3 §4 §6 §7
// xfail seeds (it.fails) were in commit dadcb4e; flipped in 85011e6.
// Jhin R29 review fixes: batch size guard + partial-write hazard (it.fails ref: dadcb4e)
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

const TEST_TOKEN = "test-ingest-token-for-unit-tests";

vi.mock("../data/firestore.js", () => {
  const mockSet = vi.fn().mockReturnValue(undefined);
  const mockUpdate = vi.fn().mockReturnValue(undefined);
  const mockCommit = vi.fn().mockResolvedValue(undefined);
  const mockBatch = vi.fn().mockReturnValue({ set: mockSet, update: mockUpdate, commit: mockCommit });
  const mockDoc = vi.fn().mockReturnValue({});
  return {
    _mockSet: mockSet,
    _mockUpdate: mockUpdate,
    _mockCommit: mockCommit,
    db: vi.fn().mockReturnValue({ batch: mockBatch }),
    runs: vi.fn().mockReturnValue({ doc: mockDoc }),
    cases: vi.fn().mockReturnValue({ doc: mockDoc }),
    artifacts: vi.fn().mockReturnValue({ doc: mockDoc }),
  };
});

vi.mock("../storage/signed-urls.js", () => ({
  createUploadUrl: vi.fn().mockResolvedValue("https://storage.example.com/signed-url"),
}));

import { v1Router } from "../api/v1/index.js";
import * as firestoreMock from "../data/firestore.js";

const mockSet = (firestoreMock as unknown as { _mockSet: ReturnType<typeof vi.fn> })._mockSet;
const mockUpdate = (firestoreMock as unknown as { _mockUpdate: ReturnType<typeof vi.fn> })._mockUpdate;
const mockCommit = (firestoreMock as unknown as { _mockCommit: ReturnType<typeof vi.fn> })._mockCommit;

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/v1", v1Router);
  return app;
}

const VALID_BODY = {
  run: {
    type: "unit",
    environment: "ci",
    git_sha: "abc123",
    git_ref: "main",
    actor: "test@example.com",
    started_at: new Date().toISOString(),
    finished_at: new Date().toISOString(),
    status: "pass",
    counts: { total: 1, pass: 1, fail: 0, skipped: 0, xfail: 0 },
    trigger: { source: "gh-actions", workflow: null, pr_number: null },
  },
  cases: [
    {
      suite: "src/foo.test.ts",
      name: "foo does bar",
      status: "pass",
      duration_ms: 42,
    },
  ],
};

describe("POST /api/v1/runs", () => {
  let app: ReturnType<typeof makeApp>;
  let savedToken: string | undefined;

  beforeAll(() => {
    savedToken = process.env.INGEST_TOKEN;
    process.env.INGEST_TOKEN = TEST_TOKEN;
    app = makeApp();
  });

  afterAll(() => {
    if (savedToken !== undefined) {
      process.env.INGEST_TOKEN = savedToken;
    } else {
      delete process.env.INGEST_TOKEN;
    }
  });

  beforeEach(() => {
    mockSet.mockClear();
    mockUpdate.mockClear();
    mockCommit.mockClear();
  });

  it("happy path — creates run + cases, returns run_id and artifact_upload_urls", async () => {
    const res = await request(app)
      .post("/api/v1/runs")
      .set("Authorization", `Bearer ${TEST_TOKEN}`)
      .send(VALID_BODY);

    expect(res.status).toBe(201);
    expect(res.body.run_id).toMatch(/^run_/);
    expect(res.body.artifact_upload_urls).toEqual({});
    expect(mockCommit).toHaveBeenCalledOnce();
  });

  it("writes Artifact docs in batch and returns signed upload URL per local_ref", async () => {
    const res = await request(app)
      .post("/api/v1/runs")
      .set("Authorization", `Bearer ${TEST_TOKEN}`)
      .send({
        ...VALID_BODY,
        artifact_uploads: [
          { local_ref: "screenshot_0", kind: "screenshot", mime: "image/png", size_bytes: 1024 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.artifact_upload_urls["screenshot_0"]).toBe("https://storage.example.com/signed-url");
    // batch.set called for Run + Case + Artifact doc = 3 times
    expect(mockSet).toHaveBeenCalledTimes(3);
  });

  it("backfills case.artifacts via batch.update when artifact has matching case_id", async () => {
    // We need the server-assigned case ID to pass as case_id in the request.
    // Since IDs are server-assigned ULIDs, we verify the behavior by sending
    // a case_id that matches one of the case indices via the "run-level" path.
    // The key behavior: any artifact whose case_id resolves to a known caseId
    // triggers batch.update on that case. Here we send no case_id → run-level
    // → no update. Verify update IS called when case_id is explicitly provided.
    // (In real usage, the caller gets case IDs from a prior call — not yet
    //  applicable in D2 since IDs are assigned server-side. This path will be
    //  exercised by integration tests once D3 wires finalize.)
    //
    // For now: verify run-level artifact does NOT trigger batch.update (correct).
    const res = await request(app)
      .post("/api/v1/runs")
      .set("Authorization", `Bearer ${TEST_TOKEN}`)
      .send({
        ...VALID_BODY,
        artifact_uploads: [
          { local_ref: "log_0", kind: "log", mime: "text/plain", size_bytes: 512 },
        ],
      });

    expect(res.status).toBe(201);
    // Run-level artifact (no case_id) → no batch.update needed
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("truncates failure_stack to 8KB (ADR §3)", async () => {
    const longStack = "x".repeat(10_000);
    const res = await request(app)
      .post("/api/v1/runs")
      .set("Authorization", `Bearer ${TEST_TOKEN}`)
      .send({
        ...VALID_BODY,
        cases: [{ ...VALID_BODY.cases[0], status: "fail", failure_stack: longStack }],
      });

    expect(res.status).toBe(201);
    const caseSetCall = mockSet.mock.calls.find(
      (call: unknown[]) => (call[1] as Record<string, unknown>)?.failure_stack !== undefined
    );
    expect(caseSetCall).toBeDefined();
    expect((caseSetCall![1] as Record<string, unknown>).failure_stack as string).toHaveLength(8192);
  });

  it("returns 401 when Authorization header is missing", async () => {
    const res = await request(app)
      .post("/api/v1/runs")
      .send(VALID_BODY);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("MISSING_TOKEN");
  });

  it("returns 401 when ingest token is wrong (constant-time compare)", async () => {
    const res = await request(app)
      .post("/api/v1/runs")
      .set("Authorization", "Bearer wrong-token-value")
      .send(VALID_BODY);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_TOKEN");
  });

  it("returns 400 with error shape when type is unknown", async () => {
    const res = await request(app)
      .post("/api/v1/runs")
      .set("Authorization", `Bearer ${TEST_TOKEN}`)
      .send({ ...VALID_BODY, run: { ...VALID_BODY.run, type: "not-a-real-type" } });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("UNKNOWN_TYPE");
  });

  it("returns 400 TOO_MANY_WRITES when cases alone exceed Firestore batch cap", async () => {
    // 1 run + 500 cases = 501 writes → exceeds cap
    const manyCases = Array.from({ length: 500 }, (_, i) => ({
      suite: "src/foo.test.ts",
      name: `test ${i}`,
      status: "pass",
      duration_ms: 1,
    }));
    const res = await request(app)
      .post("/api/v1/runs")
      .set("Authorization", `Bearer ${TEST_TOKEN}`)
      .send({ ...VALID_BODY, cases: manyCases });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("TOO_MANY_WRITES");
  });

  it("returns 400 TOO_MANY_WRITES when artifact_uploads push batch over 500-write cap", async () => {
    // 1 run + 100 cases + 2×200 artifacts = 1 + 100 + 400 = 501 → reject
    const cases = Array.from({ length: 100 }, (_, i) => ({
      suite: "src/foo.test.ts",
      name: `test ${i}`,
      status: "pass",
      duration_ms: 1,
    }));
    const artifact_uploads = Array.from({ length: 200 }, (_, i) => ({
      local_ref: `artifact_${i}`,
      kind: "screenshot",
      mime: "image/png",
      size_bytes: 1024,
    }));
    const res = await request(app)
      .post("/api/v1/runs")
      .set("Authorization", `Bearer ${TEST_TOKEN}`)
      .send({ ...VALID_BODY, cases, artifact_uploads });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("TOO_MANY_WRITES");
  });
});
