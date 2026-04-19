/**
 * xfail-first test for @strawberry/vitest-reporter-tests-dashboard
 *
 * Refs plan: tests-dashboard, task TD.1 (xfail-first per CLAUDE.md Rule 12)
 *
 * This test is expected to fail until the reporter package is implemented.
 * It uses `test.fails` (Vitest's xfail equivalent).
 *
 * Once the implementation lands, this test MUST pass (not just fail-as-expected).
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

// This import will fail until src/index.ts exists — that is the xfail condition.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — intentionally importing a not-yet-existing module
import TestsDashboardReporter from '../src/index.js'

const SCHEMA_PATH = path.resolve(
  __dirname,
  '../../../../agents/schemas/tests-dashboard-data-schema.json'
)

/** Minimal synthetic TaskResultPack-like finished payload */
function buildFinishedPayload(overrides: {
  testName?: string
  nodeId?: string
  status?: 'pass' | 'fail'
  errorMsg?: string
} = {}) {
  const {
    testName = 'my test',
    nodeId = 'src/example.test.ts::my test',
    status = 'pass',
    errorMsg,
  } = overrides

  // Vitest calls onFinished with (files, errors). We simulate a minimal TaskResultPack structure.
  const taskResult = {
    state: status === 'pass' ? 'pass' : 'fail',
    duration: 42,
    errors: errorMsg ? [{ message: errorMsg, stack: errorMsg }] : [],
  }
  const task = {
    id: nodeId,
    name: testName,
    type: 'test' as const,
    file: { name: 'src/example.test.ts', filepath: '/repo/src/example.test.ts' },
    result: taskResult,
    mode: 'run' as const,
    meta: {},
  }
  const file = {
    name: 'src/example.test.ts',
    filepath: '/repo/src/example.test.ts',
    type: 'suite' as const,
    tasks: [task],
    result: { state: status === 'pass' ? 'pass' : 'fail', duration: 50 },
    mode: 'run' as const,
    meta: {},
  }
  return { files: [file as unknown as import('vitest').File] }
}

describe('TestsDashboardReporter — xfail-first integration test', () => {
  let tmpDir: string
  let originalCwd: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'td1-xfail-'))
    originalCwd = process.cwd()
    process.chdir(tmpDir)
  })

  afterEach(() => {
    process.chdir(originalCwd)
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test.fails('reporter emits test-results.json that validates against shared schema', async () => {
    const reporter = new TestsDashboardReporter()

    const { files } = buildFinishedPayload({ testName: 'example test', status: 'pass' })
    // onFinished(files, errors)
    await reporter.onFinished(files, [])

    const outFile = path.join(tmpDir, '.test-dashboard', 'test-results.json')
    expect(fs.existsSync(outFile), `${outFile} should exist after onFinished`).toBe(true)

    const data = JSON.parse(fs.readFileSync(outFile, 'utf-8'))

    // Top-level required fields
    expect(data).toHaveProperty('repo', 'strawberry-app')
    expect(data).toHaveProperty('runner', 'vitest')
    expect(data).toHaveProperty('run_timestamp')
    expect(data).toHaveProperty('total')
    expect(data).toHaveProperty('passed')
    expect(data).toHaveProperty('failed')
    expect(data).toHaveProperty('skipped')
    expect(data).toHaveProperty('xfailed')
    expect(data).toHaveProperty('xpassed')
    expect(data).toHaveProperty('tests')
    expect(Array.isArray(data.tests)).toBe(true)

    // Schema validation
    if (fs.existsSync(SCHEMA_PATH)) {
      const { default: Ajv } = await import('ajv')
      const ajv = new Ajv()
      const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf-8'))
      const validate = ajv.compile(schema)
      const valid = validate(data)
      if (!valid) {
        console.error('Schema validation errors:', validate.errors)
      }
      expect(valid).toBe(true)
    }
  })
})
