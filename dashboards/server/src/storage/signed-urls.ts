import { Storage } from "@google-cloud/storage";
import type { ArtifactKind } from "../data/schema.js";

export type { ArtifactKind };

const EXPIRY_SECONDS = 15 * 60;

const _storage = new Storage({ projectId: process.env.FIREBASE_PROJECT_ID });
function storage(): Storage { return _storage; }

function bucket(): string {
  const b = process.env.GCS_BUCKET;
  if (!b) throw new Error("GCS_BUCKET env var is required");
  return b;
}

const EXT: Record<ArtifactKind, string> = {
  screenshot: "png",
  video: "webm",
  trace: "zip",
  "design-diff": "png",
  log: "txt",
};

function objectPath(runId: string, caseId: string, artifactId: string, kind: ArtifactKind): string {
  return `runs/${runId}/${caseId}/${artifactId}-${kind}.${EXT[kind]}`;
}

export async function createUploadUrl(
  runId: string,
  caseId: string,
  artifactId: string,
  kind: ArtifactKind,
  mime: string,
  // sizeBytes reserved for future X-Goog-Content-Length-Range enforcement
  _sizeBytes: number
): Promise<string> {
  const path = objectPath(runId, caseId, artifactId, kind);
  const [url] = await storage()
    .bucket(bucket())
    .file(path)
    .getSignedUrl({
      version: "v4",
      action: "write",
      expires: Date.now() + EXPIRY_SECONDS * 1000,
      contentType: mime,
    });
  return url;
}

export async function createDownloadUrl(
  runId: string,
  caseId: string,
  artifactId: string,
  kind: ArtifactKind
): Promise<string> {
  const path = objectPath(runId, caseId, artifactId, kind);
  const [url] = await storage()
    .bucket(bucket())
    .file(path)
    .getSignedUrl({
      version: "v4",
      action: "read",
      expires: Date.now() + EXPIRY_SECONDS * 1000,
    });
  return url;
}

/** Converts a normal object path to its pinned/ equivalent for ADR §5 lifecycle exclusion. */
export function pinnedObjectPath(originalPath: string): string {
  return `pinned/${originalPath}`;
}
