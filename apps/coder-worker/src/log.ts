import { appendFile } from "node:fs/promises";
import { config } from "./config.js";

export interface CoderLogEntry {
  ts: string;
  job_id: string;
  issue_number: number;
  issue_title: string;
  outcome: "pr_opened" | "claude_error" | "git_error" | "lock_timeout" | "skip";
  pr_url: string | null;
  branch: string | null;
  audit_log: string | null;
  duration_ms: number;
  error?: string;
}

export async function logEntry(entry: CoderLogEntry): Promise<void> {
  const line = JSON.stringify(entry) + "\n";
  process.stdout.write(line);
  if (config.log.path) {
    await appendFile(config.log.path, line).catch((err) =>
      console.error("Failed to write log entry:", err),
    );
  }
}

export function log(msg: string): void {
  console.log(`[coder-worker] ${new Date().toISOString()} ${msg}`);
}
