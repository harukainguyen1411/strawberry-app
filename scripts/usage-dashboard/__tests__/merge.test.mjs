import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fix = join(__dirname, '..', '__fixtures__', 'merge');

test('merge: produces data.json matching golden fixture', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'merge-'));
  const out = join(tmp, 'data.json');
  try {
    const r = spawnSync('node', [
      join(__dirname, '..', 'merge.mjs'),
      '--sessions',   join(fix, 'sessions.json'),
      '--blocks',     join(fix, 'blocks.json'),
      '--daily',      join(fix, 'daily.json'),
      '--phase-scan', join(fix, 'phase-scan.json'),
      '--projects',   join(fix, 'projects.json'),
      '--plans',      join(fix, 'plans.json'),
      '--out',        out,
    ], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    const got      = JSON.parse(readFileSync(out, 'utf8'));
    const expected = JSON.parse(readFileSync(join(fix, 'expected-data.json'), 'utf8'));
    delete got.generatedAt; delete expected.generatedAt;
    assert.deepEqual(got, expected);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
