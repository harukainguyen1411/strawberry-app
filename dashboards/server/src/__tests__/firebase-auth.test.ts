import { describe, test, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// firebase-admin is mocked so tests run without GCP credentials
vi.mock("firebase-admin", () => ({
  apps: [],
  initializeApp: vi.fn(() => ({ auth: () => mockAuth })),
  app: { App: class {} },
}));

const mockAuth = {
  verifyIdToken: vi.fn(),
};

describe("firebaseAuthMiddleware", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.ALLOWED_UIDS;
  });

  async function makeApp() {
    const { firebaseAuthMiddleware } = await import("../auth/firebase.js");
    const app = express();
    app.use(firebaseAuthMiddleware);
    app.get("/", (req: any, res) => res.json({ uid: req.uid }));
    return app;
  }

  test("allows valid token for allowlisted UID", async () => {
    process.env.ALLOWED_UIDS = "uid-123";
    mockAuth.verifyIdToken.mockResolvedValue({ uid: "uid-123" });
    const app = await makeApp();
    const res = await request(app).get("/").set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(200);
    expect(res.body.uid).toBe("uid-123");
  });

  test("rejects valid token for non-allowlisted UID → 403", async () => {
    process.env.ALLOWED_UIDS = "uid-other";
    mockAuth.verifyIdToken.mockResolvedValue({ uid: "uid-123" });
    const app = await makeApp();
    const res = await request(app).get("/").set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  test("fails closed when ALLOWED_UIDS is empty → 403", async () => {
    process.env.ALLOWED_UIDS = "";
    mockAuth.verifyIdToken.mockResolvedValue({ uid: "uid-123" });
    const app = await makeApp();
    const res = await request(app).get("/").set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  test("rejects expired/invalid token → 401", async () => {
    mockAuth.verifyIdToken.mockRejectedValue(new Error("Token expired"));
    const app = await makeApp();
    const res = await request(app).get("/").set("Authorization", "Bearer bad-token");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_TOKEN");
  });

  test("rejects missing Authorization header → 401", async () => {
    const app = await makeApp();
    const res = await request(app).get("/");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("MISSING_TOKEN");
  });
});
