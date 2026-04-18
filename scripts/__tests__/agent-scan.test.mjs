// xfail: plan plans/approved/2026-04-19-claude-usage-dashboard-tasks.md T2
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';

const SCRIPT = new URL('../../scripts/usage-dashboard/agent-scan.mjs', import.meta.url).pathname;

function makeEnv(overrides = {}) {
  return { ...process.env, ...overrides };
}

function makeProjectsDir(sessions) {
  const dir = mkdtempSync(join(tmpdir(), 'agent-scan-test-'));
  for (const s of sessions) {
    const projDir = join(dir, s.project || 'proj1');
    mkdirSync(projDir, { recursive: true });
    const lines = s.lines.map(l => JSON.stringify(l)).join('\n');
    writeFileSync(join(projDir, `${s.id || 'session1'}.jsonl`), lines + '\n');
  }
  return dir;
}

function makeRoster(names, dir) {
  const rosterFile = join(dir, 'roster.json');
  writeFileSync(rosterFile, JSON.stringify({ agents: names.map(n => ({ name: n, role: 'agent' })), generatedAt: new Date().toISOString() }));
  return rosterFile;
}

function runScan(projectsDir, rosterFile, cacheDir) {
  const result = execSync(`node ${SCRIPT}`, {
    env: makeEnv({
      CLAUDE_PROJECTS_DIR: projectsDir,
      ROSTER_FILE: rosterFile,
      AGENTS_OUT: join(cacheDir, 'agents.json'),
    }),
    stdio: 'pipe',
  });
  return JSON.parse(require('fs').readFileSync(join(cacheDir, 'agents.json'), 'utf8'));
}

import { readFileSync } from 'node:fs';

test('fixture JSONL with "Hey Syndra" as first user msg -> agent == "Syndra"', { todo: 'xfail — agent-scan.mjs not yet implemented' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'scan-t1-'));
  const cacheDir = mkdtempSync(join(tmpdir(), 'scan-cache-'));
  try {
    const projectsDir = makeProjectsDir([{
      id: 'sess1', project: 'proj1',
      lines: [
        { type: 'assistant', message: { content: 'hello' } },
        { type: 'user', message: { content: [{ type: 'text', text: 'Hey Syndra, please help' }] }, cwd: '/home/user' },
      ],
    }]);
    const rosterFile = makeRoster(['Syndra', 'Evelynn'], dir);
    execSync(`node ${SCRIPT}`, {
      env: makeEnv({ CLAUDE_PROJECTS_DIR: projectsDir, ROSTER_FILE: rosterFile, AGENTS_OUT: join(cacheDir, 'agents.json') }),
      stdio: 'pipe',
    });
    const out = JSON.parse(readFileSync(join(cacheDir, 'agents.json'), 'utf8'));
    const sess = out.sessions.find(s => s.sessionId === 'sess1');
    assert.equal(sess.agent, 'Syndra');
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(cacheDir, { recursive: true, force: true });
  }
});

test('fixture with "[autonomous] Orianna, proceed" -> agent == "Orianna"', { todo: 'xfail — agent-scan.mjs not yet implemented' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'scan-t2-'));
  const cacheDir = mkdtempSync(join(tmpdir(), 'scan-cache-'));
  try {
    const projectsDir = makeProjectsDir([{
      id: 'sess2', project: 'proj1',
      lines: [
        { type: 'user', message: { content: [{ type: 'text', text: '[autonomous] Orianna, start task' }] }, cwd: '/home/user' },
      ],
    }]);
    const rosterFile = makeRoster(['Orianna', 'Evelynn'], dir);
    execSync(`node ${SCRIPT}`, {
      env: makeEnv({ CLAUDE_PROJECTS_DIR: projectsDir, ROSTER_FILE: rosterFile, AGENTS_OUT: join(cacheDir, 'agents.json') }),
      stdio: 'pipe',
    });
    const out = JSON.parse(readFileSync(join(cacheDir, 'agents.json'), 'utf8'));
    const sess = out.sessions.find(s => s.sessionId === 'sess2');
    assert.equal(sess.agent, 'Orianna');
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(cacheDir, { recursive: true, force: true });
  }
});

