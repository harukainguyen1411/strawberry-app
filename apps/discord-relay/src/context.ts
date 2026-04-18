import { execFile } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { promisify } from "node:util";
import { join } from "node:path";
import { config } from "./config.js";

const execFileAsync = promisify(execFile);

const INCLUDE_EXTENSIONS = new Set([
  ".md", ".ts", ".tsx", ".js", ".vue", ".json",
  ".yml", ".yaml", ".css", ".html", ".sh",
]);

const EXCLUDE_PREFIXES = [
  "node_modules/", "dist/", "build/", ".firebase/",
  "e2e/", "test-results/", ".cursor/",
];

const EXCLUDE_PATTERNS = [
  /\.lock$/,
  /\.min\./,
  /\.map$/,
];

const MAX_FILE_BYTES = 200 * 1024; // 200 KB

interface ContextCache {
  context: string;
  builtAt: number;
}

// Keyed by app name (or "__default__" for the global cache)
const _caches = new Map<string, ContextCache>();
// Tracks the builtAt timestamp of the most-recently-built cache entry across all keys.
let _lastBuiltAt: number | null = null;

/** Detect the monorepo root once and cache it. */
let _repoRoot: string | null = null;
async function getRepoRoot(): Promise<string> {
  if (_repoRoot) return _repoRoot;
  const { stdout } = await execFileAsync("git", ["rev-parse", "--show-toplevel"]);
  _repoRoot = stdout.trim();
  return _repoRoot;
}

function isCacheStale(cacheKey: string): boolean {
  const cached = _caches.get(cacheKey);
  if (!cached) return true;
  const ttlMs = config.triage.contextRefreshHours * 60 * 60 * 1000;
  return Date.now() - cached.builtAt > ttlMs;
}

export function invalidateContext(): void {
  _caches.clear();
}

export function contextCacheAgeSeconds(): number {
  if (_lastBuiltAt === null) return -1;
  return Math.floor((Date.now() - _lastBuiltAt) / 1000);
}

async function buildRepoDump(subtree: string, repoRoot: string): Promise<string> {
  // git ls-files scoped to the subtree — run from repo root for correct relative paths
  const { stdout } = await execFileAsync("git", ["ls-files", subtree], { cwd: repoRoot });
  const allPaths = stdout.split("\n").filter(Boolean);

  const parts: string[] = [];
  for (const filePath of allPaths) {
    // Extension filter
    const ext = "." + filePath.split(".").pop()!;
    if (!INCLUDE_EXTENSIONS.has(ext)) continue;

    // Exclude prefix filter (relative to subtree root)
    const relPath = filePath.startsWith(subtree + "/")
      ? filePath.slice(subtree.length + 1)
      : filePath;

    if (EXCLUDE_PREFIXES.some((prefix) => relPath.startsWith(prefix))) continue;
    if (EXCLUDE_PATTERNS.some((re) => re.test(relPath))) continue;

    // Resolve absolute path from repo root
    const absPath = join(repoRoot, filePath);

    // Size filter
    let fileSize: number;
    try {
      const info = await stat(absPath);
      fileSize = info.size;
    } catch {
      continue;
    }
    if (fileSize > MAX_FILE_BYTES) continue;

    // Read contents
    let contents: string;
    try {
      contents = await readFile(absPath, "utf-8");
    } catch {
      continue;
    }

    parts.push(`=== ${filePath} ===\n${contents}\n`);
  }

  return parts.join("\n");
}

