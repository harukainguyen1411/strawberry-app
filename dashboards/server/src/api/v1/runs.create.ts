// POST /api/v1/runs — ADR §4 declare-then-upload ingestion contract:
// 1. Caller POSTs run + cases + artifact_uploads[] (declarations, not blobs).
// 2. This handler writes Run, Case, and Artifact docs in a single Firestore batch,
//    generates V4 signed GCS upload URLs per declared artifact, and returns them.
// 3. Caller PUTs each artifact directly to GCS using the signed URL.
// 4. Caller POSTs /finalize (D3) to flip the run to its terminal status.
// D1 (scripts/report-run.sh) is the primary caller; artifact_uploads are optional
// and currently unused by D1 — the field is accepted for when D1b wires them.
// xfail ref: it.fails seeds in dadcb4e, flipped in 85011e6 (TDD rule 12 ✓)
import { Router } from "express";
import { ulid } from "ulid";
import { Timestamp } from "firebase-admin/firestore";
import { ingestTokenMiddleware } from "../../auth/ingest-token.js";
import { runs, cases, artifacts, db } from "../../data/firestore.js";
import { createUploadUrl } from "../../storage/signed-urls.js";
import type {
  RunType,
  Environment,
  RunStatus,
  CaseStatus,
  ArtifactKind,
  TriggerSource,
} from "../../data/schema.js";

const VALID_RUN_TYPES = new Set<RunType>([
  "unit",
  "xfail",
  "regression",
  "e2e",
  "qa",
  "smoke",
]);

interface ArtifactUploadRequest {
  local_ref: string;
  case_id?: string;
  kind: ArtifactKind;
  mime: string;
  size_bytes: number;
}

interface CaseInput {
  suite: string;
  name: string;
  status: CaseStatus;
  duration_ms: number;
  failure_message?: string | null;
  failure_stack?: string | null;
  artifacts?: string[];
}

interface RunInput {
  type: RunType;
  environment: Environment;
  project?: string | null;
  git_sha: string;
  git_ref: string;
  version?: string | null;
  actor: string;
  started_at: string;
  finished_at: string;
  status: RunStatus;
  counts: {
    total: number;
    pass: number;
    fail: number;
    skipped: number;
    xfail: number;
  };
  trigger: {
    source: TriggerSource;
    workflow?: string | null;
    pr_number?: number | null;
  };
  metadata?: Record<string, unknown>;
}

interface CreateRunBody {
  run: RunInput;
  cases: CaseInput[];
  artifact_uploads?: ArtifactUploadRequest[];
}

export const runsCreateRouter = Router();

