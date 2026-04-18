// xfail: B3 — signed URL helpers (plans/approved/2026-04-17-test-dashboard-phase1-tasks.md)
import { describe, it } from "vitest";

describe("signed URL helpers", () => {
  it.fails("upload URL expiry is at most 15 minutes from creation", () => {
    throw new Error("not implemented — GCS mock not wired");
  });

  it.fails("upload URL path matches runs/<run_id>/<case_id>/<artifactId>-<kind>.<ext>", () => {
    throw new Error("not implemented — GCS mock not wired");
  });

  it.fails("upload URL includes Content-Type constraint", () => {
    throw new Error("not implemented — GCS mock not wired");
  });
});
