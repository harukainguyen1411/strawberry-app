import { appendFile } from "node:fs/promises";
import { config } from "./config.js";

export type TriageOutcome = "filed" | "deduped" | "quota" | "parse_error" | "api_error";

export interface TriageLogEntry {
  ts: string;
  discord_user: string;
  discord_channel: string;
  discord_message_id: string;
  message_preview: string;
  outcome: TriageOutcome;
  issue_url: string | null;
  dupe_of: number | null;
  gemini_calls_today: number;
  duration_ms: number;
}

export async function logTriage(entry: TriageLogEntry): Promise<void> {
  const line = JSON.stringify(entry) + "\n";
  // Always log to stdout (Cloud Run picks this up)
  process.stdout.write(line);
  // Optionally persist to a file
  if (config.log.path) {
    await appendFile(config.log.path, line).catch((err) =>
      console.error("Failed to write log entry:", err),
    );
  }
}
