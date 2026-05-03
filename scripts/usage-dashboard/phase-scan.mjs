#!/usr/bin/env node
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, basename, resolve } from 'node:path';
import { homedir } from 'node:os';

const SKILL_TO_PHASE = Object.freeze({
  'superpowers-extended-cc:brainstorming':                  'Brainstorm',
  'superpowers-extended-cc:brainstorm':                     'Brainstorm',
  'superpowers:brainstorming':                              'Brainstorm',
  'superpowers:brainstorm':                                 'Brainstorm',
  'superpowers-extended-cc:writing-plans':                  'Plan',
  'superpowers:writing-plans':                              'Plan',
  'superpowers-extended-cc:subagent-driven-development':    'Implement',
  'superpowers:subagent-driven-development':                'Implement',
  'superpowers-extended-cc:executing-plans':                'Implement',
  'superpowers:executing-plans':                            'Implement',
  'superpowers-extended-cc:test-driven-development':        'Implement',
  'superpowers:test-driven-development':                    'Implement',
  'superpowers-extended-cc:requesting-code-review':         'Review',
  'superpowers:requesting-code-review':                     'Review',
  'superpowers-extended-cc:verification-before-completion': 'Verify',
  'superpowers:verification-before-completion':             'Verify',
  'superpowers-extended-cc:systematic-debugging':           'Debug',
  'superpowers:systematic-debugging':                       'Debug',
  'superpowers-extended-cc:finishing-a-development-branch': 'Finish',
  'superpowers:finishing-a-development-branch':             'Finish',
});

const SUBAGENT_TYPE_TO_PHASE = Object.freeze({
  'code-reviewer': 'Review',
  'Explore':       '(unphased)',
});

const IDLE_CAP_SEC = Number(process.env.IDLE_CAP_SEC ?? 600);

function getToolUses(record) {
  const content = record?.message?.content;
  if (!Array.isArray(content)) return [];
  return content.filter(b => b?.type === 'tool_use');
}

function getUsageTokens(record) {
  const u = record?.message?.usage ?? {};
  return {
    input:       u.input_tokens                 ?? 0,
    output:      u.output_tokens                ?? 0,
    cacheRead:   u.cache_read_input_tokens      ?? 0,
    cacheCreate: u.cache_creation_input_tokens  ?? 0,
  };
}

const totalTokens = t => t.input + t.output + t.cacheRead + t.cacheCreate;

function diffSec(a, b) {
  if (!a || !b) return 0;
  const A = Date.parse(a), B = Date.parse(b);
  if (isNaN(A) || isNaN(B)) return 0;
  return Math.max(0, Math.round((B - A) / 1000));
}

function isPlaywrightTool(name) {
  return typeof name === 'string' && name.startsWith('mcp__plugin_playwright_playwright__');
}

function readJsonlLines(path) {
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter(l => l.trim())
    .map(l => {
      try { return JSON.parse(l); } catch { return null; }
    })
    .filter(Boolean);
}

// ── Project + plan attribution ────────────────────────────────────────────────

/**
 * Extract all tool_use file paths from Read/Edit/Write/MultiEdit tool calls
 * across an array of records (any type).
 *
 * Returns an array of file path strings (may include duplicates — callers use
 * frequency counting).
 */
function extractToolUsePaths(records) {
  const paths = [];
  for (const rec of records) {
    const content = rec?.message?.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (block?.type !== 'tool_use') continue;
      const name = block?.name;
      if (!['Read', 'Edit', 'Write', 'MultiEdit'].includes(name)) continue;
      const fp = block?.input?.file_path ?? block?.input?.path ?? null;
      if (typeof fp === 'string' && fp) paths.push(fp);
    }
  }
  return paths;
}

