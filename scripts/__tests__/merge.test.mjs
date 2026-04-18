// xfail: plan plans/approved/2026-04-19-claude-usage-dashboard-tasks.md T3
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';

const SCRIPT = new URL('../../scripts/usage-dashboard/merge.mjs', import.meta.url).pathname;

function run(args, opts = {}) {
  return execSync(`node ${SCRIPT} ${args}`, { stdio: 'pipe', ...opts });
}

function makeTmp() {
  return mkdtempSync(join(tmpdir(), 'merge-test-'));
}

// Minimal golden fixtures
const SESSIONS_FIXTURE = {
  totals: { inputTokens: 100, outputTokens: 50, cacheReadTokens: 10, cacheWriteTokens: 5, totalCost: 0.002 },
  sessions: [
    { sessionId: 'abc123', model: 'claude-opus-4-7', startTime: '2026-04-01T10:00:00Z', inputTokens: 60, outputTokens: 30, cacheReadTokens: 10, cacheWriteTokens: 5, totalCost: 0.001 },
    { sessionId: 'def456', model: 'claude-sonnet-4-6', startTime: '2026-04-02T11:00:00Z', inputTokens: 40, outputTokens: 20, cacheReadTokens: 0, cacheWriteTokens: 0, totalCost: 0.001 },
  ],
};

const BLOCKS_FIXTURE = {
  window: { startTime: '2026-04-19T00:00:00Z', endTime: '2026-04-19T05:00:00Z', inputTokens: 200, outputTokens: 100, totalCost: 0.005 },
};

const DAILY_FIXTURE = {
  daily: [
    { date: '2026-04-01', inputTokens: 60, outputTokens: 30, totalCost: 0.001 },
    { date: '2026-04-02', inputTokens: 40, outputTokens: 20, totalCost: 0.001 },
  ],
};

const AGENTS_FIXTURE = {
  sessions: [
    { sessionId: 'abc123', agent: 'Jayce', project: 'strawberry-agents', cwd: '/home/user/strawberry-agents', firstSeen: '2026-04-01T10:00:00Z' },
    { sessionId: 'def456', agent: 'Evelynn', project: 'strawberry', cwd: '/home/user/strawberry', firstSeen: '2026-04-02T11:00:00Z' },
  ],
  unknowns: [],
  generatedAt: '2026-04-19T00:00:00Z',
};

const ROSTER_FIXTURE = {
  agents: [
    { name: 'Jayce', role: 'builder' },
    { name: 'Evelynn', role: 'coordinator' },
    { name: 'Viktor', role: 'builder' },
  ],
  generatedAt: '2026-04-19T00:00:00Z',
};

function writeFixtures(dir, rosterOverride) {
  const sessions = join(dir, 'sessions.json');
  const blocks = join(dir, 'blocks.json');
  const daily = join(dir, 'daily.json');
  const agents = join(dir, 'agents.json');
  const roster = join(dir, 'roster.json');
  writeFileSync(sessions, JSON.stringify(SESSIONS_FIXTURE));
  writeFileSync(blocks, JSON.stringify(BLOCKS_FIXTURE));
  writeFileSync(daily, JSON.stringify(DAILY_FIXTURE));
  writeFileSync(agents, JSON.stringify(AGENTS_FIXTURE));
  writeFileSync(roster, JSON.stringify(rosterOverride ?? ROSTER_FIXTURE));
  return { sessions, blocks, daily, agents, roster };
}

