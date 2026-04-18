import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import lockfile from "proper-lockfile";
import { config } from "./config.js";
import { log } from "./log.js";

const LOCK_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes max wait
const RETRY_INTERVAL_MS = 5000;

/**
 * Ensure the lock file and its parent directory exist.
 */
async function ensureLockFile(): Promise<void> {
  await mkdir(dirname(config.runlock.path), { recursive: true });
  try {
    await writeFile(config.runlock.path, "", { flag: "wx" }); // create if not exists
  } catch {
    // already exists — fine
  }
}

/**
 * Acquire the shared runlock. Retries until acquired or timeout.
 * Returns a release function.
 */
export async function acquireRunlock(): Promise<() => Promise<void>> {
  await ensureLockFile();
  const deadline = Date.now() + LOCK_TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      const release = await lockfile.lock(config.runlock.path, {
        stale: 5 * 60 * 1000, // consider stale after 5 min (process crash recovery)
        retries: 0,
      });
      log("Runlock acquired");
      return async () => {
        await release();
        log("Runlock released");
      };
    } catch {
      log(`Runlock busy, retrying in ${RETRY_INTERVAL_MS / 1000}s...`);
      await sleep(RETRY_INTERVAL_MS);
    }
  }

  throw new Error(`Failed to acquire runlock within ${LOCK_TIMEOUT_MS / 1000}s`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
