import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { generatePlans } from '../generate-plans.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = join(__dirname, '..', '__fixtures__', 'raspberry-projects');

test('generate-plans: walks all four state dirs and records state', async () => {
  const tmp = mkdtempSync(join(tmpdir(), 'plans-'));
  const out = join(tmp, 'plans.json');
  try {
    await generatePlans({ raspberryDir: fixtureRoot, outPath: out });
    const data = JSON.parse(readFileSync(out, 'utf8'));
    assert.equal(data.plans.length, 2);
    const draft = data.plans.find(p => p.state === 'draft');
    const active = data.plans.find(p => p.state === 'active');
    assert.equal(draft.slug, '2026-05-02-example');
    assert.equal(draft.project, 'example');
    assert.equal(active.slug, '2026-05-01-already-active');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
