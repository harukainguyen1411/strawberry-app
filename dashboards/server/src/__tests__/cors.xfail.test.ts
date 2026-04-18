// F3 — CORS configuration (plans/approved/2026-04-17-test-dashboard-phase1-tasks.md §F3)
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { corsMiddleware } from "../middleware/cors";
import type { Request, Response, NextFunction } from "express";

function makeReq(method: string, path: string, origin?: string): Partial<Request> {
  return {
    method,
    path,
    headers: origin ? { origin } : {},
  } as Partial<Request>;
}

function makeRes(): { res: Partial<Response>; headers: Record<string, string>; status?: number } {
  const headers: Record<string, string> = {};
  let status: number | undefined;
  const res: Partial<Response> = {
    setHeader(name: string, value: string) {
      headers[name] = value;
      return this as Response;
    },
    status(code: number) {
      status = code;
      return this as Response;
    },
    end() {
      return this as Response;
    },
  };
  return { res, headers, get status() { return status; } };
}

describe("CORS middleware", () => {
  const UI_ORIGIN = "https://dashboard.example.com";

  beforeEach(() => {
    process.env.UI_ORIGIN = UI_ORIGIN;
  });

  afterEach(() => {
    delete process.env.UI_ORIGIN;
  });

  it("UI origin receives Access-Control-Allow-Origin on GET routes", () => {
    const req = makeReq("GET", "/api/runs", UI_ORIGIN);
    const { res, headers } = makeRes();
    const next: NextFunction = () => {};
    corsMiddleware(req as Request, res as Response, next);
    expect(headers["Access-Control-Allow-Origin"]).toBe(UI_ORIGIN);
  });

  it("UI origin receives Access-Control-Allow-Origin on PATCH routes", () => {
    const req = makeReq("PATCH", "/api/runs/123", UI_ORIGIN);
    const { res, headers } = makeRes();
    const next: NextFunction = () => {};
    corsMiddleware(req as Request, res as Response, next);
    expect(headers["Access-Control-Allow-Origin"]).toBe(UI_ORIGIN);
  });

  it("ingestion route rejects CORS preflight (OPTIONS) — 204 with no Allow-Origin", () => {
    const req = makeReq("OPTIONS", "/api/runs", UI_ORIGIN);
    const { res, headers } = makeRes();
    let ended = false;
    (res as any).end = () => { ended = true; return res; };
    const next: NextFunction = () => {};
    corsMiddleware(req as Request, res as Response, next);
    expect(headers["Access-Control-Allow-Origin"]).toBeUndefined();
    expect(ended).toBe(true);
  });

  it("request with no Origin header is passed through on ingestion route", () => {
    const req = makeReq("POST", "/api/runs");
    const { res, headers } = makeRes();
    let nextCalled = false;
    const next: NextFunction = () => { nextCalled = true; };
    corsMiddleware(req as Request, res as Response, next);
    expect(nextCalled).toBe(true);
    expect(headers["Access-Control-Allow-Origin"]).toBeUndefined();
  });
});
