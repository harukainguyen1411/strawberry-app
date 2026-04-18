import { Request, Response, NextFunction } from "express";

// Routes where browser (UI) access is allowed.
const UI_ALLOWED_METHODS = new Set(["GET", "HEAD", "OPTIONS", "PATCH"]);

// Ingestion path check — matches both POST and OPTIONS preflight to ingestion paths.
// GET /api/runs is a read endpoint and IS allowed from the browser (not ingestion).
function isIngestionPath(path: string): boolean {
  if (path === "/api/runs" || path === "/api/v1/runs") return true;
  if (/^\/api\/(v1\/)?runs\/[^/]+\/finalize$/.test(path)) return true;
  return false;
}

function isIngestionRoute(method: string, path: string): boolean {
  return (method === "POST" || method === "OPTIONS") && isIngestionPath(path);
}

export function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers["origin"];
  const uiOrigin = process.env.UI_ORIGIN ?? "";

  if (isIngestionRoute(req.method, req.path)) {
    // Ingestion routes are server-to-server only — refuse CORS preflight.
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    // Non-preflight requests with no Origin header pass through normally.
    next();
    return;
  }

  // UI routes: allow the configured origin for allowed methods.
  if (origin && uiOrigin && origin === uiOrigin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, PATCH, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    res.setHeader("Access-Control-Max-Age", "86400");
  }

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  next();
}
