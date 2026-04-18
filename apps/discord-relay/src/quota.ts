import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { config } from "./config.js";

// Per-minute token bucket: 10 RPM (free tier is 15 RPM, keeping buffer)
const RPM_LIMIT = 10;
const RPM_WINDOW_MS = 60_000;

interface QuotaState {
  date: string;
  calls: number;
}

interface TokenBucketEntry {
  ts: number;
}

const STATE_PATH = join(process.cwd(), "var", "quota-state.json");
const bucket: TokenBucketEntry[] = [];

// In-memory call count (also persisted to quota-state.json)
let _state: QuotaState = { date: utcDate(), calls: 0 };

function utcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

async function loadState(): Promise<void> {
  try {
    const raw = await readFile(STATE_PATH, "utf-8");
    const parsed: QuotaState = JSON.parse(raw);
    if (parsed.date === utcDate()) {
      _state = parsed;
    } else {
      _state = { date: utcDate(), calls: 0 };
    }
  } catch {
    _state = { date: utcDate(), calls: 0 };
  }
}

async function saveState(): Promise<void> {
  const dir = dirname(STATE_PATH);
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
  await writeFile(STATE_PATH, JSON.stringify(_state), "utf-8");
}

export async function initQuota(): Promise<void> {
  await loadState();
}

/** Returns the warning level: "ok" | "warn" | "exceeded" */
export function quotaStatus(): "ok" | "warn" | "exceeded" {
  const today = utcDate();
  if (_state.date !== today) {
    _state = { date: today, calls: 0 };
  }
  const pct = _state.calls / config.triage.dailyQuota;
  if (pct >= 1.0) return "exceeded";
  if (pct >= 0.8) return "warn";
  return "ok";
}

export function callsToday(): number {
  const today = utcDate();
  if (_state.date !== today) return 0;
  return _state.calls;
}

export async function recordCall(): Promise<void> {
  const today = utcDate();
  if (_state.date !== today) {
    _state = { date: today, calls: 0 };
  }
  _state.calls++;
  await saveState();
}

/**
 * Check per-minute rate limit via token bucket.
 * Returns true if the call is allowed, false if over-budget.
 */
export function checkRateLimit(): boolean {
  const now = Date.now();
  // Remove entries older than the window
  while (bucket.length > 0 && now - bucket[0].ts > RPM_WINDOW_MS) {
    bucket.shift();
  }
  if (bucket.length >= RPM_LIMIT) return false;
  bucket.push({ ts: now });
  return true;
}

export function quotaRemaining(): number {
  const today = utcDate();
  if (_state.date !== today) return config.triage.dailyQuota;
  return Math.max(0, config.triage.dailyQuota - _state.calls);
}
