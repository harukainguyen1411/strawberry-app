// Attribution tests for phase-scan.mjs resolveProject() and scanJsonl() with
// project + plan stamping.
//
// Fixture raspberry tree: scripts/usage-dashboard/__fixtures__/raspberry-projects/
//   projects/personal/example/README.md  (slug: example, product: strawberry-app)
//   plans/personal/draft/2026-05-02-example.md  (project: example)
//   plans/personal/active/2026-05-01-already-active.md  (project: example)
//   plans/personal/active/example/2026-04-30-projected.md  (project: example)
//
// Products.json (generated from fixture tree): strawberry-app → example project
// Plans.json (generated from fixture tree): 3 plans all under example project
//
// JSONL fixtures:
//   attribution-worktree-cwd.jsonl  — cwd = <product-repo>/.worktrees/2026-04-30-projected
//   attribution-raspberry-cwd.jsonl — cwd = RASPBERRY_DIR, Read tool_uses reference plan path
//   attribution-product-repo-cwd.jsonl — cwd = product-repo bare path, Read references plan
//   attribution-unscoped.jsonl      — cwd outside any known repo → (unscoped)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanJsonl, resolveProject } from '../phase-scan.mjs';
import { generateProjects } from '../generate-projects.mjs';
import { generatePlans } from '../generate-plans.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir   = join(__dirname, '..', '__fixtures__');
const raspberryDir  = join(fixturesDir, 'raspberry-projects');

// ── build indexes from fixture tree ──────────────────────────────────────────

let projectsIndex = null;
let plansIndex    = null;

async function getIndexes() {
  if (projectsIndex && plansIndex) return { projectsIndex, plansIndex };

  const projects = await generateProjects({
    raspberryDir,
    outPath: join(raspberryDir, '__generated-projects.json'),
  });
  const plans = await generatePlans({
    raspberryDir,
    outPath: join(raspberryDir, '__generated-plans.json'),
  });

  // Build slug → plan map
  projectsIndex = {};
  for (const p of projects) projectsIndex[p.slug] = p;

  plansIndex = {};
  for (const p of plans) plansIndex[p.slug] = p;

  return { projectsIndex, plansIndex };
}

// ── fake product-repo base path ───────────────────────────────────────────────

// The fixture JSONLs use "/Users/u/Documents/Personal/strawberry-app" as the
// product-repo base, and "/Users/u/Documents/Personal/raspberry" as raspberry dir.
// We pass a custom raspberryDir (fixture), product-repo paths are derived from
// projectsIndex (product field = "strawberry-app") + a test-supplied productRepoBase.

const FIXTURE_RASPBERRY_DIR   = '/Users/u/Documents/Personal/raspberry';
const FIXTURE_PRODUCT_REPO    = '/Users/u/Documents/Personal/strawberry-app';

// ── tests ─────────────────────────────────────────────────────────────────────

test('resolveProject: worktree cwd → resolves fixture project + plan slug', async () => {
  const { projectsIndex: pi, plansIndex: pli } = await getIndexes();
  // cwd ends with .worktrees/<plan-slug>
  const cwd = `${FIXTURE_PRODUCT_REPO}/.worktrees/2026-04-30-projected`;
  const result = resolveProject(cwd, [], pi, pli, FIXTURE_RASPBERRY_DIR);
  assert.equal(result.projectSlug, 'example');
  assert.equal(result.planSlug,    '2026-04-30-projected');
});

test('resolveProject: raspberry-dir cwd with Read tool_use → resolves via plan path', async () => {
  const { projectsIndex: pi, plansIndex: pli } = await getIndexes();
  // tool_use Read blocks referencing plan files under plans/personal/...
  const toolUseRecords = [
    {
      type: 'assistant',
      message: {
        content: [
          {
            type:  'tool_use',
            name:  'Read',
            input: { file_path: `${FIXTURE_RASPBERRY_DIR}/plans/personal/active/example/2026-04-30-projected.md` },
          },
          {
            type:  'tool_use',
            name:  'Read',
            input: { file_path: `${FIXTURE_RASPBERRY_DIR}/plans/personal/active/example/2026-04-30-projected.md` },
          },
        ],
      },
    },
  ];
  const result = resolveProject(FIXTURE_RASPBERRY_DIR, toolUseRecords, pi, pli, FIXTURE_RASPBERRY_DIR);
  assert.equal(result.projectSlug, 'example');
  assert.equal(result.planSlug,    '2026-04-30-projected');
});

