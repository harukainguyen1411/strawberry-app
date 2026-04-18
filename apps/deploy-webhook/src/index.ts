import "dotenv/config";
import express, { Request, Response } from "express";
import { createHmac, timingSafeEqual } from "crypto";
import { spawn } from "child_process";
import { existsSync, writeFileSync, unlinkSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const PORT = parseInt(process.env.DEPLOY_WEBHOOK_PORT ?? "9000", 10);
const WEBHOOK_SECRET = process.env.DEPLOY_WEBHOOK_SECRET ?? "";

if (!WEBHOOK_SECRET) {
  console.error("[deploy-webhook] FATAL: DEPLOY_WEBHOOK_SECRET is not set.");
  process.exit(1);
}

if (!process.env.DEPLOY_REPO_ROOT) {
  console.error("[deploy-webhook] FATAL: DEPLOY_REPO_ROOT is not set.");
  process.exit(1);
}

const REPO_ROOT = process.env.DEPLOY_REPO_ROOT;
const LOCK_FILE = join(REPO_ROOT, "deploy.lock");
const DEPLOY_SCRIPT = join(REPO_ROOT, "scripts", "windows", "deploy-all.ps1");

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let lastDeployAt: string | null = null;
const startedAt = new Date().toISOString();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function verifySignature(rawBody: Buffer, signature: string): boolean {
  const expected = "sha256=" + createHmac("sha256", WEBHOOK_SECRET).update(rawBody).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

function log(msg: string): void {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

const LOCK_STALE_MS = 10 * 60 * 1000; // 10 minutes

function isLockStale(): boolean {
  try {
    const contents = readFileSync(LOCK_FILE, "utf8").trim();
    // Format: "<pid>:<isoTimestamp>"
    const sep = contents.indexOf(":");
    if (sep === -1) return false; // old-format lock — treat as non-stale to be safe
    const ts = contents.slice(sep + 1);
    const age = Date.now() - new Date(ts).getTime();
    return age > LOCK_STALE_MS;
  } catch {
    return false;
  }
}

function spawnDeploy(): void {
  if (existsSync(LOCK_FILE)) {
    if (isLockStale()) {
      log("Stale lock file detected (older than 10 minutes) — removing and proceeding.");
      try { unlinkSync(LOCK_FILE); } catch { /* already gone */ }
    } else {
      log("Deploy already in progress — skipping. Next push will pick up all changes.");
      return;
    }
  }

  // Write lock before spawning (includes timestamp for stale detection)
  try {
    writeFileSync(LOCK_FILE, `${process.pid}:${new Date().toISOString()}`, { flag: "wx" });
  } catch {
    log("Race on lock file — another deploy started concurrently, skipping.");
    return;
  }

  log(`Spawning deploy: powershell -File ${DEPLOY_SCRIPT}`);

  const child = spawn(
    "powershell",
    ["-ExecutionPolicy", "Bypass", "-File", DEPLOY_SCRIPT],
    {
      cwd: REPO_ROOT,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    }
  );

  child.stdout?.on("data", (chunk: Buffer) => {
    process.stdout.write(`[deploy-all] ${chunk.toString()}`);
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    process.stderr.write(`[deploy-all] ${chunk.toString()}`);
  });

  child.on("exit", (code) => {
    lastDeployAt = new Date().toISOString();
    try { unlinkSync(LOCK_FILE); } catch { /* already gone */ }
    log(`Deploy finished with exit code ${code ?? "null"}`);
  });

  child.on("error", (err) => {
    lastDeployAt = new Date().toISOString();
    try { unlinkSync(LOCK_FILE); } catch { /* already gone */ }
    log(`Deploy spawn error: ${err.message}`);
  });

  child.unref();
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
const app = express();

// Raw body needed for HMAC verification
app.use(
  express.raw({ type: "application/json", limit: "1mb" })
);

// Health check
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    startedAt,
    lastDeployAt,
    deployInProgress: existsSync(LOCK_FILE),
  });
});

// Webhook endpoint
app.post("/webhook", (req: Request, res: Response) => {
  const sig = req.headers["x-hub-signature-256"];
  const event = req.headers["x-github-event"];

  if (typeof sig !== "string" || !sig) {
    log("Missing x-hub-signature-256 header — rejected");
    res.status(401).json({ error: "missing signature" });
    return;
  }

  const rawBody = req.body as Buffer;
  if (!verifySignature(rawBody, sig)) {
    log("Invalid HMAC signature — rejected");
    res.status(401).json({ error: "invalid signature" });
    return;
  }

  log(`Received valid webhook event: ${event ?? "unknown"}`);

  // Respond 200 immediately before spawning (GitHub 10-second timeout)
  res.status(200).json({ ok: true });

  // Only act on push events
  if (event !== "push") {
    log(`Ignoring non-push event: ${event}`);
    return;
  }

  let payload: { ref?: string } = {};
  try {
    payload = JSON.parse(rawBody.toString()) as { ref?: string };
  } catch {
    log("Could not parse payload JSON — skipping deploy");
    return;
  }

  if (payload.ref !== "refs/heads/main") {
    log(`Push to ${payload.ref ?? "unknown"} — not main, skipping deploy`);
    return;
  }

  spawnDeploy();
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  log(`deploy-webhook listening on port ${PORT}`);
  log(`Repo root : ${REPO_ROOT}`);
  log(`Deploy script : ${DEPLOY_SCRIPT}`);
});