runsCreateRouter.post(
  "/",
  ingestTokenMiddleware,
  async (req, res) => {
    const body = req.body as CreateRunBody;

    if (!body?.run || !body?.cases) {
      res.status(400).json({
        error: { code: "INVALID_BODY", message: "run and cases are required" },
      });
      return;
    }

    const { run: runInput, cases: casesInput, artifact_uploads = [] } = body;

    if (!VALID_RUN_TYPES.has(runInput.type)) {
      res.status(400).json({
        error: {
          code: "UNKNOWN_TYPE",
          message: `Unknown run type: ${runInput.type}. Must be one of: ${[...VALID_RUN_TYPES].join(", ")}`,
        },
      });
      return;
    }

    // Firestore batch cap: 500 writes total.
    // Writes: 1 run + N cases + M artifact sets + M' case-backfill updates (M' ≤ M).
    // Worst case: 1 + cases + 2 * artifacts. Reject before building the batch.
    const FIRESTORE_BATCH_LIMIT = 500;
    const estimatedWrites = 1 + casesInput.length + 2 * artifact_uploads.length;
    if (estimatedWrites > FIRESTORE_BATCH_LIMIT) {
      res.status(400).json({
        error: {
          code: "TOO_MANY_WRITES",
          message: `Batch size (1 + ${casesInput.length} cases + 2×${artifact_uploads.length} artifacts = ${estimatedWrites}) exceeds Firestore 500-write limit`,
        },
      });
      return;
    }

    const runId = `run_${ulid()}`;
    const now = Timestamp.now();

    const batch = db().batch();

    const runRef = runs().doc(runId);
    batch.set(runRef, {
      id: runId,
      type: runInput.type,
      environment: runInput.environment,
      project: runInput.project ?? null,
      git_sha: runInput.git_sha,
      git_ref: runInput.git_ref,
      version: runInput.version ?? null,
      actor: runInput.actor,
      started_at: runInput.started_at
        ? Timestamp.fromDate(new Date(runInput.started_at))
        : now,
      finished_at: runInput.finished_at
        ? Timestamp.fromDate(new Date(runInput.finished_at))
        : now,
      status: runInput.status,
      counts: runInput.counts,
      trigger: {
        source: runInput.trigger.source,
        workflow: runInput.trigger.workflow ?? null,
        pr_number: runInput.trigger.pr_number ?? null,
      },
      metadata: runInput.metadata ?? {},
    });

    // Assign server-side case IDs and track them for artifact backfill.
    const caseIds: string[] = [];
    for (let i = 0; i < casesInput.length; i++) {
      const c = casesInput[i];
      const caseId = `case_${ulid()}`;
      caseIds.push(caseId);
      const caseRef = cases().doc(caseId);
      batch.set(caseRef, {
        id: caseId,
        run_id: runId,
        suite: c.suite,
        name: c.name,
        status: c.status,
        duration_ms: c.duration_ms,
        failure_message: c.failure_message ?? null,
        failure_stack: c.failure_stack?.slice(0, 8192) ?? null,
        artifacts: [],
      });
    }

    // Pre-assign artifact IDs so we can write Artifact docs in the same batch
    // and backfill case.artifacts before committing. Signed URLs are generated
    // after the batch (GCS call is out-of-band from Firestore).
    interface ArtifactEntry {
      artifactId: string;
      resolvedCaseId: string;
      upload: ArtifactUploadRequest;
    }
    const artifactEntries: ArtifactEntry[] = artifact_uploads.map((a) => ({
      artifactId: `artifact_${ulid()}`,
      resolvedCaseId: a.case_id ?? "run-level",
      upload: a,
    }));

    // Group artifact IDs by case so we can backfill case.artifacts[].
    const artifactsByCaseId: Record<string, string[]> = {};
    for (const { artifactId, resolvedCaseId } of artifactEntries) {
      (artifactsByCaseId[resolvedCaseId] ??= []).push(artifactId);
    }

    // Backfill case.artifacts and write Artifact docs (status=pending) in batch.
    for (let i = 0; i < caseIds.length; i++) {
      const caseId = caseIds[i];
      const caseArtifacts = artifactsByCaseId[caseId] ?? [];
      if (caseArtifacts.length > 0) {
        batch.update(cases().doc(caseId), { artifacts: caseArtifacts });
      }
    }

    const createdAt = Timestamp.now();
    for (const { artifactId, resolvedCaseId, upload } of artifactEntries) {
      const artifactRef = artifacts().doc(artifactId);
      batch.set(artifactRef, {
        id: artifactId,
        run_id: runId,
        case_id: resolvedCaseId === "run-level" ? null : resolvedCaseId,
        kind: upload.kind,
        storage_path: `runs/${runId}/${resolvedCaseId}/${artifactId}-${upload.kind}`,
        mime: upload.mime,
        size_bytes: upload.size_bytes,
        created_at: createdAt,
      });
    }

    // Generate signed URLs before committing the batch — if GCS is unavailable
    // the batch has not yet written, so no orphaned run is created.
    const artifact_upload_urls: Record<string, string> = {};
    await Promise.all(
      artifactEntries.map(async ({ artifactId, resolvedCaseId, upload }) => {
        const url = await createUploadUrl(
          runId,
          resolvedCaseId,
          artifactId,
          upload.kind,
          upload.mime,
          upload.size_bytes
        );
        artifact_upload_urls[upload.local_ref] = url;
      })
    );

    // Commit is the last infallible step — Run, Cases, and Artifact docs land together.
    await batch.commit();

    res.status(201).json({ run_id: runId, artifact_upload_urls });
  }
);