/**
 * Given an array of file paths, find the most-frequently-referenced plan slug
 * that exists in plansIndex. Returns { planSlug, projectSlug } or null.
 *
 * Path pattern recognised:
 *   <raspberryDir>/plans/<concern>/<state>[/<project-slug>]/<filename>.md
 *
 * The plan slug is matched against plansIndex by slug. Tie-break: lexicographic.
 *
 * @param {string[]} filePaths
 * @param {Record<string, object>} plansIndex  slug → plan object
 * @param {string} raspberryDir
 */
function findPlanFromPaths(filePaths, plansIndex, raspberryDir) {
  // Build frequency map: planSlug → count
  const freq = {};
  const raspberryDirNorm = raspberryDir.replace(/\/$/, '');

  for (const fp of filePaths) {
    // Normalise path separators
    const normFp = fp.replace(/\\/g, '/');
    const normRd = raspberryDirNorm.replace(/\\/g, '/');

    // Must be under raspberryDir/plans/
    const prefix = `${normRd}/plans/`;
    if (!normFp.startsWith(prefix)) continue;

    // Extract filename without extension as a candidate slug
    const rel = normFp.slice(prefix.length);   // e.g. personal/active/example/2026-04-30-projected.md
    const parts = rel.split('/');
    if (parts.length < 3) continue;            // need at least concern/state/filename

    const fileBaseName = parts[parts.length - 1];
    if (!fileBaseName.endsWith('.md')) continue;
    const fileStem = fileBaseName.slice(0, -3);

    // Try matching fileStem directly against plansIndex (slug = fileStem)
    if (plansIndex[fileStem]) {
      freq[fileStem] = (freq[fileStem] ?? 0) + 1;
    }
  }

  // Find max frequency, tie-break lexicographic
  let bestSlug = null;
  let bestFreq = 0;
  for (const [slug, count] of Object.entries(freq)) {
    if (count > bestFreq || (count === bestFreq && (bestSlug === null || slug < bestSlug))) {
      bestSlug = slug;
      bestFreq = count;
    }
  }

  if (!bestSlug) return null;
  const plan = plansIndex[bestSlug];
  return {
    planSlug:    plan.slug,
    projectSlug: plan.project ?? '(unscoped)',
  };
}

/**
 * Resolve projectSlug + planSlug for a session.
 *
 * Algorithm (per spec §4 and task instructions):
 *   1. Worktree match: cwd ends with `.worktrees/<plan-slug>` — look up last
 *      path segment in plansIndex.
 *   2. Raspberry-dir: cwd === raspberryDir — scan tool_use paths for plan refs.
 *   3. Bare product-repo: cwd matches a known product repo — scan tool_use paths.
 *   4. Else: (unscoped).
 *
 * @param {string}  cwd
 * @param {object[]} records        All records from the JSONL (for tool_use scanning)
 * @param {Record<string,object>} projectsIndex  slug → project
 * @param {Record<string,object>} plansIndex     slug → plan
 * @param {string}  raspberryDir
 * @param {Record<string,string>} [productPathMap]  productName → absolutePath (for tests)
 * @returns {{ projectSlug: string, planSlug: string }}
 */
