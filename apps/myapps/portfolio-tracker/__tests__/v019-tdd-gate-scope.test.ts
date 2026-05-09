// V0.19 — TDD enforcement scoping for portfolio-tracker.
//
// Asserts that a hypothetical impl-only commit on a portfolio-tracker source
// file is detected as TDD-governed by the repo's gate machinery. All four
// hooks share one algorithm: walk up from a changed file's directory until
// a package.json is found, then read package.json.tdd.enabled. If that flag
// is true, the file is TDD-governed and the corresponding gate engages:
//   - .github/workflows/tdd-gate.yml         → xfail-first + regression-test
//   - .github/workflows/e2e.yml              → Playwright routing
//   - scripts/hooks/pre-commit-unit-tests.sh → local unit test gate
//   - scripts/hooks/pre-push-tdd.sh          → local TDD-rule replication
//
// Re-implementing that walk here as a self-contained spec is deliberate: it
// pins the contract (which package owns a path, and is it TDD-enabled) at
// the workspace level, independent of any one workflow's bash implementation.
//
// xfail-first: was written as `test.fails` in the V0.19 xfail commit
// (assertion failed because PT lacked `tdd.enabled`); converted to `test`
// in this impl commit that adds the flag — making the assertion pass.

import { describe, test, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Walk up to the workspace root: __tests__/ → portfolio-tracker/ → myapps/ → apps/ → <root>
const REPO_ROOT = resolve(__dirname, '..', '..', '..', '..')

interface OwningPkg {
  pkgDir: string
  tddEnabled: boolean
}

function findOwningTddPkg(repoRoot: string, file: string): OwningPkg | null {
  let dir = dirname(file)
  while (dir !== '.' && dir !== '/' && dir !== '') {
    const pkgJsonPath = join(repoRoot, dir, 'package.json')
    try {
      const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'))
      return { pkgDir: dir, tddEnabled: pkg.tdd?.enabled === true }
    } catch {
      // no package.json at this level, walk up
    }
    dir = dirname(dir)
  }
  return null
}

describe('V0.19 — tdd-gate scoping for portfolio-tracker', () => {
  test('a hypothetical impl-only commit on apps/myapps/portfolio-tracker/src/foo.ts is detected as TDD-governed', () => {
    const result = findOwningTddPkg(REPO_ROOT, 'apps/myapps/portfolio-tracker/src/foo.ts')
    expect(result?.pkgDir).toBe('apps/myapps/portfolio-tracker')
    expect(result?.tddEnabled).toBe(true)
  })

  test('portfolio-tracker package.json declares scripts["test:unit"] so pre-commit-unit-tests.sh runs vitest on staged PT changes', () => {
    const pkg = JSON.parse(
      readFileSync(join(REPO_ROOT, 'apps/myapps/portfolio-tracker/package.json'), 'utf-8'),
    )
    expect(pkg.scripts?.['test:unit']).toBeTruthy()
  })
})