async function fetchOpenIssues(label: string): Promise<string> {
  // Use the GitHub REST API directly with GITHUB_TOKEN from env, so we don't
  // depend on the host's `gh` CLI auth state (which may be scoped to a
  // different account). Falls back to an empty list on any failure.
  const token = process.env.GITHUB_TOKEN;
  if (!token || token === "dummy") {
    return "[]";
  }

  // Resolve owner/repo from git remote so the bot is monorepo-portable.
  let owner: string;
  let repo: string;
  try {
    const { stdout } = await execFileAsync("git", ["config", "--get", "remote.origin.url"]);
    const url = stdout.trim();
    const match = url.match(/[:/]([^/]+)\/([^/.]+?)(?:\.git)?$/);
    if (!match) throw new Error(`could not parse remote: ${url}`);
    owner = match[1];
    repo = match[2];
  } catch (err) {
    console.error("Failed to resolve repo coords:", err);
    return "[]";
  }

  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/issues?state=open&labels=${encodeURIComponent(label)}&per_page=50`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "strawberry-discord-relay",
      },
    });
    if (!res.ok) {
      console.error(`GitHub issues fetch failed: ${res.status} ${res.statusText}`);
      return "[]";
    }
    const issues = (await res.json()) as Array<{
      number: number;
      title: string;
      body: string | null;
      labels: Array<string | { name: string }>;
      pull_request?: unknown;
    }>;
    const truncated = issues
      .filter((i) => !i.pull_request)
      .map((i) => ({
        number: i.number,
        title: i.title,
        body: (i.body ?? "").slice(0, 500),
        labels: i.labels.map((l) => (typeof l === "string" ? l : l.name)),
      }));
    return JSON.stringify(truncated, null, 2);
  } catch (err) {
    console.error("Failed to fetch open issues:", err);
    return "[]";
  }
}

async function readTriageContext(subtree: string, repoRoot: string): Promise<string> {
  const contextPath = join(repoRoot, subtree, "triage-context.md");
  try {
    return await readFile(contextPath, "utf-8");
  } catch {
    return `# ${subtree} — triage context\n\n[triage-context.md not found — add it to ${subtree}/triage-context.md]\n`;
  }
}

/**
 * Load triage context, optionally scoped to a specific app.
 * When `app` is provided, uses `apps/{app}` subtree and `app:{app}` label.
 * Falls back to config defaults (TRIAGE_TARGET_SUBTREE / TRIAGE_TARGET_LABEL).
 */
export async function loadContext(app?: string): Promise<string> {
  const cacheKey = app ?? "__default__";
  const cached = _caches.get(cacheKey);
  if (!isCacheStale(cacheKey) && cached) return cached.context;

  const subtree = app ? `apps/${app}` : config.triage.targetSubtree;
  const label = app ? `app:${app}` : config.triage.targetLabel;
  const repoRoot = await getRepoRoot();

  console.log(`Building context cache for subtree=${subtree} label=${label} repoRoot=${repoRoot}`);
  const start = Date.now();

  const [triageCtx, repoDump, openIssues] = await Promise.all([
    readTriageContext(subtree, repoRoot),
    buildRepoDump(subtree, repoRoot),
    fetchOpenIssues(label),
  ]);

  // Check size — Gemini 2.0 Flash 1M token context, rough chars-per-token ~3
  const combined = triageCtx + "\n---\n# Open Issues Snapshot\n" + openIssues +
    "\n---\n# Repository Dump\n" + repoDump;

  const estimatedTokens = Math.ceil(combined.length / 3);
  if (estimatedTokens > 900_000) {
    console.warn(
      `Context too large (~${estimatedTokens} tokens). Falling back to minimal context.`,
    );
    const minimal = triageCtx + "\n---\n# Open Issues Snapshot\n" + openIssues +
      "\n---\n# Repository Dump\n[degraded context mode: repo dump omitted due to size]\n";
    const entry = { context: minimal, builtAt: Date.now() };
    _caches.set(cacheKey, entry);
    _lastBuiltAt = entry.builtAt;
    return minimal;
  }

  const entry = { context: combined, builtAt: Date.now() };
  _caches.set(cacheKey, entry);
  _lastBuiltAt = entry.builtAt;

  console.log(
    `Context built in ${Date.now() - start}ms, ~${estimatedTokens} estimated tokens`,
  );
  return entry.context;
}