test('fixture with no greeting -> agent == "Evelynn"', { todo: 'xfail — agent-scan.mjs not yet implemented' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'scan-t3-'));
  const cacheDir = mkdtempSync(join(tmpdir(), 'scan-cache-'));
  try {
    const projectsDir = makeProjectsDir([{
      id: 'sess3', project: 'proj1',
      lines: [
        { type: 'user', message: { content: [{ type: 'text', text: 'What time is it?' }] }, cwd: '/home/user' },
      ],
    }]);
    const rosterFile = makeRoster(['Evelynn', 'Jayce'], dir);
    execSync(`node ${SCRIPT}`, {
      env: makeEnv({ CLAUDE_PROJECTS_DIR: projectsDir, ROSTER_FILE: rosterFile, AGENTS_OUT: join(cacheDir, 'agents.json') }),
      stdio: 'pipe',
    });
    const out = JSON.parse(readFileSync(join(cacheDir, 'agents.json'), 'utf8'));
    const sess = out.sessions.find(s => s.sessionId === 'sess3');
    assert.equal(sess.agent, 'Evelynn');
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(cacheDir, { recursive: true, force: true });
  }
});

test('matched name not in roster -> agent == "unknown", rawMatch preserved', { todo: 'xfail — agent-scan.mjs not yet implemented' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'scan-t4-'));
  const cacheDir = mkdtempSync(join(tmpdir(), 'scan-cache-'));
  try {
    const projectsDir = makeProjectsDir([{
      id: 'sess4', project: 'proj1',
      lines: [
        { type: 'user', message: { content: [{ type: 'text', text: 'Hey Gandalf, please help' }] }, cwd: '/home/user' },
      ],
    }]);
    const rosterFile = makeRoster(['Evelynn', 'Jayce'], dir);
    execSync(`node ${SCRIPT}`, {
      env: makeEnv({ CLAUDE_PROJECTS_DIR: projectsDir, ROSTER_FILE: rosterFile, AGENTS_OUT: join(cacheDir, 'agents.json') }),
      stdio: 'pipe',
    });
    const out = JSON.parse(readFileSync(join(cacheDir, 'agents.json'), 'utf8'));
    const sess = out.sessions.find(s => s.sessionId === 'sess4');
    assert.equal(sess.agent, 'unknown');
    assert.ok(sess.rawMatch, 'rawMatch should be present');
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(cacheDir, { recursive: true, force: true });
  }
});

test('fixture with cwd in work/mmp -> project == "work/mmp"', { todo: 'xfail — agent-scan.mjs not yet implemented' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'scan-t5-'));
  const cacheDir = mkdtempSync(join(tmpdir(), 'scan-cache-'));
  try {
    const projectsDir = makeProjectsDir([{
      id: 'sess5', project: 'proj1',
      lines: [
        { type: 'user', message: { content: [{ type: 'text', text: 'Hello' }] }, cwd: '/Users/testuser/Documents/Work/mmp/workspace/agents/myagent' },
      ],
    }]);
    const rosterFile = makeRoster(['Evelynn'], dir);
    execSync(`node ${SCRIPT}`, {
      env: makeEnv({ CLAUDE_PROJECTS_DIR: projectsDir, ROSTER_FILE: rosterFile, AGENTS_OUT: join(cacheDir, 'agents.json') }),
      stdio: 'pipe',
    });
    const out = JSON.parse(readFileSync(join(cacheDir, 'agents.json'), 'utf8'));
    const sess = out.sessions.find(s => s.sessionId === 'sess5');
    assert.equal(sess.project, 'work/mmp');
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(cacheDir, { recursive: true, force: true });
  }
});

test('perf: 100 fixture JSONLs scan in <1000ms', { todo: 'xfail — agent-scan.mjs not yet implemented' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'scan-t6-'));
  const cacheDir = mkdtempSync(join(tmpdir(), 'scan-cache-'));
  try {
    const sessions = Array.from({ length: 100 }, (_, i) => ({
      id: `sess${i}`, project: `proj${i % 5}`,
      lines: [
        { type: 'user', message: { content: [{ type: 'text', text: 'Hey Evelynn, task ' + i }] }, cwd: '/home/user' },
      ],
    }));
    const projectsDir = makeProjectsDir(sessions);
    const rosterFile = makeRoster(['Evelynn', 'Jayce'], dir);
    const start = Date.now();
    execSync(`node ${SCRIPT}`, {
      env: makeEnv({ CLAUDE_PROJECTS_DIR: projectsDir, ROSTER_FILE: rosterFile, AGENTS_OUT: join(cacheDir, 'agents.json') }),
      stdio: 'pipe',
    });
    const elapsed = Date.now() - start;
    assert.ok(elapsed < 1000, `scan took ${elapsed}ms, expected <1000ms`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(cacheDir, { recursive: true, force: true });
  }
});
