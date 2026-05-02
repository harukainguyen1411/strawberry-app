import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { generateProjects } from '../generate-projects.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = join(__dirname, '..', '__fixtures__', 'raspberry-projects');

test('generate-projects: emits one entry per hub README with frontmatter', async () => {
  const tmp = mkdtempSync(join(tmpdir(), 'projects-'));
  const out = join(tmp, 'projects.json');
  try {
    await generateProjects({ raspberryDir: fixtureRoot, outPath: out });
    const data = JSON.parse(readFileSync(out, 'utf8'));
    assert.equal(data.projects.length, 1);
    assert.deepEqual(data.projects[0], {
      slug: 'example',
      name: 'Example Project',
      concern: 'personal',
      product: 'strawberry-app',
      aliases: ['example', 'ex'],
    });
    assert.ok(data.generatedAt);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
