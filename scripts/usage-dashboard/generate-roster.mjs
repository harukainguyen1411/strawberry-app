#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const agentsRepo = (process.env.STRAWBERRY_AGENTS_REPO || '~/Documents/Personal/strawberry-agents')
  .replace(/^~/, homedir());

const networkFile = join(agentsRepo, 'agents', 'memory', 'agent-network.md');

let content;
try {
  content = readFileSync(networkFile, 'utf8');
} catch (err) {
  process.stderr.write(`Error: cannot read agent-network.md at ${networkFile}\n${err.message}\n`);
  process.exit(1);
}

// Parse agent names and roles from markdown tables: | **Name** | Role |
const agents = [];
const tableRowRe = /^\|\s*\*\*(\w+)\*\*\s*\|\s*([^|]+?)\s*\|/gm;
let m;
while ((m = tableRowRe.exec(content)) !== null) {
  agents.push({ name: m[1], role: m[2].trim() });
}

if (agents.length === 0) {
  process.stderr.write(`Error: no agents found in ${networkFile}\n`);
  process.exit(1);
}

const roster = {
  agents,
  generatedAt: new Date().toISOString(),
};

const defaultOut = join(__dirname, '../../dashboards/usage-dashboard/roster.json');
const outFile = process.env.ROSTER_OUT || defaultOut;

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, JSON.stringify(roster, null, 2) + '\n');
process.stdout.write(`roster.json written: ${agents.length} agents -> ${outFile}\n`);