export function resolveProject(cwd, records, projectsIndex, plansIndex, raspberryDir, productPathMap) {
  const unscoped = { projectSlug: '(unscoped)', planSlug: '(unscoped)' };
  if (!cwd) return unscoped;

  const normCwd = cwd.replace(/\\/g, '/').replace(/\/$/, '');
  const normRd  = (raspberryDir ?? '').replace(/\\/g, '/').replace(/\/$/, '');

  // ── Step 1: Worktree match ─────────────────────────────────────────────────
  // cwd must contain "/.worktrees/" somewhere in the path
  const worktreeSep = '/.worktrees/';
  const wtIdx = normCwd.lastIndexOf(worktreeSep);
  if (wtIdx !== -1) {
    // Everything after .worktrees/ is the worktree path; last segment is the plan slug
    const afterWorktrees = normCwd.slice(wtIdx + worktreeSep.length);
    // Could be "plan-slug" or "concern/plan-slug" — try last segment first
    const segments = afterWorktrees.split('/').filter(Boolean);
    for (let i = segments.length - 1; i >= 0; i--) {
      const candidate = segments[i];
      if (plansIndex[candidate]) {
        const plan = plansIndex[candidate];
        return {
          projectSlug: plan.project ?? '(unscoped)',
          planSlug:    plan.slug,
        };
      }
    }
    // No match in plans — worktree but unrecognised slug
    return unscoped;
  }

  // ── Step 2: Raspberry-dir cwd ──────────────────────────────────────────────
  if (normRd && normCwd === normRd) {
    const toolPaths = extractToolUsePaths(records);
    const found = findPlanFromPaths(toolPaths, plansIndex, raspberryDir);
    if (found) return found;
    return unscoped;
  }

  // ── Step 3: Bare product-repo cwd ──────────────────────────────────────────
  // Build a set of known product-repo absolute paths from projectsIndex.
  // In production these come from an optional PRODUCT_REPOS env var or from
  // deriving the path via the project's product name + standard layout roots.
  // For the product-path resolution we accept an optional productPathMap arg
  // (used in tests) or fall back to a standard derivation.
  const productPaths = buildProductPaths(projectsIndex, productPathMap);
  if (productPaths.has(normCwd)) {
    const toolPaths = extractToolUsePaths(records);
    const found = findPlanFromPaths(toolPaths, plansIndex, raspberryDir);
    if (found) return found;
    return unscoped;
  }

  // ── Step 4: Unscoped ───────────────────────────────────────────────────────
  return unscoped;
}

/**
 * Build a Set of absolute product-repo paths from projectsIndex.
 *
 * In tests, callers supply productPathMap: { productName → absolutePath }.
 * In production, we derive paths from PRODUCT_REPOS env var (JSON map) or
 * fall back to standard layout: ~/Documents/Personal/<product> and
 * ~/Documents/Work/mmp/<product>.
 */
function buildProductPaths(projectsIndex, productPathMap) {
  const paths = new Set();

  // Explicit override (tests or PRODUCT_REPOS env var)
  if (productPathMap && typeof productPathMap === 'object') {
    for (const absPath of Object.values(productPathMap)) {
      if (typeof absPath === 'string') paths.add(absPath.replace(/\\/g, '/').replace(/\/$/, ''));
    }
    return paths;
  }

  // Production: try PRODUCT_REPOS env var first
  if (process.env.PRODUCT_REPOS) {
    try {
      const map = JSON.parse(process.env.PRODUCT_REPOS);
      for (const absPath of Object.values(map)) {
        if (typeof absPath === 'string') paths.add(absPath.replace(/\\/g, '/').replace(/\/$/, ''));
      }
      return paths;
    } catch { /* fall through */ }
  }

  // Production fallback: derive from standard layout roots
  const home = homedir().replace(/\\/g, '/');
  const productNames = new Set();
  for (const proj of Object.values(projectsIndex)) {
    if (proj.product) productNames.add(proj.product);
  }
  for (const name of productNames) {
    // Personal: ~/Documents/Personal/<product>
    paths.add(`${home}/Documents/Personal/${name}`);
    // Work: ~/Documents/Work/mmp/<product>
    paths.add(`${home}/Documents/Work/mmp/${name}`);
  }
  return paths;
}

function resolveSidechainPath(parentFilePath, sessionId, agentId) {
  const dir = dirname(parentFilePath);
  const stem = basename(parentFilePath, '.jsonl');

  // Fixture/test layout: <dir>/<stem>.subagents/agent-<agentId>.jsonl
  const fixturePath = join(dir, `${stem}.subagents`, `agent-${agentId}.jsonl`);
  if (existsSync(fixturePath)) return fixturePath;

  // Production layout: <dir>/<sessionId>/subagents/agent-<agentId>.jsonl
  const prodPath = join(dir, sessionId, 'subagents', `agent-${agentId}.jsonl`);
  if (existsSync(prodPath)) return prodPath;

  return null;
}