test('golden fixtures produce expected data.json shape', { todo: 'xfail — merge.mjs not yet implemented' }, () => {
  const dir = makeTmp();
  try {
    const { sessions, blocks, daily, agents, roster } = writeFixtures(dir);
    const out = join(dir, 'data.json');
    run(`--sessions ${sessions} --blocks ${blocks} --daily ${daily} --agents ${agents} --roster ${roster} --out ${out}`);
    const data = JSON.parse(readFileSync(out, 'utf8'));
    assert.equal(data.schemaVersion, 1);
    assert.ok(data.generatedAt, 'generatedAt present');
    assert.ok(data.window, 'window present');
    assert.ok(Array.isArray(data.sessions), 'sessions array');
    assert.equal(data.sessions.length, 2);
    assert.ok(Array.isArray(data.daily), 'daily array');
    assert.ok(Array.isArray(data.roster), 'roster array');
    assert.equal(typeof data.unknownCount, 'number');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('missing "totals" key in ccusage session JSON throws with key name in message', { todo: 'xfail — merge.mjs not yet implemented' }, () => {
  const dir = makeTmp();
  try {
    const { blocks, daily, agents, roster } = writeFixtures(dir);
    const badSessions = join(dir, 'bad-sessions.json');
    const { sessions: _, ...noTotals } = SESSIONS_FIXTURE;
    writeFileSync(badSessions, JSON.stringify({ sessions: SESSIONS_FIXTURE.sessions })); // missing totals
    const out = join(dir, 'data.json');
    let threw = false;
    try {
      run(`--sessions ${badSessions} --blocks ${blocks} --daily ${daily} --agents ${agents} --roster ${roster} --out ${out}`);
    } catch (err) {
      threw = true;
      const msg = err.stderr?.toString() || err.stdout?.toString() || '';
      assert.ok(msg.includes('totals'), `error should mention "totals", got: ${msg}`);
    }
    assert.ok(threw, 'should exit non-zero');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('session in ccusage but not in agents.json -> agent == "unknown", counted in unknownCount', { todo: 'xfail — merge.mjs not yet implemented' }, () => {
  const dir = makeTmp();
  try {
    const { sessions, blocks, daily, roster } = writeFixtures(dir);
    const emptyAgents = join(dir, 'empty-agents.json');
    writeFileSync(emptyAgents, JSON.stringify({ sessions: [], unknowns: [], generatedAt: '2026-04-19T00:00:00Z' }));
    const out = join(dir, 'data.json');
    run(`--sessions ${sessions} --blocks ${blocks} --daily ${daily} --agents ${emptyAgents} --roster ${roster} --out ${out}`);
    const data = JSON.parse(readFileSync(out, 'utf8'));
    assert.ok(data.sessions.every(s => s.agent === 'unknown'), 'all sessions should be unknown');
    assert.equal(data.unknownCount, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('sparkline daily[].byAgent token sums equal daily[].tokens', { todo: 'xfail — merge.mjs not yet implemented' }, () => {
  const dir = makeTmp();
  try {
    const { sessions, blocks, daily, agents, roster } = writeFixtures(dir);
    const out = join(dir, 'data.json');
    run(`--sessions ${sessions} --blocks ${blocks} --daily ${daily} --agents ${agents} --roster ${roster} --out ${out}`);
    const data = JSON.parse(readFileSync(out, 'utf8'));
    for (const day of data.daily) {
      const byAgentSum = Object.values(day.byAgent || {}).reduce((a, b) => a + b, 0);
      assert.equal(byAgentSum, day.tokens, `byAgent sum ${byAgentSum} != tokens ${day.tokens} for ${day.date}`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('output passes JSON.parse and matches v1 schema', { todo: 'xfail — merge.mjs not yet implemented' }, () => {
  const dir = makeTmp();
  try {
    const { sessions, blocks, daily, agents, roster } = writeFixtures(dir);
    const out = join(dir, 'data.json');
    run(`--sessions ${sessions} --blocks ${blocks} --daily ${daily} --agents ${agents} --roster ${roster} --out ${out}`);
    const raw = readFileSync(out, 'utf8');
    const data = JSON.parse(raw); // throws if invalid JSON
    // v1 schema required keys
    for (const key of ['schemaVersion', 'generatedAt', 'window', 'sessions', 'daily', 'roster', 'unknownCount']) {
      assert.ok(key in data, `missing key: ${key}`);
    }
    // session shape
    for (const s of data.sessions) {
      for (const k of ['sessionId', 'agent', 'project', 'cwd', 'tokensIn', 'tokensOut', 'cacheRead', 'cacheCreate', 'cost', 'model', 'startedAt']) {
        assert.ok(k in s, `session missing key: ${k}`);
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// regression: roster.json is the authoritative source — all 10 agents appear even with only 2 in sessions
test('roster.json with 10 names + sessions covering 2 -> data.roster.length === 10', () => {
  const dir = makeTmp();
  try {
    const tenAgents = Array.from({ length: 10 }, (_, i) => ({ name: `Agent${i}`, role: 'agent' }));
    const bigRoster = { agents: tenAgents, generatedAt: '2026-04-19T00:00:00Z' };
    const sparseAgents = {
      sessions: [
        { sessionId: 'abc123', agent: 'Agent0', project: 'strawberry', cwd: '/home', firstSeen: '2026-04-01T10:00:00Z' },
        { sessionId: 'def456', agent: 'Agent1', project: 'strawberry', cwd: '/home', firstSeen: '2026-04-02T11:00:00Z' },
      ],
      unknowns: [],
      generatedAt: '2026-04-19T00:00:00Z',
    };
    const { sessions, blocks, daily } = writeFixtures(dir, bigRoster);
    const rosterFile = join(dir, 'roster.json'); // written by writeFixtures with bigRoster
    const agentsFile = join(dir, 'sparse-agents.json');
    writeFileSync(agentsFile, JSON.stringify(sparseAgents));
    const out = join(dir, 'data.json');
    run(`--sessions ${sessions} --blocks ${blocks} --daily ${daily} --agents ${agentsFile} --roster ${rosterFile} --out ${out}`);
    const data = JSON.parse(readFileSync(out, 'utf8'));
    assert.equal(data.roster.length, 10, `expected 10 roster entries, got ${data.roster.length}`);
    assert.ok(data.roster.includes('Agent0'), 'Agent0 in roster');
    assert.ok(data.roster.includes('Agent9'), 'Agent9 in roster');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// regression: session record missing startTime key -> fail-loud with key name in error
test('session record missing "startTime" -> exits non-zero, error mentions "startTime"', () => {
  const dir = makeTmp();
  try {
    const { blocks, daily, agents, roster } = writeFixtures(dir);
    const badSessions = join(dir, 'no-starttime.json');
    writeFileSync(badSessions, JSON.stringify({
      totals: SESSIONS_FIXTURE.totals,
      sessions: [{ sessionId: 'xyz', model: 'claude-opus-4-7', inputTokens: 10, outputTokens: 5, totalCost: 0 }],
    }));
    const out = join(dir, 'data.json');
    let threw = false;
    try {
      run(`--sessions ${badSessions} --blocks ${blocks} --daily ${daily} --agents ${agents} --roster ${roster} --out ${out}`);
    } catch (err) {
      threw = true;
      const msg = err.stderr?.toString() || err.stdout?.toString() || '';
      assert.ok(msg.includes('startTime'), `error should mention "startTime", got: ${msg}`);
    }
    assert.ok(threw, 'should exit non-zero');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
