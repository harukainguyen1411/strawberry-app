#!/usr/bin/env node
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { homedir } from 'node:os';

const SKILL_TO_PHASE = Object.freeze({
  'superpowers-extended-cc:brainstorming':                  'Brainstorm',
  'superpowers-extended-cc:brainstorm':                     'Brainstorm',
  'superpowers:brainstorming':                              'Brainstorm',
  'superpowers:brainstorm':                                 'Brainstorm',
  'superpowers-extended-cc:writing-plans':                  'Plan',
  'superpowers:writing-plans':                              'Plan',
  'superpowers-extended-cc:subagent-driven-development':    'Implement',
  'superpowers:subagent-driven-development':                'Implement',
  'superpowers-extended-cc:executing-plans':                'Implement',
  'superpowers:executing-plans':                            'Implement',
  'superpowers-extended-cc:test-driven-development':        'Implement',
  'superpowers:test-driven-development':                    'Implement',
  'superpowers-extended-cc:requesting-code-review':         'Review',
  'superpowers:requesting-code-review':                     'Review',
  'superpowers-extended-cc:verification-before-completion': 'Verify',
  'superpowers:verification-before-completion':             'Verify',
  'superpowers-extended-cc:systematic-debugging':           'Debug',
  'superpowers:systematic-debugging':                       'Debug',
  'superpowers-extended-cc:finishing-a-development-branch': 'Finish',
  'superpowers:finishing-a-development-branch':             'Finish',
});

const SUBAGENT_TYPE_TO_PHASE = Object.freeze({
  'code-reviewer': 'Review',
  'Explore':       '(unphased)',
});

const IDLE_CAP_SEC = Number(process.env.IDLE_CAP_SEC ?? 600);

function getToolUses(record) {
  const content = record?.message?.content;
  if (!Array.isArray(content)) return [];
  return content.filter(b => b?.type === 'tool_use');
}

function getUsageTokens(record) {
  const u = record?.message?.usage ?? {};
  return {
    input:       u.input_tokens                 ?? 0,
    output:      u.output_tokens                ?? 0,
    cacheRead:   u.cache_read_input_tokens      ?? 0,
    cacheCreate: u.cache_creation_input_tokens  ?? 0,
  };
}

const totalTokens = t => t.input + t.output + t.cacheRead + t.cacheCreate;

function diffSec(a, b) {
  if (!a || !b) return 0;
  const A = Date.parse(a), B = Date.parse(b);
  if (isNaN(A) || isNaN(B)) return 0;
  return Math.max(0, Math.round((B - A) / 1000));
}

function isPlaywrightTool(name) {
  return typeof name === 'string' && name.startsWith('mcp__plugin_playwright_playwright__');
}

function readJsonlLines(path) {
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter(l => l.trim())
    .map(l => {
      try { return JSON.parse(l); } catch { return null; }
    })
    .filter(Boolean);
}

function resolveSidechainPath(parentFilePath, sessionId, agentId) {
  const dir = dirname(parentFilePath);
  const stem = basename(parentFilePath, '.jsonl');

  // Fixture/test layout: <dir>/<stem>.subagents/agent-<agentId>.jsonl
  const fixturePath = join(dir, `${stem}.subagents`, `agent-${agentId}.jsonl`);
  if (existsSync(fixturePath)) return fixturePath;

  // Production layout: <dir>/<sessionId>/subagents/agent-<agentId>.jsonl
  const prodPath = join(dir, sessionId, 'subagents', `agent-${agentId}.jsonl`);
  if (existsSync(prodPath)) return prodPath;

  return null;
}

