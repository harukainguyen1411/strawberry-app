import { appendFile } from "node:fs/promises";
import { config } from "./config.js";

export interface BeeLogEntry {
  ts: string;
  job_id: string;
  user_id: string;
  outcome: "done" | "claude_error" | "docx_error" | "storage_error" | "lock_timeout" | "skip" | "failed";
  result_storage_uri: string | null;
  transcript_storage_uri: string | null;
  duration_ms: number;
  token_cost: number | null;
  tool_calls: number | null;
  error?: string;
}

export async function logEntry(entry: BeeLogEntry): Promise<void> {
  const line = JSON.stringify(entry) + "\n";
  process.stdout.write(line);
  if (config.log.path) {
    await appendFile(config.log.path, line).catch((err) =>
      console.error("Failed to write log entry:", err),
    );
  }
}

export function log(msg: string): void {
  console.log(`[bee-worker] ${new Date().toISOString()} ${msg}`);
}
