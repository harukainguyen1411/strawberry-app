import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fix = join(__dirname, '..', '__fixtures__', 'merge');
const mergeMjs = join(__dirname, '..', 'merge.mjs');

function runMerge(fixtureOverrides = {}, extraEnv = {}) {
  const tmp = mkdtempSync(join(tmpdir(), 'merge-'));
  const out = join(tmp, 'data.json');
  // Write any override fixtures into tmp
  const inputs = {
    sessions:    join(fix, 'sessions.json'),
    blocks:      join(fix, 'blocks.json'),
    daily:       join(fix, 'daily.json'),
    phaseScan:   join(fix, 'phase-scan.json'),
    projects:    join(fix, 'projects.json'),
    plans:       join(fix, 'plans.json'),
    ...fixtureOverrides,
  };
  const r = spawnSync('node', [
    mergeMjs,
    '--sessions',   inputs.sessions,
    '--blocks',     inputs.blocks,
    '--daily',      inputs.daily,
    '--phase-scan', inputs.phaseScan,
    '--projects',   inputs.projects,
    '--plans',      inputs.plans,
    '--out',        out,
  ], { encoding: 'utf8', env: { ...process.env, CUTOVER_DATE: '2026-04-28', ...extraEnv } });
  return { r, out, tmp };
}

