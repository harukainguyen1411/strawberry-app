import fs from "fs/promises";
import path from "path";

const STATE_DIR = path.resolve(process.cwd(), "state");
const AUDIT_FILE = path.join(STATE_DIR, "approval-audit.log");

export interface AuditEntry {
  timestamp: string;
  pr_number: number;
  repo: string;
  actor: string;
  action: "merge" | "close";
  message_id: string;
}

export async function appendAudit(entry: AuditEntry): Promise<void> {
  await fs.mkdir(STATE_DIR, { recursive: true });
  await fs.appendFile(AUDIT_FILE, JSON.stringify(entry) + "\n", "utf-8");
}
