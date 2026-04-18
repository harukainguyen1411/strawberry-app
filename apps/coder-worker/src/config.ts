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
    targetRepo: optional("TRIAGE_TARGET_REPO", "Duongntd/myapps"),
  },
  poll: {
    intervalSeconds: Number(optional("POLL_INTERVAL_SECONDS", "60")),
    maxConcurrentJobs: Number(optional("MAX_CONCURRENT_JOBS", "1")),
  },
  runlock: {
    // Shared with Bee worker — same file, same library
    path: optional(
      "RUNLOCK_PATH",
      resolve(homedir(), ".claude-runlock", "claude.lock"),
    ),
  },
  claude: {
    maxTurns: Number(optional("CLAUDE_MAX_TURNS", "25")),
    // Path to system prompt file — located at apps/coder-worker/system-prompt.md
    systemPromptPath: optional(
      "SYSTEM_PROMPT_PATH",
      resolve(process.cwd(), "apps", "coder-worker", "system-prompt.md"),
    ),
    // Audit log dir: outside repo tree and outside Claude's --add-dir scope.
    // Default: %USERPROFILE%\coder-worker\var\logs\ (Windows) or ~/coder-worker/var/logs/ (POSIX)
    auditLogDir: optional(
      "AUDIT_LOG_DIR",
      resolve(homedir(), "coder-worker", "var", "logs"),
    ),
  },
  log: {
    path: optional("LOG_PATH", ""),
  },
} as const;
