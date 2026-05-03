// Sidechain fixture convention: a parent fixture at __fixtures__/<name>.jsonl
// has its sidechains at __fixtures__/<name>.subagents/agent-<agentId>.jsonl.
// Tests rely on phase-scan.mjs (T2) resolving sidechains via this layout.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanJsonl } from '../phase-scan.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, '..', '__fixtures__');

test('full-lifecycle: each phase emits records with the expected phase tag', async () => {
  const records = await scanJsonl(join(fixturesDir, 'full-lifecycle.jsonl'));
  const phasesInOrder = records.filter(r => r.tokens > 0).map(r => r.phase);
  assert.deepEqual(
    phasesInOrder,
    [
      'Brainstorm', 'Brainstorm',
      'Plan',       'Plan',
      'Implement',  'Implement',
      'Verify',     'Verify',
      'Finish',     'Finish',
    ]
  );
});

test('no-skills: every record is (unphased)', async () => {
  const records = await scanJsonl(join(fixturesDir, 'no-skills.jsonl'));
  for (const r of records) {
    assert.equal(r.phase, '(unphased)');
  }
});

test('playwright-subagent: subagent records → Verify; parent pre-dispatch → Review', async () => {
  const records = await scanJsonl(join(fixturesDir, 'playwright-subagent.jsonl'));
  const parent = records.filter(r => !r.subagent);
  const sub    = records.filter(r =>  r.subagent);
  for (const r of parent) assert.equal(r.phase, 'Review');
  for (const r of sub)    assert.equal(r.phase, 'Verify');
});

test('code-reviewer-subagent: all records → Review (no override)', async () => {
  const records = await scanJsonl(join(fixturesDir, 'code-reviewer-subagent.jsonl'));
  for (const r of records) assert.equal(r.phase, 'Review');
});

test('idle-gap: duration capped at 600s', async () => {
  const records = await scanJsonl(join(fixturesDir, 'idle-gap.jsonl'));
  const durations = records.filter(r => r.durationSec > 0).map(r => r.durationSec);
  for (const d of durations) assert.ok(d <= 600, `expected ≤600s, got ${d}`);
});
