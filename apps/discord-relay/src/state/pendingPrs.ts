import fs from "fs/promises";
import path from "path";
import { lock, unlock } from "proper-lockfile";

const STATE_DIR = path.resolve(process.cwd(), "state");
const PENDING_FILE = path.join(STATE_DIR, "pending-prs.json");
const LOCK_OPTIONS = { retries: { retries: 5, factor: 2, minTimeout: 100, maxTimeout: 2000 } };

export interface PendingPr {
  pr_number: number;
  repo: string;
  channel_id: string;
  requester: string;
  source_message_id: string;
}

export type PendingPrMap = Record<string, PendingPr>;

async function ensureStateDir(): Promise<void> {
  await fs.mkdir(STATE_DIR, { recursive: true });
}

export async function loadPendingPrs(): Promise<PendingPrMap> {
  await ensureStateDir();
  try {
    const data = await fs.readFile(PENDING_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return {};
  }
}

export async function savePendingPrs(map: PendingPrMap): Promise<void> {
  await ensureStateDir();

  // Ensure the file exists for proper-lockfile
  try {
    await fs.access(PENDING_FILE);
  } catch {
    await fs.writeFile(PENDING_FILE, "{}", "utf-8");
  }

  const release = await lock(PENDING_FILE, LOCK_OPTIONS);
  try {
    await fs.writeFile(PENDING_FILE, JSON.stringify(map, null, 2), "utf-8");
  } finally {
    await release();
  }
}

export async function removePendingPr(messageId: string): Promise<PendingPr | null> {
  const map = await loadPendingPrs();
  const entry = map[messageId] ?? null;
  if (entry) {
    delete map[messageId];
    await savePendingPrs(map);
  }
  return entry;
}
