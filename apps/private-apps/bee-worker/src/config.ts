import "dotenv/config";
import { resolve } from "node:path";
import { homedir } from "node:os";

function required(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const config = {
  github: {
    token: required("GITHUB_TOKEN"),
    repo: optional("GITHUB_REPO", process.env.GITHUB_REPOSITORY ?? ""),
  },
  poll: {
    intervalMs: Number(optional("BEE_POLL_INTERVAL_MS", "30000")),
  },
  firebase: {
    storageBucket: required("BEE_STORAGE_BUCKET"),
  },
  runlock: {
    path: optional(
      "BEE_RUNLOCK_PATH",
      resolve(homedir(), ".claude-runlock", "claude.lock"),
    ),
  },
  claude: {
    bin: optional("BEE_CLAUDE_BIN", "claude"),
    systemPromptPath: optional(
      "BEE_SYSTEM_PROMPT_PATH",
      resolve(process.cwd(), "apps", "private-apps", "bee-worker", "system-prompt.md"),
    ),
    jobTimeoutMs: Number(optional("BEE_JOB_TIMEOUT_MS", "1500000")),
    auditLogDir: optional(
      "BEE_AUDIT_LOG_DIR",
      resolve(homedir(), "bee-audit"),
    ),
  },
  python: {
    bin: optional("BEE_PYTHON_BIN", "python"),
  },
  workDir: optional("BEE_WORK_DIR", process.platform === "win32"
    ? resolve(homedir(), "AppData", "Local", "Temp", "bee")
    : "/tmp/bee"),
  sisterUid: optional("BEE_SISTER_UID", ""),
  log: {
    path: optional("BEE_LOG_PATH", ""),
  },
} as const;
