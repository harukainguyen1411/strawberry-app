#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));

const claudeProjectsDir = process.env.CLAUDE_PROJECTS_DIR ||
  join(homedir(), '.claude', 'projects');
const rosterFile = process.env.ROSTER_FILE ||
  join(__dirname, '../../dashboards/usage-dashboard/roster.json');
const agentsOut = process.env.AGENTS_OUT ||
  join(homedir(), '.claude', 'strawberry-usage-cache', 'agents.json');

// Load roster
let rosterNames = new Set();
try {
  const roster = JSON.parse(readFileSync(rosterFile, 'utf8'));
  rosterNames = new Set(roster.agents.map(a => a.name));
} catch (err) {
  process.stderr.write(`Warning: could not load roster from ${rosterFile}: ${err.message}\n`);
}

// Regex patterns (first-win order per plan)
const PATTERNS = [
  { re: /^Hey (\w+)/,                    group: 1 },
  { re: /^\[autonomous\] (\w+),/,        group: 1 },
  { re: /^You are (\w+)[,.]/,            group: 1 },
  { re: /^# (\w+) .* prompt \(pinned/,   group: 1 },
];

function matchAgent(text) {
  for (const { re, group } of PATTERNS) {
    const m = re.exec(text);
    if (m) return m[group];
  }
  return null;
}

function attributeProject(cwd) {
  if (!cwd) return 'unknown';
  const expanded = cwd.replace(/^~/, homedir());
  const home = homedir();
  if (expanded.startsWith(join(home, 'Documents/Personal/strawberry-app'))) return 'strawberry-app';
  if (expanded.startsWith(join(home, 'Documents/Personal/strawberry'))) return 'strawberry';
  if (expanded.includes('Documents/Work/mmp')) return 'work/mmp';
  return basename(expanded) || 'unknown';
}

function scanJsonl(filePath) {
  const sessionId = basename(filePath, '.jsonl');
  let firstUserMsg = null;
  let cwd = null;

  const content = readFileSync(filePath, 'utf8');
  for (const line of content.split('\n')) {
    if (!line.trim()) continue;
    let record;
    try { record = JSON.parse(line); } catch { continue; }
    if (record.type === 'user') {
      // Extract text from message.content[0].text
      const content = record.message?.content;
      if (Array.isArray(content) && content[0]?.type === 'text') {
        firstUserMsg = content[0].text;
      } else if (typeof content === 'string') {
        firstUserMsg = content;
      }
      cwd = record.cwd || null;
      break;
    }
  }

  return { sessionId, firstUserMsg, cwd };
}

function* walkJsonl(dir) {
  let entries;
  try { entries = readdirSync(dir); } catch { return; }
  for (const entry of entries) {
    const full = join(dir, entry);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) yield* walkJsonl(full);
    else if (entry.endsWith('.jsonl')) yield full;
  }
}

const sessions = [];
const unknowns = [];

for (const filePath of walkJsonl(claudeProjectsDir)) {
  const { sessionId, firstUserMsg, cwd } = scanJsonl(filePath);
  const project = attributeProject(cwd);

  let agent = 'Evelynn';
  let rawMatch = undefined;

  if (firstUserMsg) {
    const matched = matchAgent(firstUserMsg);
    if (matched) {
      if (rosterNames.has(matched)) {
        agent = matched;
      } else {
        agent = 'unknown';
        rawMatch = matched;
      }
    }
    // no match -> fallback Evelynn (already set)
  }

  const entry = { sessionId, agent, project, cwd: cwd || null, firstSeen: null };
  if (rawMatch !== undefined) entry.rawMatch = rawMatch;
  sessions.push(entry);
  if (agent === 'unknown') unknowns.push(sessionId);
}

const output = {
  sessions,
  unknowns,
  generatedAt: new Date().toISOString(),
};

mkdirSync(dirname(agentsOut), { recursive: true });
writeFileSync(agentsOut, JSON.stringify(output, null, 2) + '\n');
process.stdout.write(`agents.json written: ${sessions.length} sessions, ${unknowns.length} unknowns -> ${agentsOut}\n`);
