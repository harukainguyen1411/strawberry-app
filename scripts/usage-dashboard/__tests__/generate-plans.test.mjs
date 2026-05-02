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
    assert.equal(data.plans.length, 3);
    const draft = data.plans.find(p => p.state === 'draft');
    const flatActive = data.plans.find(p => p.slug === '2026-05-01-already-active');
    const projected = data.plans.find(p => p.slug === '2026-04-30-projected');
    assert.equal(draft.slug, '2026-05-02-example');
    assert.equal(draft.project, 'example');
    assert.equal(flatActive.state, 'active');
    assert.equal(projected.state, 'active');
    assert.equal(projected.project, 'example');
    assert.equal(projected.path, 'plans/personal/active/example/2026-04-30-projected.md');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
