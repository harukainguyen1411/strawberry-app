import { describe, test, expect, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { ingestTokenMiddleware } from "../auth/ingest-token.js";

function makeApp(token: string) {
  const app = express();
  process.env.INGEST_TOKEN = token;
  app.use(ingestTokenMiddleware);
  app.get("/", (_req, res) => res.json({ ok: true }));
  return app;
}

describe("ingestTokenMiddleware", () => {
  beforeEach(() => { delete process.env.INGEST_TOKEN; });

  test("allows correct token", async () => {
    const app = makeApp("secret-token");
    const res = await request(app).get("/").set("Authorization", "Bearer secret-token");
    expect(res.status).toBe(200);
  });

  test("rejects missing Authorization header → 401", async () => {
    const app = makeApp("secret-token");
    const res = await request(app).get("/");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("MISSING_TOKEN");
  });

  test("rejects wrong token → 401", async () => {
    const app = makeApp("secret-token");
    const res = await request(app).get("/").set("Authorization", "Bearer wrong");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_TOKEN");
  });

  test("rejects non-Bearer scheme → 401", async () => {
    const app = makeApp("secret-token");
    const res = await request(app).get("/").set("Authorization", "Basic secret-token");
    expect(res.status).toBe(401);
  });

  test("rejects token exceeding 64 bytes → 401", async () => {
    const long = "a".repeat(65);
    const app = makeApp(long);
    const res = await request(app).get("/").set("Authorization", `Bearer ${long}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_TOKEN");
  });
});