/**
 * Scan a JSONL file and return an array of per-message attribution records.
 *
 * @param {string} filePath
 * @param {object} [opts]
 * @param {Record<string,object>} [opts.projectsIndex]  slug → project
 * @param {Record<string,object>} [opts.plansIndex]     slug → plan
 * @param {string} [opts.raspberryDir]
 * @param {Record<string,string>} [opts.productPathMap] productName → absPath (tests only)
 */
export async function scanJsonl(filePath, opts = {}) {
  const { projectsIndex = {}, plansIndex = {}, raspberryDir = '', productPathMap } = opts;

  const sessionId = basename(filePath, '.jsonl');
  const records = readJsonlLines(filePath);
  const out = [];
  let currentSkill = null;
  let playwrightSeenParent = false;
  let prevEmittedTs = null;
  let messageIdx = 0;

  // Resolve project + plan once per session: find first record with a non-null cwd
  let sessionCwd = null;
  for (const rec of records) {
    if (rec?.cwd) { sessionCwd = rec.cwd; break; }
  }
  const { projectSlug, planSlug } = resolveProject(
    sessionCwd, records, projectsIndex, plansIndex, raspberryDir, productPathMap,
  );

  for (let i = 0; i < records.length; i++) {
    const rec = records[i];
    if (rec.type !== 'assistant') continue;

    const toolUses = getToolUses(rec);

    // Update currentSkill and playwrightSeenParent BEFORE attributing this record
    for (const t of toolUses) {
      if (t.name === 'Skill' && typeof t.input?.skill === 'string') {
        currentSkill = t.input.skill;
      }
      if (isPlaywrightTool(t.name)) {
        playwrightSeenParent = true;
      }
    }

    const tokens = getUsageTokens(rec);
    const phase = playwrightSeenParent ? 'Verify' : (SKILL_TO_PHASE[currentSkill] ?? '(unphased)');
    const durationSec = Math.min(diffSec(prevEmittedTs, rec.timestamp), IDLE_CAP_SEC);

    out.push({
      sessionId,
      messageIdx: messageIdx++,
      phase,
      projectSlug,
      planSlug,
      cwd: sessionCwd ?? null,
      tokens: totalTokens(tokens),
      tokensBreakdown: tokens,
      durationSec,
      subagent: false,
    });
    prevEmittedTs = rec.timestamp ?? prevEmittedTs;

    // Walk Agent dispatches: the agentId is on the NEXT matching user record's toolUseResult
    for (const t of toolUses) {
      if (t.name !== 'Agent') continue;

      let agentId = null;
      let agentType = t.input?.subagent_type ?? null;

      // Find the next user record that carries a toolUseResult with an agentId
      // matching by tool_use_id (t.id) if available, else first match
      for (let j = i + 1; j < records.length; j++) {
        const nxt = records[j];
        if (nxt.type !== 'user') continue;
        if (!nxt.toolUseResult?.agentId) continue;

        const blocks = Array.isArray(nxt.message?.content) ? nxt.message.content : [];
        const matched = t.id
          ? blocks.some(b => b.tool_use_id === t.id)
          : true; // no id to match on — take first

        if (matched) {
          agentId   = nxt.toolUseResult.agentId;
          agentType = nxt.toolUseResult.agentType ?? agentType;
          break;
        }
      }

      if (!agentId) continue;

      const sidechainPath = resolveSidechainPath(filePath, sessionId, agentId);
      if (!sidechainPath) {
        process.stderr.write(`warn: sidechain not found for agentId=${agentId} (parent=${filePath})\n`);
        continue;
      }

      // Walk sidechain with a fresh Playwright flag; initial phase from subagent type or current skill
      const subRecs = readJsonlLines(sidechainPath);
      let subPlaywrightSeen = false;
      const initialPhase = SUBAGENT_TYPE_TO_PHASE[agentType] ?? SKILL_TO_PHASE[currentSkill] ?? '(unphased)';

      for (const sr of subRecs) {
        if (sr.type !== 'assistant') continue;

        const subToolUses = getToolUses(sr);
        for (const st of subToolUses) {
          if (isPlaywrightTool(st.name)) subPlaywrightSeen = true;
        }

        const subTokens = getUsageTokens(sr);
        const subPhase = subPlaywrightSeen ? 'Verify' : initialPhase;
        const subDuration = Math.min(diffSec(prevEmittedTs, sr.timestamp), IDLE_CAP_SEC);

        out.push({
          sessionId,
          messageIdx: messageIdx++,
          phase: subPhase,
          projectSlug,
          planSlug,
          cwd: sessionCwd ?? null,
          tokens: totalTokens(subTokens),
          tokensBreakdown: subTokens,
          durationSec: subDuration,
          subagent: true,
        });
        prevEmittedTs = sr.timestamp ?? prevEmittedTs;
      }
    }
  }

  return out;
}

