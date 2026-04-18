import * as admin from "firebase-admin";
import type { Request, RequestHandler, Response, NextFunction } from "express";

export interface AuthedRequest extends Request {
  uid: string;
}

// Lazily initialise the Admin SDK once per process. Credentials come from
// GOOGLE_APPLICATION_CREDENTIALS env (set at deploy time via the encrypted bundle).
function getApp(): admin.app.App {
  if (admin.apps.length > 0) return admin.apps[0]!;
  return admin.initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
}

// ALLOWED_UIDS is a comma-separated list of Firebase UIDs permitted to use the UI.
function getAllowedUids(): Set<string> {
  const raw = process.env.ALLOWED_UIDS ?? "";
  return new Set(raw.split(",").map((s) => s.trim()).filter(Boolean));
}

export const firebaseAuthMiddleware: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const header = req.headers["authorization"];
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: { code: "MISSING_TOKEN", message: "Bearer token required" } });
    return;
  }

  const idToken = header.slice(7);

  let decoded: admin.auth.DecodedIdToken;
  try {
    decoded = await getApp().auth().verifyIdToken(idToken);
  } catch {
    res.status(401).json({ error: { code: "INVALID_TOKEN", message: "Invalid or expired ID token" } });
    return;
  }

  const allowed = getAllowedUids();
  // Fail closed — empty allowlist means no one is permitted, not everyone is.
  if (allowed.size === 0 || !allowed.has(decoded.uid)) {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "UID not in allowlist" } });
    return;
  }

  (req as AuthedRequest).uid = decoded.uid;
  next();
};
