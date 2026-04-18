// xfail: plan plans/approved/2026-04-19-claude-usage-dashboard-tasks.md T1
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const SCRIPT = new URL('../../scripts/usage-dashboard/generate-roster.mjs', import.meta.url).pathname;

function makeFixtureRepo(agents) {
  const dir = mkdtempSync(join(tmpdir(), 'roster-test-'));
  const agentsDir = join(dir, 'agents', 'memory');
  mkdirSync(agentsDir, { recursive: true });
  const rows = agents.map(a => `| **${a.name}** | ${a.role} |`).join('\n');
  writeFileSync(join(agentsDir, 'agent-network.md'), `# Agent Network\n\n| Agent | Role |\n|---|---|\n${rows}\n`);
  return dir;
}

test('given fixture agent-network.md with 3 agents, output contains exactly those 3 names', { todo: 'xfail — generate-roster.mjs not yet implemented' }, () => {
  const agents = [
    { name: 'Alpha', role: 'planner' },
    { name: 'Beta', role: 'executor' },
    { name: 'Gamma', role: 'reviewer' },
  ];
  const repoDir = makeFixtureRepo(agents);
  const outDir = mkdtempSync(join(tmpdir(), 'roster-out-'));
  const outFile = join(outDir, 'roster.json');
  try {
    execSync(`node ${SCRIPT}`, {
      env: { ...process.env, STRAWBERRY_AGENTS_REPO: repoDir, ROSTER_OUT: outFile },
    });
    const roster = JSON.parse(readFileSync(outFile, 'utf8'));
    const names = roster.agents.map(a => a.name);
    assert.equal(names.length, 3);
    assert.ok(names.includes('Alpha'));
    assert.ok(names.includes('Beta'));
    assert.ok(names.includes('Gamma'));
  } finally {
    rmSync(repoDir, { recursive: true, force: true });
    rmSync(outDir, { recursive: true, force: true });
  }
});

test('missing input file exits non-zero with readable error', { todo: 'xfail — generate-roster.mjs not yet implemented' }, () => {
  let threw = false;
  try {
    execSync(`node ${SCRIPT}`, {
      env: { ...process.env, STRAWBERRY_AGENTS_REPO: '/nonexistent/path/xyz' },
      stdio: 'pipe',
    });
  } catch (err) {
    threw = true;
    const output = err.stderr?.toString() || err.stdout?.toString() || '';
    assert.ok(output.length > 0, 'should print a readable error');
  }
  assert.ok(threw, 'should exit non-zero');
});

test('generatedAt is a parseable ISO string', { todo: 'xfail — generate-roster.mjs not yet implemented' }, () => {
  const agents = [{ name: 'Zeta', role: 'helper' }];
  const repoDir = makeFixtureRepo(agents);
  const outDir = mkdtempSync(join(tmpdir(), 'roster-out-'));
  const outFile = join(outDir, 'roster.json');
  try {
    execSync(`node ${SCRIPT}`, {
      env: { ...process.env, STRAWBERRY_AGENTS_REPO: repoDir, ROSTER_OUT: outFile },
    });
    const roster = JSON.parse(readFileSync(outFile, 'utf8'));
    const d = new Date(roster.generatedAt);
    assert.ok(!isNaN(d.getTime()), 'generatedAt should be valid ISO date');
  } finally {
    rmSync(repoDir, { recursive: true, force: true });
    rmSync(outDir, { recursive: true, force: true });
  }
});
