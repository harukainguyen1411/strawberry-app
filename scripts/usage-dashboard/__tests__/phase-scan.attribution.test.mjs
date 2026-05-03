// Attribution tests for phase-scan.mjs resolveProject() and scanJsonl() with
// project + plan stamping.
//
// Fixture raspberry tree: scripts/usage-dashboard/__fixtures__/raspberry-projects/
//   projects/personal/example/README.md  (slug: example, product: strawberry-app)
//   plans/personal/draft/2026-05-02-example.md          (slug: example,        project: example)
//   plans/personal/active/2026-05-01-already-active.md  (slug: already-active, project: example)
//   plans/personal/active/example/2026-04-30-projected.md (slug: projected,    project: example)
//   docs/personal/specs/example/2026-05-01-example-design.md (slug: example-design, project: example)
//
// Slugs are date-stripped (matches real-world plan/spec frontmatter).
//
// JSONL fixtures:
//   attribution-worktree-cwd.jsonl  — cwd = <product-repo>/.worktrees/projected
//   attribution-raspberry-cwd.jsonl — cwd = RASPBERRY_DIR, Read tool_uses reference plan path
//   attribution-product-repo-cwd.jsonl — cwd = product-repo bare path, Read references plan
//   attribution-unscoped.jsonl      — cwd outside any known repo → (unscoped)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanJsonl, resolveProject, buildBasenameIndex } from '../phase-scan.mjs';
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

  projectsIndex = {};
  for (const p of projects) projectsIndex[p.slug] = p;

  // plansIndex is keyed by relative path (matches plans.json `path` field).
  // Slug-keyed lookup would mask Bug 1 because real plans have date-stripped slugs
  // while file basenames carry dates.
  plansIndex = {};
  for (const p of plans) plansIndex[p.path] = p;

  return { projectsIndex, plansIndex };
}

// ── test paths ────────────────────────────────────────────────────────────────

const FIXTURE_RASPBERRY_DIR   = '/Users/u/Documents/Personal/raspberry';
const FIXTURE_PRODUCT_REPO    = '/Users/u/Documents/Personal/strawberry-app';

// ── tests ─────────────────────────────────────────────────────────────────────

test('resolveProject: worktree cwd → resolves fixture project + plan slug', async () => {
  const { projectsIndex: pi, plansIndex: pli } = await getIndexes();
  // cwd ends with .worktrees/<plan-slug> — the worktree dir name IS the plan slug
  const cwd = `${FIXTURE_PRODUCT_REPO}/.worktrees/projected`;
  const result = resolveProject(cwd, [], pi, pli, FIXTURE_RASPBERRY_DIR);
  assert.equal(result.projectSlug, 'example');
  assert.equal(result.planSlug,    'projected');
});

test('resolveProject: raspberry-dir cwd with Read tool_use → resolves via plan path (date-stripped slug)', async () => {
  const { projectsIndex: pi, plansIndex: pli } = await getIndexes();
  // tool_use Read blocks referencing a plan file by its real (date-prefixed)
  // filename. The implementation must do a PATH-based lookup, not a stem-based
  // lookup, because the plan's slug is date-stripped.
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
  assert.equal(result.planSlug,    'projected');
});

test('resolveProject: raspberry-dir cwd with Read tool_use on spec → resolves via spec frontmatter', async () => {
  const { projectsIndex: pi, plansIndex: pli } = await getIndexes();
  // Spec §4 step 3: brainstorming sessions touch only spec files.
  // Spec lives at docs/<concern>/specs/<project>/<file>.md and carries
  // `project:` + `slug:` frontmatter. The spec's slug becomes the planSlug.
  // We use the actual fixture raspberryDir (filesystem path) so the on-the-fly
  // frontmatter read can find the spec file.
  const toolUseRecords = [
    {
      type: 'assistant',
      message: {
        content: [
          {
            type:  'tool_use',
            name:  'Read',
            input: { file_path: `${raspberryDir}/docs/personal/specs/example/2026-05-01-example-design.md` },
          },
          {
            type:  'tool_use',
            name:  'Edit',
            input: { file_path: `${raspberryDir}/docs/personal/specs/example/2026-05-01-example-design.md` },
          },
        ],
      },
    },
  ];
  const result = resolveProject(raspberryDir, toolUseRecords, pi, pli, raspberryDir);
  assert.equal(result.projectSlug, 'example');
  assert.equal(result.planSlug,    'example-design');
});

