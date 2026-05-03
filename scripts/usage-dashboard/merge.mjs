#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';

const { values: args } = parseArgs({
  strict: false,
  options: {
    sessions:     { type: 'string' },
    blocks:       { type: 'string' },
    daily:        { type: 'string' },
    'phase-scan': { type: 'string' },
    projects:     { type: 'string' },
    plans:        { type: 'string' },
    out:          { type: 'string' },
  },
});

for (const k of ['sessions', 'blocks', 'daily', 'phase-scan', 'projects', 'plans', 'out']) {
  if (!args[k]) { process.stderr.write(`--${k} required\n`); process.exit(1); }
}

const CUTOVER = process.env.CUTOVER_DATE || '2026-04-28';

const sessions  = load(args.sessions);
const blocks    = load(args.blocks);
const daily     = load(args.daily);
const phaseScan = load(args['phase-scan']);
const projects  = load(args.projects);
const plans     = load(args.plans);

assertKey(sessions, 'sessions');
assertKey(blocks,   'blocks');
assertKey(daily,    'daily');
assertKey(phaseScan,'records');
assertKey(projects, 'projects');
assertKey(plans,    'plans');

// ── Grid: bucket phase-scan records by project / phase / plan ────────────────

const grid = { byProject: {} };
for (const r of phaseScan.records) {
  const project = r.projectSlug ?? '(unscoped)';
  const plan    = r.planSlug    ?? '(unscoped)';
  const phase   = r.phase       ?? '(unphased)';
  ensure(grid.byProject, project, () => ({ byPhase: {}, total: { tokens: 0, durationSec: 0, sessions: new Set() }, byPlan: {} }));
  const proj = grid.byProject[project];
  ensure(proj.byPhase, phase, () => ({ tokens: 0, durationSec: 0, sessions: new Set() }));
  ensure(proj.byPlan, plan, () => ({ byPhase: {}, total: { tokens: 0, durationSec: 0, sessions: new Set() } }));
  ensure(proj.byPlan[plan].byPhase, phase, () => ({ tokens: 0, durationSec: 0, sessions: new Set() }));

  proj.byPhase[phase].tokens                        += r.tokens;
  proj.byPhase[phase].durationSec                   += r.durationSec;
  proj.byPhase[phase].sessions.add(r.sessionId);
  proj.total.tokens                                 += r.tokens;
  proj.total.durationSec                            += r.durationSec;
  proj.total.sessions.add(r.sessionId);
  proj.byPlan[plan].byPhase[phase].tokens           += r.tokens;
  proj.byPlan[plan].byPhase[phase].durationSec      += r.durationSec;
  proj.byPlan[plan].byPhase[phase].sessions.add(r.sessionId);
  proj.byPlan[plan].total.tokens                    += r.tokens;
  proj.byPlan[plan].total.durationSec               += r.durationSec;
  proj.byPlan[plan].total.sessions.add(r.sessionId);
}

function unsetify(obj) {
  if (obj instanceof Set) return obj.size;
  if (Array.isArray(obj)) return obj.map(unsetify);
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k] = unsetify(v);
    return out;
  }
  return obj;
}

const gridSerialized = unsetify(grid);

// ── perRepo: derived from phaseScan.records via cwd ──────────────────────────
// ccusage sessions.json uses project-path slugs as sessionId (not JSONL UUIDs),
// so a join against r.sessionId is always a miss. Derive everything from records.

const perRepoMap = {};
for (const r of phaseScan.records) {
  const repo = repoFromCwd(r.cwd);
  ensure(perRepoMap, repo, () => ({ tokens: 0, durationSec: 0, sessions: new Set() }));
  perRepoMap[repo].tokens      += r.tokens;
  perRepoMap[repo].durationSec += r.durationSec;
  perRepoMap[repo].sessions.add(r.sessionId);
}

// perRepo is derived entirely from phaseScan.records (via cwd).
// ccusage sessions.json is NOT joined here because its sessionId values are
// project-path slugs, not JSONL UUIDs, so a join against r.sessionId always
// misses. Token totals from ccusage would also double-count what's in records.

const perRepo = Object.entries(perRepoMap).map(([repo, v]) => ({
  repo,
  tokens:      v.tokens,
  durationSec: v.durationSec,
  sessions:    v.sessions.size,
}));

// ── Sparkline: per-day per-project from phase-scan record timestamps ──────────
// Build a date → { projectSlug → tokens } map from records, then overlay the
// last-14-days date list from ccusage daily output.

const byDateProject = {};
for (const r of phaseScan.records) {
  if (!r.timestamp) continue;
  const date = r.timestamp.slice(0, 10); // YYYY-MM-DD
  ensure(byDateProject, date, () => ({}));
  const p = r.projectSlug ?? '(unscoped)';
  byDateProject[date][p] = (byDateProject[date][p] ?? 0) + r.tokens;
}

