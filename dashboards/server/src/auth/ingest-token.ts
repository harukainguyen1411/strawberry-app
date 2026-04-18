import { timingSafeEqual } from "crypto";
import type { RequestHandler } from "express";

const BUF_SIZE = 64;

export const ingestTokenMiddleware: RequestHandler = (req, res, next) => {
  const header = req.headers["authorization"];
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: { code: "MISSING_TOKEN", message: "Bearer token required" } });
    return;
  }

  const token = header.slice(7);
  const expected = process.env.INGEST_TOKEN ?? "";

  if (!expected) {
    res.status(500).json({ error: { code: "SERVER_MISCONFIGURED", message: "INGEST_TOKEN not set" } });
    return;
  }

  // Reject tokens that exceed BUF_SIZE bytes — silent truncation would allow
  // tokens sharing a 64-byte prefix to pass the constant-time compare.
  if (Buffer.byteLength(token, "utf8") > BUF_SIZE || Buffer.byteLength(expected, "utf8") > BUF_SIZE) {
    res.status(401).json({ error: { code: "INVALID_TOKEN", message: "Invalid token" } });
    return;
  }

  // Constant-time compare — pad both to BUF_SIZE so length does not leak.
  const tokenBuf = Buffer.alloc(BUF_SIZE);
  const expectedBuf = Buffer.alloc(BUF_SIZE);
  tokenBuf.write(token, 0, "utf8");
  expectedBuf.write(expected, 0, "utf8");

  if (!timingSafeEqual(tokenBuf, expectedBuf)) {
    res.status(401).json({ error: { code: "INVALID_TOKEN", message: "Invalid token" } });
    return;
  }

  next();
};