test('resolveProject: bare product-repo cwd with Read tool_use → resolves via plan path', async () => {
  const { projectsIndex: pi, plansIndex: pli } = await getIndexes();
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
    pi,
    pli,
    FIXTURE_RASPBERRY_DIR,
    productPathMap,
  );
  assert.equal(result.projectSlug, 'example');
  assert.equal(result.planSlug,    'projected');
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
    assert.equal(r.projectSlug, 'example',   `expected projectSlug=example, got ${r.projectSlug}`);
    assert.equal(r.planSlug,    'projected', `expected planSlug=projected, got ${r.planSlug}`);
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
    assert.equal(r.projectSlug, 'example',   `expected projectSlug=example, got ${r.projectSlug}`);
    assert.equal(r.planSlug,    'projected', `expected planSlug=projected, got ${r.planSlug}`);
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

// ── buildBasenameIndex collision detection ───────────────────────────────────

test('buildBasenameIndex: colliding filenames are marked ambiguous and warned', () => {
  // Two plans across different projects share the same filename
  // `2026-05-01-foo.md`. Fallback must be skipped for this filename.
  const planA = {
    slug: 'foo-alpha',
    project: 'project-alpha',
    path: 'plans/personal/active/project-alpha/2026-05-01-foo.md',
  };
  const planB = {
    slug: 'foo-beta',
    project: 'project-beta',
    path: 'plans/personal/active/project-beta/2026-05-01-foo.md',
  };
  const planUnique = {
    slug: 'unique',
    project: 'project-alpha',
    path: 'plans/personal/active/project-alpha/2026-05-02-unique.md',
  };
  // Path-keyed plansIndex (matches production)
  const plansIndex = {
    [planA.path]:      planA,
    [planB.path]:      planB,
    [planUnique.path]: planUnique,
  };

  const warnings = [];
  const idx = buildBasenameIndex(plansIndex, { warn: (m) => warnings.push(m) });

  // Colliding filename → marked ambiguous (not one of the plans)
  assert.notEqual(idx['2026-05-01-foo.md'], planA);
  assert.notEqual(idx['2026-05-01-foo.md'], planB);
  // Unique filename → maps to its plan
  assert.equal(idx['2026-05-02-unique.md'], planUnique);
  // One warning emitted listing the collision
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /2026-05-01-foo\.md/);
  assert.match(warnings[0], /project-alpha/);
  assert.match(warnings[0], /project-beta/);
});

test('buildBasenameIndex: no collisions → no warning emitted', () => {
  const planA = {
    slug: 'foo',
    project: 'project-alpha',
    path: 'plans/personal/active/project-alpha/2026-05-01-foo.md',
  };
  const planB = {
    slug: 'bar',
    project: 'project-beta',
    path: 'plans/personal/active/project-beta/2026-05-02-bar.md',
  };
  const plansIndex = {
    [planA.path]: planA,
    [planB.path]: planB,
  };
  const warnings = [];
  buildBasenameIndex(plansIndex, { warn: (m) => warnings.push(m) });
  assert.equal(warnings.length, 0);
});

test('findPlanFromPaths (via scanJsonl): ambiguous-basename fallback is skipped, exact-path still works', async () => {
  // Build a plansIndex with two plans sharing a filename. The exact-path
  // lookup should still resolve when a tool_use references the full path,
  // but the basename fallback must not. This test exercises the full
  // resolveProject → findPlanFromPaths path through scanJsonl.
  const planA = {
    slug: 'foo-alpha',
    project: 'project-alpha',
    path: 'plans/personal/active/project-alpha/2026-05-01-foo.md',
  };
  const planB = {
    slug: 'foo-beta',
    project: 'project-beta',
    path: 'plans/personal/active/project-beta/2026-05-01-foo.md',
  };
  const plansIndex = {
    [planA.path]: planA,
    [planB.path]: planB,
  };

  // Exact-path tool_use → resolves cleanly to planA
  const records = await scanJsonl(
    join(fixturesDir, 'attribution-collision-exact.jsonl'),
    { projectsIndex: {}, plansIndex, raspberryDir: '/Users/u/Documents/Personal/raspberry' },
  );
  assert.ok(records.length > 0);
  for (const r of records) {
    assert.equal(r.projectSlug, 'project-alpha');
    assert.equal(r.planSlug,    'foo-alpha');
  }
});