test('merge: produces data.json matching golden fixture', () => {
  const { r, out, tmp } = runMerge();
  try {
    assert.equal(r.status, 0, r.stderr);
    const got      = JSON.parse(readFileSync(out, 'utf8'));
    const expected = JSON.parse(readFileSync(join(fix, 'expected-data.json'), 'utf8'));
    delete got.generatedAt; delete expected.generatedAt;
    assert.deepEqual(got, expected);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Regression: per-repo derived from phaseScan.records cwd ──────────────────

test('regression C2: perRepo durationSec > 0 when phase-scan records have cwd', () => {
  const { r, out, tmp } = runMerge();
  try {
    assert.equal(r.status, 0, r.stderr);
    const got = JSON.parse(readFileSync(out, 'utf8'));
    const strawberry = got.perRepo.find(e => e.repo === 'strawberry-app');
    assert.ok(strawberry, 'strawberry-app entry missing from perRepo');
    assert.ok(strawberry.durationSec > 0,
      `expected durationSec > 0, got ${strawberry.durationSec}`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('regression C2: perRepo sessions count matches distinct sessionIds from phase-scan records', () => {
  const { r, out, tmp } = runMerge();
  try {
    assert.equal(r.status, 0, r.stderr);
    const got = JSON.parse(readFileSync(out, 'utf8'));
    const strawberry = got.perRepo.find(e => e.repo === 'strawberry-app');
    assert.ok(strawberry, 'strawberry-app entry missing from perRepo');
    // fixture has 2 records with same sessionId "s1" → 1 distinct session
    assert.equal(strawberry.sessions, 1);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Regression: sparkline byProject populated from phase-scan timestamps ──────

test('regression C2: sparkline byProject is not all empty', () => {
  const { r, out, tmp } = runMerge();
  try {
    assert.equal(r.status, 0, r.stderr);
    const got = JSON.parse(readFileSync(out, 'utf8'));
    const nonEmpty = got.sparkline.filter(d => Object.keys(d.byProject).length > 0);
    assert.ok(nonEmpty.length > 0, 'all sparkline byProject entries are empty');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('regression C2: sparkline multi-project uses phase-scan timestamps (two projects)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'merge-'));
  try {
    // Write a phase-scan with two projects on the same date
    const phaseScanPath = join(tmp, 'phase-scan.json');
    writeFileSync(phaseScanPath, JSON.stringify({
      records: [
        { sessionId: 's1', messageIdx: 0, phase: 'Plan', projectSlug: 'alpha', planSlug: 'p1',
          cwd: '/Users/duongntd99/Documents/Personal/strawberry-app', tokens: 100, durationSec: 10,
          timestamp: '2026-05-01T10:00:00Z', subagent: false },
        { sessionId: 's2', messageIdx: 0, phase: 'Implement', projectSlug: 'beta', planSlug: 'p2',
          cwd: '/Users/duongntd99/Documents/Personal/raspberry', tokens: 200, durationSec: 20,
          timestamp: '2026-05-01T11:00:00Z', subagent: false },
      ],
    }));
    const out = join(tmp, 'data.json');
    const r = spawnSync('node', [
      mergeMjs,
      '--sessions',   join(fix, 'sessions.json'),
      '--blocks',     join(fix, 'blocks.json'),
      '--daily',      join(fix, 'daily.json'),
      '--phase-scan', phaseScanPath,
      '--projects',   join(fix, 'projects.json'),
      '--plans',      join(fix, 'plans.json'),
      '--out',        out,
    ], { encoding: 'utf8', env: { ...process.env, CUTOVER_DATE: '2026-04-28' } });
    assert.equal(r.status, 0, r.stderr);
    const got = JSON.parse(readFileSync(out, 'utf8'));
    const day = got.sparkline.find(d => d.date === '2026-05-01');
    assert.ok(day, 'no sparkline entry for 2026-05-01');
    assert.ok(Object.keys(day.byProject).length >= 2,
      `expected >=2 projects in sparkline, got ${JSON.stringify(day.byProject)}`);
    assert.equal(day.byProject['alpha'], 100);
    assert.equal(day.byProject['beta'], 200);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Regression: cacheCreationTokens fix ──────────────────────────────────────

test('regression I1: cacheCreationTokens in sessions output (cacheCreate field) is correctly read', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'merge-'));
  try {
    // sessions.json with cacheCreationTokens = 500
    const sessPath = join(tmp, 'sessions.json');
    writeFileSync(sessPath, JSON.stringify({
      totals: { totalCost: 0.1 },
      sessions: [{
        sessionId: '-Users-duongntd99-Documents-Personal-strawberry-app',
        inputTokens: 100,
        outputTokens: 50,
        cacheReadTokens: 200,
        cacheCreationTokens: 500,
        totalCost: 0.1,
        model: 'claude-opus-4-7',
        lastActivity: '2026-05-01',
        projectPath: '-Users-duongntd99-Documents-Personal-strawberry-app',
      }],
    }));
    const out = join(tmp, 'data.json');
    const r = spawnSync('node', [
      mergeMjs,
      '--sessions',   sessPath,
      '--blocks',     join(fix, 'blocks.json'),
      '--daily',      join(fix, 'daily.json'),
      '--phase-scan', join(fix, 'phase-scan.json'),
      '--projects',   join(fix, 'projects.json'),
      '--plans',      join(fix, 'plans.json'),
      '--out',        out,
    ], { encoding: 'utf8', env: { ...process.env, CUTOVER_DATE: '2026-04-28' } });
    assert.equal(r.status, 0, r.stderr);
    const got = JSON.parse(readFileSync(out, 'utf8'));
    // sessions output must read cacheCreationTokens (not cacheWriteTokens)
    const sess = got.sessions[0];
    assert.ok(sess, 'no session in output');
    assert.equal(sess.cacheCreate, 500,
      `expected cacheCreate=500 (from cacheCreationTokens), got ${sess.cacheCreate}`);
    // perRepo tokens come from phase-scan records (not doubled from ccusage sessions)
    const strawberry = got.perRepo.find(e => e.repo === 'strawberry-app');
    assert.ok(strawberry, 'strawberry-app missing from perRepo');
    assert.equal(strawberry.tokens, 350,
      `expected perRepo tokens=350 (from phase-scan records only), got ${strawberry.tokens}`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('regression I1: cacheCreate field in sessions output uses cacheCreationTokens', () => {
  const { r, out, tmp } = runMerge();
  try {
    assert.equal(r.status, 0, r.stderr);
    const got = JSON.parse(readFileSync(out, 'utf8'));
    // fixture has cacheCreationTokens: 0 → cacheCreate should be 0 (not undefined)
    assert.ok(got.sessions.length > 0, 'no sessions in output');
    assert.equal(typeof got.sessions[0].cacheCreate, 'number',
      'cacheCreate should be a number');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Regression: cost not in grid cells ────────────────────────────────────────

test('regression C4: grid cells have no cost field (cost dropped from grid)', () => {
  const { r, out, tmp } = runMerge();
  try {
    assert.equal(r.status, 0, r.stderr);
    const got = JSON.parse(readFileSync(out, 'utf8'));
    for (const proj of Object.values(got.grid.byProject)) {
      assert.ok(!('cost' in proj.total),
        `unexpected cost in grid project total: ${JSON.stringify(proj.total)}`);
      for (const phase of Object.values(proj.byPhase)) {
        assert.ok(!('cost' in phase),
          `unexpected cost in grid byPhase: ${JSON.stringify(phase)}`);
      }
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Bucketing matrix: cwd → repo mapping pinned ─────────────────────────────
// Pins repoFromCwd's behaviour. Each case is one phase-scan record on its own
// sessionId, so each repo bucket gets exactly one session and we can read
// perRepo back as a {repo → record} map.

const BUCKETING_CASES = [
  { name: 'raspberry',                 cwd: '/Users/duongntd99/Documents/Personal/raspberry',                                      expectedRepo: 'raspberry' },
  { name: 'strawberry-app bare',       cwd: '/Users/duongntd99/Documents/Personal/strawberry-app',                                 expectedRepo: 'strawberry-app' },
  { name: 'strawberry-app worktree',   cwd: '/Users/duongntd99/Documents/Personal/strawberry-app/.worktrees/foo',                  expectedRepo: 'strawberry-app' },
  { name: 'strawberry-agents',         cwd: '/Users/duongntd99/Documents/Personal/strawberry-agents',                              expectedRepo: 'strawberry-agents' },
  { name: 'strawberry (sibling)',      cwd: '/Users/duongntd99/Documents/Personal/strawberry',                                     expectedRepo: 'strawberry' },
  { name: 'work/mmp/api',              cwd: '/Users/duongntd99/Documents/Work/mmp/api',                                            expectedRepo: 'work/mmp/api' },
  { name: 'work/mmp/workspace nested', cwd: '/Users/duongntd99/Documents/Work/mmp/workspace/some/nested/path',                     expectedRepo: 'work/mmp/workspace' },
  { name: 'random unrelated',          cwd: '/tmp/random',                                                                         expectedRepo: '(other)' },
];

for (const tc of BUCKETING_CASES) {
  test(`bucketing matrix: cwd "${tc.name}" → repo "${tc.expectedRepo}"`, () => {
    const tmp = mkdtempSync(join(tmpdir(), 'merge-'));
    try {
      const phaseScanPath = join(tmp, 'phase-scan.json');
      writeFileSync(phaseScanPath, JSON.stringify({
        records: [{
          sessionId: 's-test', messageIdx: 0, phase: 'Plan',
          projectSlug: '(unscoped)', planSlug: '(unscoped)',
          cwd: tc.cwd, tokens: 1, durationSec: 1,
          timestamp: '2026-05-01T10:00:00Z', subagent: false,
        }],
      }));
      const out = join(tmp, 'data.json');
      const r = spawnSync('node', [
        mergeMjs,
        '--sessions',   join(fix, 'sessions.json'),
        '--blocks',     join(fix, 'blocks.json'),
        '--daily',      join(fix, 'daily.json'),
        '--phase-scan', phaseScanPath,
        '--projects',   join(fix, 'projects.json'),
        '--plans',      join(fix, 'plans.json'),
        '--out',        out,
      ], { encoding: 'utf8', env: { ...process.env, CUTOVER_DATE: '2026-04-28' } });
      assert.equal(r.status, 0, r.stderr);
      const got = JSON.parse(readFileSync(out, 'utf8'));
      assert.equal(got.perRepo.length, 1,
        `expected exactly 1 perRepo entry, got ${JSON.stringify(got.perRepo)}`);
      assert.equal(got.perRepo[0].repo, tc.expectedRepo,
        `cwd "${tc.cwd}" → repo "${got.perRepo[0].repo}", expected "${tc.expectedRepo}"`);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
}

test('bucketing matrix: empty/null cwd → "(unknown)"', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'merge-'));
  try {
    const phaseScanPath = join(tmp, 'phase-scan.json');
    writeFileSync(phaseScanPath, JSON.stringify({
      records: [{
        sessionId: 's-test', messageIdx: 0, phase: 'Plan',
        projectSlug: '(unscoped)', planSlug: '(unscoped)',
        cwd: null, tokens: 1, durationSec: 1,
        timestamp: '2026-05-01T10:00:00Z', subagent: false,
      }],
    }));
    const out = join(tmp, 'data.json');
    const r = spawnSync('node', [
      mergeMjs,
      '--sessions',   join(fix, 'sessions.json'),
      '--blocks',     join(fix, 'blocks.json'),
      '--daily',      join(fix, 'daily.json'),
      '--phase-scan', phaseScanPath,
      '--projects',   join(fix, 'projects.json'),
      '--plans',      join(fix, 'plans.json'),
      '--out',        out,
    ], { encoding: 'utf8', env: { ...process.env, CUTOVER_DATE: '2026-04-28' } });
    assert.equal(r.status, 0, r.stderr);
    const got = JSON.parse(readFileSync(out, 'utf8'));
    assert.equal(got.perRepo[0].repo, '(unknown)');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