// CLI entrypoint
function* walkJsonl(dir) {
  let entries;
  try { entries = readdirSync(dir); } catch { return; }
  for (const entry of entries) {
    const full = join(dir, entry);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) {
      // Skip sidechain subdirectories — they are walked via parent Agent dispatch
      if (entry === 'subagents' || entry.endsWith('.subagents')) continue;
      yield* walkJsonl(full);
    } else if (entry.endsWith('.jsonl')) {
      yield full;
    }
  }
}

function parseCliArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--projects' && argv[i + 1]) { args.projects = argv[++i]; }
    else if (argv[i] === '--plans' && argv[i + 1]) { args.plans = argv[++i]; }
  }
  return args;
}

const isCli = import.meta.url === `file://${process.argv[1]}`;
if (isCli) {
  const cliArgs = parseCliArgs(process.argv.slice(2));

  const claudeProjectsDir = process.env.CLAUDE_PROJECTS_DIR || join(homedir(), '.claude', 'projects');
  const out = process.env.PHASE_SCAN_OUT || join(homedir(), '.claude', 'raspberry-usage-cache', 'phase-scan.json');

  // Resolve RASPBERRY_DIR: env var > standard location
  const raspberryDir = process.env.RASPBERRY_DIR ||
    join(homedir(), 'Documents', 'Personal', 'raspberry');

  // Resolve projects.json and plans.json paths:
  //   CLI flags > env vars > defaults relative to raspberry dashboards dir
  const defaultDashDir = join(raspberryDir, 'dashboards', 'usage-dashboard');
  const projectsPath = cliArgs.projects ||
    process.env.PROJECTS_JSON ||
    join(defaultDashDir, 'projects.json');
  const plansPath = cliArgs.plans ||
    process.env.PLANS_JSON ||
    join(defaultDashDir, 'plans.json');

  // Load registries (best-effort — degrade gracefully if missing)
  let projectsIndex = {};
  let plansIndex = {};
  try {
    const pj = JSON.parse(readFileSync(projectsPath, 'utf8'));
    for (const p of (pj.projects ?? [])) projectsIndex[p.slug] = p;
  } catch (e) {
    process.stderr.write(`warn: could not load projects.json (${projectsPath}): ${e.message}\n`);
  }
  try {
    const pj = JSON.parse(readFileSync(plansPath, 'utf8'));
    for (const p of (pj.plans ?? [])) plansIndex[p.slug] = p;
  } catch (e) {
    process.stderr.write(`warn: could not load plans.json (${plansPath}): ${e.message}\n`);
  }

  const scanOpts = { projectsIndex, plansIndex, raspberryDir };

  const all = [];
  for (const fp of walkJsonl(claudeProjectsDir)) {
    try {
      const recs = await scanJsonl(fp, scanOpts);
      all.push(...recs);
    } catch (e) {
      process.stderr.write(`warn: ${fp}: ${e.message}\n`);
    }
  }
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ records: all, generatedAt: new Date().toISOString() }, null, 2) + '\n');
  process.stdout.write(`phase-scan.json written: ${all.length} records → ${out}\n`);
}