const last14 = daily.daily.slice(-14);
const sparkline = last14.map(d => ({
  date:      d.date,
  byProject: byDateProject[d.date] ?? {},
}));

// ── Sessions output ───────────────────────────────────────────────────────────

// ccusage's session.sessionId is a project-path slug (the encoded JSONL parent
// directory): "/Users/foo/bar" → "-Users-foo-bar". Phase-scan records carry
// real JSONL UUIDs as sessionId and the actual cwd. To attribute a ccusage
// session to a (projectSlug, planSlug) we group phase-scan records by the
// ccusage-shape key derived from each record's cwd, then take the
// most-frequent (projectSlug, planSlug) tuple within that group. A single
// ccusage session spans many JSONL transcripts on the same cwd, so picking
// the modal attribution is the right call.
function ccusageProjectKey(cwd) {
  if (!cwd) return null;
  return '-' + cwd.replace(/^\//, '').replace(/\//g, '-');
}

const ccusageAttribution = {};
for (const r of phaseScan.records) {
  const key = ccusageProjectKey(r.cwd);
  if (!key) continue;
  if (!ccusageAttribution[key]) ccusageAttribution[key] = new Map();
  const counts = ccusageAttribution[key];
  const subKey = JSON.stringify([r.projectSlug ?? null, r.planSlug ?? null]);
  counts.set(subKey, (counts.get(subKey) ?? 0) + 1);
}

function bestAttribution(group) {
  if (!group) return { projectSlug: null, planSlug: null };
  let best = null, bestCount = -1;
  for (const [k, v] of group.entries()) {
    if (v > bestCount) { bestCount = v; best = JSON.parse(k); }
  }
  return { projectSlug: best?.[0] ?? null, planSlug: best?.[1] ?? null };
}

const sessionsOut = sessions.sessions.map(s => {
  const attr = bestAttribution(ccusageAttribution[s.sessionId]);
  return {
    sessionId:   s.sessionId,
    cwd:         s.cwd         ?? null,
    projectSlug: attr.projectSlug,
    planSlug:    attr.planSlug,
    tokensIn:    s.inputTokens         ?? 0,
    tokensOut:   s.outputTokens        ?? 0,
    cacheRead:   s.cacheReadTokens     ?? 0,
    cacheCreate: s.cacheCreationTokens ?? 0,   // real field name from ccusage
    cost:        s.totalCost           ?? 0,
    model:       s.model               ?? null,
    startedAt:   s.startTime           ?? null,
  };
});

const unphasedCount = (gridSerialized.byProject['(unscoped)']?.byPhase?.['(unphased)']?.sessions) ?? 0;

const activeBlock = blocks.blocks.find(b => b.isActive) ?? blocks.blocks[blocks.blocks.length - 1] ?? null;
const windowOut = activeBlock ? {
  startTime:   activeBlock.startTime,
  endTime:     activeBlock.endTime,
  inputTokens: activeBlock.tokenCounts?.inputTokens ?? 0,
  outputTokens: activeBlock.tokenCounts?.outputTokens ?? 0,
  totalCost:   activeBlock.costUSD ?? 0,
} : null;

const out = {
  schemaVersion: 2,
  generatedAt:   new Date().toISOString(),
  cutoverDate:   CUTOVER,
  window:        windowOut,
  grid:          gridSerialized,
  perRepo,
  sparkline,
  sessions:      sessionsOut,
  plans:         plans.plans,
  projects:      projects.projects,
  unphasedCount,
};

mkdirSync(dirname(args.out), { recursive: true });
writeFileSync(args.out, JSON.stringify(out, null, 2) + '\n');

const tot = Object.values(gridSerialized.byProject).reduce((a, p) => a + p.total.tokens, 0);
process.stdout.write(`data.json written: ${sessionsOut.length} sessions, ${Object.keys(gridSerialized.byProject).length} projects, ${tot} tokens -> ${args.out}\n`);

function load(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')); }
  catch (e) { process.stderr.write(`load fail ${path}: ${e.message}\n`); process.exit(1); }
}
function assertKey(obj, key) {
  if (!(key in obj)) { process.stderr.write(`schema: missing ${key}\n`); process.exit(1); }
}
function ensure(obj, key, factory) {
  if (!(key in obj)) obj[key] = factory();
}
function repoFromCwd(cwd) {
  if (!cwd) return '(unknown)';
  if (cwd.includes('Documents/Personal/strawberry-app')) return 'strawberry-app';
  if (cwd.includes('Documents/Personal/strawberry-agents')) return 'strawberry-agents';
  if (cwd.includes('Documents/Personal/raspberry')) return 'raspberry';
  if (cwd.includes('Documents/Personal/strawberry')) return 'strawberry';
  const mmp = cwd.match(/Documents\/Work\/mmp\/([^/]+)/);
  if (mmp) return `work/mmp/${mmp[1]}`;
  return '(other)';
}

