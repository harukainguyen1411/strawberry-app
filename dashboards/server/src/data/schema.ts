import type { Timestamp } from "firebase-admin/firestore";

export type RunType = "unit" | "xfail" | "regression" | "e2e" | "qa" | "smoke";
export type Environment = "local" | "ci" | "staging" | "prod";
export type RunStatus = "pass" | "fail" | "error" | "skipped";
export type CaseStatus = "pass" | "fail" | "error" | "skipped" | "xfail" | "xpass";
export type ArtifactKind = "screenshot" | "video" | "trace" | "design-diff" | "log";
export type TriggerSource = "pre-commit" | "gh-actions" | "post-deploy" | "manual";

export interface RunCounts {
  total: number;
  pass: number;
  fail: number;
  skipped: number;
  xfail: number;
}

export interface RunTrigger {
  source: TriggerSource;
  workflow: string | null;
  pr_number: number | null;
}

export interface Run {
  id: string;
  type: RunType;
  environment: Environment;
  project: string | null;
  git_sha: string;
  git_ref: string;
  version: string | null;
  actor: string;
  started_at: Timestamp;
  finished_at: Timestamp;
  status: RunStatus;
  counts: RunCounts;
  trigger: RunTrigger;
  pin?: boolean;
  metadata: Record<string, unknown>;
}

export interface Case {
  id: string;
  run_id: string;
  suite: string;
  name: string;
  status: CaseStatus;
  duration_ms: number;
  failure_message: string | null;
  failure_stack: string | null;
  artifacts: string[];
}

export interface Artifact {
  id: string;
  run_id: string;
  case_id: string | null;
  kind: ArtifactKind;
  storage_path: string;
  mime: string;
  size_bytes: number;
  created_at: Timestamp;
}