export async function scanJsonl(filePath) {
  const sessionId = basename(filePath, '.jsonl');
  const records = readJsonlLines(filePath);
  const out = [];
  let currentSkill = null;
  let playwrightSeenParent = false;
  let prevEmittedTs = null;
  let messageIdx = 0;

  for (let i = 0; i < records.length; i++) {
    const rec = records[i];
    if (rec.type !== 'assistant') continue;

    const toolUses = getToolUses(rec);

    // Update currentSkill and playwrightSeenParent BEFORE attributing this record
    for (const t of toolUses) {
      if (t.name === 'Skill' && typeof t.input?.skill === 'string') {
        currentSkill = t.input.skill;
      }
      if (isPlaywrightTool(t.name)) {
        playwrightSeenParent = true;
      }
    }

    const tokens = getUsageTokens(rec);
    const phase = playwrightSeenParent ? 'Verify' : (SKILL_TO_PHASE[currentSkill] ?? '(unphased)');
    const durationSec = Math.min(diffSec(prevEmittedTs, rec.timestamp), IDLE_CAP_SEC);

    out.push({
      sessionId,
      messageIdx: messageIdx++,
      phase,
      projectSlug: null,
      planSlug:    null,
      tokens: totalTokens(tokens),
      tokensBreakdown: tokens,
      durationSec,
      subagent: false,
    });
    prevEmittedTs = rec.timestamp ?? prevEmittedTs;

    // Walk Agent dispatches: the agentId is on the NEXT matching user record's toolUseResult
    for (const t of toolUses) {
      if (t.name !== 'Agent') continue;

      let agentId = null;
      let agentType = t.input?.subagent_type ?? null;

      // Find the next user record that carries a toolUseResult with an agentId
      // matching by tool_use_id (t.id) if available, else first match
      for (let j = i + 1; j < records.length; j++) {
        const nxt = records[j];
        if (nxt.type !== 'user') continue;
        if (!nxt.toolUseResult?.agentId) continue;

        const blocks = Array.isArray(nxt.message?.content) ? nxt.message.content : [];
        const matched = t.id
          ? blocks.some(b => b.tool_use_id === t.id)
          : true; // no id to match on — take first

        if (matched) {
          agentId   = nxt.toolUseResult.agentId;
          agentType = nxt.toolUseResult.agentType ?? agentType;
          break;
        }
      }

      if (!agentId) continue;

      const sidechainPath = resolveSidechainPath(filePath, sessionId, agentId);
      if (!sidechainPath) {
        process.stderr.write(`warn: sidechain not found for agentId=${agentId} (parent=${filePath})\n`);
        continue;
      }

      // Walk sidechain with a fresh Playwright flag; initial phase from subagent type or current skill
      const subRecs = readJsonlLines(sidechainPath);
      let subPlaywrightSeen = false;
      const initialPhase = SUBAGENT_TYPE_TO_PHASE[agentType] ?? SKILL_TO_PHASE[currentSkill] ?? '(unphased)';

      for (const sr of subRecs) {
        if (sr.type !== 'assistant') continue;

        const subToolUses = getToolUses(sr);
        for (const st of subToolUses) {
          if (isPlaywrightTool(st.name)) subPlaywrightSeen = true;
        }

        const subTokens = getUsageTokens(sr);
        const subPhase = subPlaywrightSeen ? 'Verify' : initialPhase;
        const subDuration = Math.min(diffSec(prevEmittedTs, sr.timestamp), IDLE_CAP_SEC);

        out.push({
          sessionId,
          messageIdx: messageIdx++,
          phase: subPhase,
          projectSlug: null,
          planSlug:    null,
          tokens: totalTokens(subTokens),
          tokensBreakdown: subTokens,
          durationSec: subDuration,
          subagent: true,
        });
        prevEmittedTs = sr.timestamp ?? prevEmittedTs;
      }
    }
  }

  return out;
}

// CLI entrypoint
function* walkJsonl(dir) {
  let entries;
  try { entries = readdirSync(dir); } catch { return; }
  for (const entry of entries) {
    const full = join(dir, entry);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) {
      // Skip sidechain subdirectories — they are walked via parent Agent dispatch
      if (entry === 'subagents' || entry.endsWith('.subagents')) continue;
      yield* walkJsonl(full);
    } else if (entry.endsWith('.jsonl')) {
      yield full;
    }
  }
}

const isCli = import.meta.url === `file://${process.argv[1]}`;
if (isCli) {
  const claudeProjectsDir = process.env.CLAUDE_PROJECTS_DIR || join(homedir(), '.claude', 'projects');
  const out = process.env.PHASE_SCAN_OUT || join(homedir(), '.claude', 'raspberry-usage-cache', 'phase-scan.json');
  const all = [];
  for (const fp of walkJsonl(claudeProjectsDir)) {
    try {
      const recs = await scanJsonl(fp);
      all.push(...recs);
    } catch (e) {
      process.stderr.write(`warn: ${fp}: ${e.message}\n`);
    }
  }
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ records: all, generatedAt: new Date().toISOString() }, null, 2) + '\n');
  process.stdout.write(`phase-scan.json written: ${all.length} records → ${out}\n`);
}
