#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';

const { values: args } = parseArgs({
  options: {
    sessions: { type: 'string' },
    blocks:   { type: 'string' },
    daily:    { type: 'string' },
    agents:   { type: 'string' },
    out:      { type: 'string' },
  },
});

for (const key of ['sessions', 'blocks', 'daily', 'agents', 'out']) {
  if (!args[key]) { process.stderr.write(`Error: --${key} is required\n`); process.exit(1); }
}

function load(path, label) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    process.stderr.write(`Error: cannot read ${label} at ${path}: ${err.message}\n`);
    process.exit(1);
  }
}

function assertKey(obj, key, label) {
  if (!(key in obj)) {
    process.stderr.write(`Schema error in ${label}: missing required key "${key}"\n`);
    process.exit(1);
  }
}

const sessionsData = load(args.sessions, 'sessions');
const blocksData   = load(args.blocks,   'blocks');
const dailyData    = load(args.daily,    'daily');
const agentsData   = load(args.agents,   'agents');

// Validate expected top-level keys — fail loudly on drift
assertKey(sessionsData, 'totals',   'sessions JSON');
assertKey(sessionsData, 'sessions', 'sessions JSON');
assertKey(blocksData,   'window',   'blocks JSON');
assertKey(dailyData,    'daily',    'daily JSON');
assertKey(agentsData,   'sessions', 'agents JSON');

// Build sessionId -> agent info map
const agentMap = new Map();
for (const s of agentsData.sessions) {
  agentMap.set(s.sessionId, s);
}

// Collect roster names from agents
const rosterNames = new Set(agentsData.sessions.map(s => s.agent).filter(a => a && a !== 'unknown'));

let unknownCount = 0;

const sessions = sessionsData.sessions.map(s => {
  const info = agentMap.get(s.sessionId);
  const agent = info?.agent ?? 'unknown';
  if (agent === 'unknown') unknownCount++;
  return {
    sessionId:   s.sessionId,
    agent,
    project:     info?.project ?? 'unknown',
    cwd:         info?.cwd ?? null,
    tokensIn:    s.inputTokens ?? 0,
    tokensOut:   s.outputTokens ?? 0,
    cacheRead:   s.cacheReadTokens ?? 0,
    cacheCreate: s.cacheWriteTokens ?? 0,
    cost:        s.totalCost ?? 0,
    model:       s.model ?? null,
    startedAt:   s.startTime ?? null,
  };
});

// Build byAgent per day — join daily dates with sessions on date prefix of startedAt
const daily = dailyData.daily.map(d => {
  const tokens = (d.inputTokens ?? 0) + (d.outputTokens ?? 0);
  const daySessions = sessions.filter(s => s.startedAt?.startsWith(d.date));
  const byAgent = {};
  for (const s of daySessions) {
    const t = s.tokensIn + s.tokensOut;
    byAgent[s.agent] = (byAgent[s.agent] ?? 0) + t;
  }
  // If no sessions matched the day, put total under 'unknown' to preserve sum invariant
  const byAgentSum = Object.values(byAgent).reduce((a, b) => a + b, 0);
  if (byAgentSum === 0 && tokens > 0) byAgent['unknown'] = tokens;
  return { date: d.date, tokens, cost: d.totalCost ?? 0, byAgent };
});

const output = {
  schemaVersion: 1,
  generatedAt:   new Date().toISOString(),
  window:        blocksData.window,
  sessions,
  daily,
  roster:        [...rosterNames].sort(),
  unknownCount,
};

mkdirSync(dirname(args.out), { recursive: true });
writeFileSync(args.out, JSON.stringify(output, null, 2) + '\n');

const totalTokens = sessions.reduce((a, s) => a + s.tokensIn + s.tokensOut, 0);
process.stdout.write(`data.json written: ${sessions.length} sessions, ${rosterNames.size} agents, ${unknownCount} unknown, ${totalTokens} tokens -> ${args.out}\n`);
