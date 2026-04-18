// xfail: plan plans/approved/2026-04-19-claude-usage-dashboard-tasks.md T4
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { execSync } from 'node:child_process';

const REPO_ROOT = new URL('../../', import.meta.url).pathname.replace(/\/$/, '');
const BUILD_SH = join(REPO_ROOT, 'scripts/usage-dashboard/build.sh');

// Minimal ccusage JSON outputs
const SESSIONS_JSON = JSON.stringify({
  totals: { inputTokens: 10, outputTokens: 5, cacheReadTokens: 0, cacheWriteTokens: 0, totalCost: 0.001 },
  sessions: [{ sessionId: 'test1', model: 'claude-sonnet-4-6', startTime: '2026-04-01T10:00:00Z', inputTokens: 10, outputTokens: 5, cacheReadTokens: 0, cacheWriteTokens: 0, totalCost: 0.001 }],
});
const BLOCKS_JSON = JSON.stringify({
  window: { startTime: '2026-04-19T00:00:00Z', endTime: '2026-04-19T05:00:00Z', inputTokens: 10, outputTokens: 5, totalCost: 0.001 },
});
const DAILY_JSON = JSON.stringify({
  daily: [{ date: '2026-04-01', inputTokens: 10, outputTokens: 5, totalCost: 0.001 }],
});
const AGENTS_JSON = JSON.stringify({
  sessions: [{ sessionId: 'test1', agent: 'Evelynn', project: 'strawberry', cwd: '/home', firstSeen: '2026-04-01T10:00:00Z' }],
  unknowns: [],
  generatedAt: '2026-04-19T00:00:00Z',
});
const ROSTER_JSON = JSON.stringify({
  agents: [{ name: 'Evelynn', role: 'coordinator' }],
  generatedAt: '2026-04-19T00:00:00Z',
});

function makeShim(dir, name, exitCode, stdout = '') {
  const shimPath = join(dir, name);
  writeFileSync(shimPath, `#!/bin/sh\nprintf '%s' '${stdout.replace(/'/g, "'\\''")}'\nexit ${exitCode}\n`);
  execSync(`chmod +x ${shimPath}`);
  return shimPath;
}

function runBuild(env, opts = {}) {
  return execSync(`bash ${BUILD_SH}`, { stdio: 'pipe', env: { PATH: process.env.PATH, ...env }, ...opts });
}

test('mock ccusage shim producing fixture JSON runs end-to-end and produces valid data.json', { todo: 'xfail — build.sh not yet implemented' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'build-t1-'));
  const cacheDir = mkdtempSync(join(tmpdir(), 'build-cache-'));
  const outDir = mkdtempSync(join(tmpdir(), 'build-out-'));
  try {
    writeFileSync(join(outDir, 'roster.json'), ROSTER_JSON);

    // ccusage shim: prints correct fixture JSON to stdout based on subcommand
    const sessionsEsc = SESSIONS_JSON.replace(/'/g, "'\\''");
    const blocksEsc   = BLOCKS_JSON.replace(/'/g, "'\\''");
    const dailyEsc    = DAILY_JSON.replace(/'/g, "'\\''");
    const ccusageShim = join(dir, 'ccusage');
    writeFileSync(ccusageShim, [
      '#!/bin/sh',
      `case "$1" in`,
      `  session) printf '%s' '${sessionsEsc}' ;;`,
      `  blocks)  printf '%s' '${blocksEsc}' ;;`,
      `  daily)   printf '%s' '${dailyEsc}' ;;`,
      `esac`,
      'exit 0',
    ].join('\n') + '\n');
    execSync(`chmod +x ${ccusageShim}`);

    const emptyProjects = mkdtempSync(join(tmpdir(), 'build-projects-'));
    const dataOut = join(outDir, 'data.json');
    runBuild({
      PATH: `${dir}:${process.env.PATH}`,
      USAGE_CACHE_DIR: cacheDir,
      DASHBOARD_DIR: outDir,
      CLAUDE_PROJECTS_DIR: emptyProjects,
      HOME: homedir(),
      REPO_ROOT,
    });
    rmSync(emptyProjects, { recursive: true, force: true });

    assert.ok(existsSync(dataOut), 'data.json should exist');
    const data = JSON.parse(readFileSync(dataOut, 'utf8'));
    assert.equal(data.schemaVersion, 1);
    assert.ok(Array.isArray(data.sessions));
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(cacheDir, { recursive: true, force: true });
    rmSync(outDir, { recursive: true, force: true });
  }
});

test('mock ccusage returning non-zero exits non-zero and does not clobber existing data.json', { todo: 'xfail — build.sh not yet implemented' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'build-t2-'));
  const cacheDir = mkdtempSync(join(tmpdir(), 'build-cache-'));
  const outDir = mkdtempSync(join(tmpdir(), 'build-out-'));
  try {
    const existing = JSON.stringify({ schemaVersion: 1, generatedAt: 'ORIGINAL', sessions: [], daily: [], roster: [], window: {}, unknownCount: 0 });
    writeFileSync(join(outDir, 'data.json'), existing);
    writeFileSync(join(outDir, 'roster.json'), ROSTER_JSON);

    const ccusageShim = join(dir, 'ccusage');
    writeFileSync(ccusageShim, '#!/bin/sh\nexit 1\n');
    execSync(`chmod +x ${ccusageShim}`);

    let threw = false;
    try {
      runBuild({ PATH: `${dir}:${process.env.PATH}`, USAGE_CACHE_DIR: cacheDir, DASHBOARD_DIR: outDir, REPO_ROOT });
    } catch {
      threw = true;
    }
    assert.ok(threw, 'build.sh should exit non-zero');

    // data.json must not be clobbered
    const data = JSON.parse(readFileSync(join(outDir, 'data.json'), 'utf8'));
    assert.equal(data.generatedAt, 'ORIGINAL', 'existing data.json must not be overwritten on failure');
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(cacheDir, { recursive: true, force: true });
    rmSync(outDir, { recursive: true, force: true });
  }
});

test('missing ccusage binary prints install hint and exits non-zero', { todo: 'xfail — build.sh not yet implemented' }, () => {
  const emptyDir = mkdtempSync(join(tmpdir(), 'build-t3-'));
  try {
    let threw = false;
    let output = '';
    try {
      // PATH has system utils (bash, node, sh) but no ccusage
      // Strip any dir that contains ccusage from PATH to guarantee the binary is absent
      const safePath = (process.env.PATH || '').split(':')
        .filter(p => { try { return !existsSync(join(p, 'ccusage')); } catch { return true; } })
        .join(':');
      runBuild({ PATH: `${emptyDir}:${safePath}`, REPO_ROOT, HOME: homedir() });
    } catch (err) {
      threw = true;
      output = err.stderr?.toString() + (err.stdout?.toString() || '');
    }
    assert.ok(threw, 'should exit non-zero');
    assert.ok(
      output.toLowerCase().includes('ccusage') || output.toLowerCase().includes('install'),
      `should print install hint, got: ${output}`
    );
  } finally {
    rmSync(emptyDir, { recursive: true, force: true });
  }
});