test('resolveProject: bare product-repo cwd with Read tool_use → resolves via plan path', async () => {
  const { projectsIndex: pi, plansIndex: pli } = await getIndexes();
  // Build a product-path → project lookup on the fly
  // The fixture project "example" has product = "strawberry-app"
  // We fake the full product-repo path as FIXTURE_PRODUCT_REPO
  const overrideProjectsIndex = {
    ...pi,
    // Inject the full product path for matching
  };
  // resolveProject needs to know that FIXTURE_PRODUCT_REPO == "strawberry-app"
  // We inject a productPathMap: productRepoName → absolutePath
  const productPathMap = { 'strawberry-app': FIXTURE_PRODUCT_REPO };
  const toolUseRecords = [
    {
      type: 'assistant',
      message: {
        content: [
          {
            type:  'tool_use',
            name:  'Read',
            input: { file_path: `${FIXTURE_RASPBERRY_DIR}/plans/personal/active/example/2026-04-30-projected.md` },
          },
        ],
      },
    },
  ];
  const result = resolveProject(
    FIXTURE_PRODUCT_REPO,
    toolUseRecords,
    overrideProjectsIndex,
    pli,
    FIXTURE_RASPBERRY_DIR,
    productPathMap,
  );
  assert.equal(result.projectSlug, 'example');
  assert.equal(result.planSlug,    '2026-04-30-projected');
});

test('resolveProject: cwd outside any known repo → (unscoped)', async () => {
  const { projectsIndex: pi, plansIndex: pli } = await getIndexes();
  const cwd = '/Users/u/Documents/SomeOtherDir/unknown-repo';
  const result = resolveProject(cwd, [], pi, pli, FIXTURE_RASPBERRY_DIR);
  assert.equal(result.projectSlug, '(unscoped)');
  assert.equal(result.planSlug,    '(unscoped)');
});

// ── scanJsonl integration tests ───────────────────────────────────────────────

test('scanJsonl: worktree-cwd JSONL → all records carry correct projectSlug + planSlug', async () => {
  const { projectsIndex: pi, plansIndex: pli } = await getIndexes();
  const records = await scanJsonl(
    join(fixturesDir, 'attribution-worktree-cwd.jsonl'),
    { projectsIndex: pi, plansIndex: pli, raspberryDir: FIXTURE_RASPBERRY_DIR },
  );
  assert.ok(records.length > 0, 'expected records');
  for (const r of records) {
    assert.equal(r.projectSlug, 'example',             `expected projectSlug=example, got ${r.projectSlug}`);
    assert.equal(r.planSlug,    '2026-04-30-projected', `expected planSlug=2026-04-30-projected, got ${r.planSlug}`);
  }
});

test('scanJsonl: raspberry-cwd JSONL with Read tool_use → resolves to plan project', async () => {
  const { projectsIndex: pi, plansIndex: pli } = await getIndexes();
  const records = await scanJsonl(
    join(fixturesDir, 'attribution-raspberry-cwd.jsonl'),
    { projectsIndex: pi, plansIndex: pli, raspberryDir: FIXTURE_RASPBERRY_DIR },
  );
  assert.ok(records.length > 0, 'expected records');
  for (const r of records) {
    assert.equal(r.projectSlug, 'example',             `expected projectSlug=example, got ${r.projectSlug}`);
    assert.equal(r.planSlug,    '2026-04-30-projected', `expected planSlug=2026-04-30-projected, got ${r.planSlug}`);
  }
});

test('scanJsonl: unscoped-cwd JSONL → projectSlug and planSlug are (unscoped)', async () => {
  const { projectsIndex: pi, plansIndex: pli } = await getIndexes();
  const records = await scanJsonl(
    join(fixturesDir, 'attribution-unscoped.jsonl'),
    { projectsIndex: pi, plansIndex: pli, raspberryDir: FIXTURE_RASPBERRY_DIR },
  );
  assert.ok(records.length > 0, 'expected records');
  for (const r of records) {
    assert.equal(r.projectSlug, '(unscoped)', `expected (unscoped), got ${r.projectSlug}`);
    assert.equal(r.planSlug,    '(unscoped)', `expected (unscoped), got ${r.planSlug}`);
  }
});

test('scanJsonl: all records carry a cwd field', async () => {
  const { projectsIndex: pi, plansIndex: pli } = await getIndexes();
  const records = await scanJsonl(
    join(fixturesDir, 'attribution-worktree-cwd.jsonl'),
    { projectsIndex: pi, plansIndex: pli, raspberryDir: FIXTURE_RASPBERRY_DIR },
  );
  for (const r of records) {
    assert.ok('cwd' in r, `expected cwd field on record, got: ${JSON.stringify(r)}`);
  }
});
