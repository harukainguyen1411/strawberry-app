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

const sessionMap = new Map(sessions.sessions.map(s => [s.sessionId, s]));

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

const perRepo = {};
for (const s of sessions.sessions) {
  const repo = repoFromCwd(s.cwd);
  ensure(perRepo, repo, () => ({ tokens: 0, durationSec: 0, sessions: 0 }));
  perRepo[repo].tokens   += (s.inputTokens ?? 0) + (s.outputTokens ?? 0) + (s.cacheReadTokens ?? 0) + (s.cacheWriteTokens ?? 0);
  perRepo[repo].sessions += 1;
}
for (const r of phaseScan.records) {
  const sess = sessionMap.get(r.sessionId);
  if (!sess) continue;
  const repo = repoFromCwd(sess.cwd);
  if (perRepo[repo]) perRepo[repo].durationSec += r.durationSec;
}

const last14 = daily.daily.slice(-14);
const sparkline = last14.map(d => {
  const byProject = {};
  for (const r of phaseScan.records) {
    const sess = sessionMap.get(r.sessionId);
    if (!sess?.startTime?.startsWith(d.date)) continue;
    const p = r.projectSlug ?? '(unscoped)';
    byProject[p] = (byProject[p] ?? 0) + r.tokens;
  }
  return { date: d.date, byProject };
});

const sessionsOut = sessions.sessions.map(s => ({
  sessionId:   s.sessionId,
  cwd:         s.cwd         ?? null,
  tokensIn:    s.inputTokens     ?? 0,
  tokensOut:   s.outputTokens    ?? 0,
  cacheRead:   s.cacheReadTokens ?? 0,
  cacheCreate: s.cacheWriteTokens ?? 0,
  cost:        s.totalCost       ?? 0,
  model:       s.model           ?? null,
  startedAt:   s.startTime       ?? null,
}));

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
  perRepo:       Object.entries(perRepo).map(([repo, v]) => ({ repo, ...v })),
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
  if (cwd.includes('Documents/Work/mmp')) return 'work/mmp';
  return '(other)';
}
