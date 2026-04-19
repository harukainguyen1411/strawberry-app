/**
 * Golden-file tests for @strawberry/vitest-reporter-tests-dashboard
 *
 * Covers all five test outcome types plus new-test-detection and atomic-write:
 *   1. all-pass
 *   2. one-fail-with-error
 *   3. xfail (test.fails that correctly fails — status = xfailed via result.note)
 *   4. xpassed (test.fails that unexpectedly passes)
 *   5. skip
 *   6. mixed run (new-test detection)
 *   7. atomic-write-no-partial-read
 *
 * Refs plan: tests-dashboard, task TD.1
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import type { File, Task, Suite, TaskResult } from 'vitest'

import TestsDashboardReporter from '../src/index.js'

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

let tmpDir: string
let originalCwd: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'td1-test-'))
  originalCwd = process.cwd()
  process.chdir(tmpDir)
})

afterEach(() => {
  process.chdir(originalCwd)
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

type TaskState = 'pass' | 'fail' | 'skip' | 'todo' | 'run' | 'queued'

interface BuildTaskOptions {
  name?: string
  filePath?: string
  state?: TaskState
  errorMsg?: string
  note?: string
  duration?: number
  mode?: Task['mode']
}

function buildTask(opts: BuildTaskOptions = {}): Task {
  const {
    name = 'example test',
    filePath = '/repo/src/example.test.ts',
    state = 'pass',
    errorMsg,
    note,
    duration = 42,
    mode = 'run',
  } = opts

  const result: TaskResult & Record<string, unknown> = {
    state,
    duration,
    errors: errorMsg ? [{ message: errorMsg, stack: `Error: ${errorMsg}\n  at test (/repo/src/example.test.ts:10:5)` }] : [],
  }
  if (note) result['note'] = note

  return {
    id: `${filePath}::${name}`,
    name,
    type: 'test',
    mode,
    meta: {},
    result,
    file: undefined as unknown as File,
  } as unknown as Task
}

function buildFile(tasks: Task[], filePath = '/repo/src/example.test.ts'): File {
  const state = tasks.some((t) => t.result?.state === 'fail') ? 'fail' : 'pass'
  const file: File = {
    id: filePath,
    name: filePath,
    filepath: filePath,
    type: 'suite',
    tasks,
    result: { state, duration: 100, errors: [] },
    mode: 'run',
    meta: {},
    projectName: '',
  } as unknown as File

  // Set back-reference on tasks
  for (const task of tasks) {
    (task as unknown as Record<string, unknown>)['file'] = file
  }
  return file
}

function readResults(dir: string) {
  return JSON.parse(
    fs.readFileSync(path.join(dir, '.test-dashboard', 'test-results.json'), 'utf-8')
  )
}

function readRunHistory(dir: string) {
  return JSON.parse(
    fs.readFileSync(path.join(dir, '.test-dashboard', 'test-run-history.json'), 'utf-8')
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TestsDashboardReporter — golden-file output', () => {

  test('1. all-pass: emits correct totals and schema fields', async () => {
    const reporter = new TestsDashboardReporter({ outputDir: path.join(tmpDir, '.test-dashboard') })

    const tasks = [
      buildTask({ name: 'test A', state: 'pass' }),
      buildTask({ name: 'test B', state: 'pass' }),
    ]
    const files = [buildFile(tasks)]

    await reporter.onFinished(files, [])

    const data = readResults(tmpDir)

    // ADR Decision #3 top-level fields
    expect(data.repo).toBe('strawberry-app')
    expect(data.runner).toBe('vitest')

    // Totals
    expect(data.total).toBe(2)
    expect(data.passed).toBe(2)
    expect(data.failed).toBe(0)
    expect(data.error).toBe(0)
    expect(data.skipped).toBe(0)
    expect(data.xfailed).toBe(0)
    expect(data.xpassed).toBe(0)

    // Required schema fields
    expect(data).toHaveProperty('run_timestamp')
    expect(typeof data.run_timestamp).toBe('string')
    expect(data).toHaveProperty('test_types')
    expect(data).toHaveProperty('history')
    expect(Array.isArray(data.history)).toBe(true)
    expect(data).toHaveProperty('tests')
    expect(Array.isArray(data.tests)).toBe(true)
    expect(data.tests).toHaveLength(2)

    // Per-test fields
    const testA = data.tests.find((t: { name: string }) => t.name === 'test A')
    expect(testA).toBeDefined()
    expect(testA.status).toBe('passed')
    expect(testA.nodeid).toContain('test A')
    expect(testA).toHaveProperty('file')
    expect(testA).toHaveProperty('duration')
    expect(testA).toHaveProperty('run_timestamp')
    expect(testA).toHaveProperty('history')
    expect(Array.isArray(testA.history)).toBe(true)
    expect(testA.history).toHaveLength(1)
    expect(testA.history[0].status).toBe('passed')

    // Run history file
    const runHistory = readRunHistory(tmpDir)
    expect(Array.isArray(runHistory)).toBe(true)
    expect(runHistory).toHaveLength(1)
    expect(runHistory[0].repo).toBe('strawberry-app')
    expect(runHistory[0].runner).toBe('vitest')
    expect(runHistory[0]).toHaveProperty('run_id')
    expect(runHistory[0]).toHaveProperty('timestamp')
    expect(runHistory[0]).toHaveProperty('summary')
    expect(runHistory[0].summary.passed).toBe(2)
    expect(runHistory[0].summary.failed).toBe(0)
  })

  test('2. one-fail-with-error: captures error_message and correct status', async () => {
    const reporter = new TestsDashboardReporter({ outputDir: path.join(tmpDir, '.test-dashboard') })

    const tasks = [
      buildTask({ name: 'passing test', state: 'pass' }),
      buildTask({ name: 'failing test', state: 'fail', errorMsg: 'Expected 1 to equal 2' }),
    ]
    const files = [buildFile(tasks)]

    await reporter.onFinished(files, [])

    const data = readResults(tmpDir)
    expect(data.passed).toBe(1)
    expect(data.failed).toBe(1)

    const failedTest = data.tests.find((t: { name: string }) => t.name === 'failing test')
    expect(failedTest.status).toBe('failed')
    expect(failedTest.error_message).toBeTruthy()
    expect(failedTest.error_message).toContain('Expected 1 to equal 2')

    const passingTest = data.tests.find((t: { name: string }) => t.name === 'passing test')
    expect(passingTest.error_message).toBeNull()

    // Run history failure entry
    const runHistory = readRunHistory(tmpDir)
    expect(runHistory[0].failures).toHaveLength(1)
    expect(runHistory[0].failures[0].name).toBe('failing test')
    expect(runHistory[0].failures[0].error_message).toContain('Expected 1 to equal 2')
  })

  test('3. xfail: test.fails() that correctly fails maps to xfailed status', async () => {
    // In Vitest, test.fails() that correctly fails results in state='pass' with note='xfailed'
    const reporter = new TestsDashboardReporter({ outputDir: path.join(tmpDir, '.test-dashboard') })

    const tasks = [
      buildTask({ name: 'expected failure', state: 'pass', note: 'xfailed' }),
    ]
    const files = [buildFile(tasks)]

    await reporter.onFinished(files, [])

    const data = readResults(tmpDir)
    const xfailTest = data.tests.find((t: { name: string }) => t.name === 'expected failure')
    expect(xfailTest.status).toBe('xfailed')
    expect(data.xfailed).toBe(1)
    expect(data.passed).toBe(0)
  })

  test('4. xpassed: test.fails() that unexpectedly passes maps to xpassed status', async () => {
    // In Vitest, test.fails() that unexpectedly passes results in state='pass' with note='xpassed'
    // OR state='fail' with the "this test was expected to fail" error (implementation dependent)
    const reporter = new TestsDashboardReporter({ outputDir: path.join(tmpDir, '.test-dashboard') })

    const tasks = [
      buildTask({ name: 'unexpected pass', state: 'pass', note: 'xpassed' }),
    ]
    const files = [buildFile(tasks)]

    await reporter.onFinished(files, [])

    const data = readResults(tmpDir)
    const xpassedTest = data.tests.find((t: { name: string }) => t.name === 'unexpected pass')
    expect(xpassedTest.status).toBe('xpassed')
    expect(data.xpassed).toBe(1)
  })

  test('5. skip: mode=skip maps to skipped status', async () => {
    const reporter = new TestsDashboardReporter({ outputDir: path.join(tmpDir, '.test-dashboard') })

    const tasks = [
      buildTask({ name: 'skipped test', state: 'skip' }),
    ]
    const files = [buildFile(tasks)]

    await reporter.onFinished(files, [])

    const data = readResults(tmpDir)
    const skippedTest = data.tests.find((t: { name: string }) => t.name === 'skipped test')
    expect(skippedTest.status).toBe('skipped')
    expect(data.skipped).toBe(1)
  })

  test('6. mixed run / new-test detection: second run detects new test and preserves history', async () => {
    const outDir = path.join(tmpDir, '.test-dashboard')
    const reporter1 = new TestsDashboardReporter({ outputDir: outDir })
    const reporter2 = new TestsDashboardReporter({ outputDir: outDir })

    // First run: 1 passing test
    const run1Tasks = [buildTask({ name: 'existing test', state: 'pass' })]
    await reporter1.onFinished([buildFile(run1Tasks)], [])

    // Second run: existing test still passes, new test added
    const run2Tasks = [
      buildTask({ name: 'existing test', state: 'pass' }),
      buildTask({ name: 'new test', state: 'pass', filePath: '/repo/src/new.test.ts' }),
    ]
    await reporter2.onFinished([buildFile(run2Tasks, '/repo/src/example.test.ts')], [])

    const data = readResults(tmpDir)
    expect(data.total).toBe(2)

    // Existing test should have 2 history entries (one per run)
    const existingTest = data.tests.find((t: { name: string }) => t.name === 'existing test')
    expect(existingTest.history).toHaveLength(2)

    // New test should have 1 history entry + first_seen set
    const newTest = data.tests.find((t: { name: string }) => t.name === 'new test')
    expect(newTest).toBeDefined()
    expect(newTest.history).toHaveLength(1)
    expect(newTest.first_seen).toBeTruthy()

    // Run history should have 2 entries
    const runHistory = readRunHistory(tmpDir)
    expect(runHistory).toHaveLength(2)
  })

  test('7. atomic-write: output file is never partially written (no ENOENT/parse error)', async () => {
    const reporter = new TestsDashboardReporter({ outputDir: path.join(tmpDir, '.test-dashboard') })

    const tasks = Array.from({ length: 20 }, (_, i) =>
      buildTask({ name: `test ${i}`, state: i % 3 === 0 ? 'fail' : 'pass' })
    )
    const files = [buildFile(tasks)]

    // Simulate concurrent reads during the write by starting a polling loop
    const outFile = path.join(tmpDir, '.test-dashboard', 'test-results.json')
    const readErrors: string[] = []
    let polling = true

    // Poll from a microtask perspective (synchronous reads between event loop ticks)
    const poller = setInterval(() => {
      if (!fs.existsSync(outFile)) return
      try {
        const content = fs.readFileSync(outFile, 'utf-8')
        JSON.parse(content) // must parse or it's a partial write
      } catch (e) {
        readErrors.push(String(e))
      }
    }, 0)

    await reporter.onFinished(files, [])
    polling = false
    clearInterval(poller)

    expect(readErrors).toHaveLength(0)

    // Verify the final file is valid
    const data = readResults(tmpDir)
    expect(data.repo).toBe('strawberry-app')
    expect(data.runner).toBe('vitest')
    expect(data.tests).toHaveLength(20)
  })

  test('schema parity: output includes all required fields per demo-studio-v3 schema semantics', async () => {
    const reporter = new TestsDashboardReporter({ outputDir: path.join(tmpDir, '.test-dashboard') })

    const tasks = [
      buildTask({ name: 'unit test A', state: 'pass', filePath: '/repo/src/unit.test.ts' }),
      buildTask({ name: 'integration test B', state: 'fail', filePath: '/repo/src/integration.test.ts', errorMsg: 'DB connection failed' }),
    ]
    const files = [buildFile(tasks, '/repo/src/unit.test.ts')]

    await reporter.onFinished(files, [])

    const data = readResults(tmpDir)

    // All required top-level fields from pytest plugin schema + additive fields
    expect(data).toHaveProperty('repo')
    expect(data).toHaveProperty('runner')
    expect(data).toHaveProperty('run_timestamp')
    expect(data).toHaveProperty('total')
    expect(data).toHaveProperty('passed')
    expect(data).toHaveProperty('failed')
    expect(data).toHaveProperty('error')
    expect(data).toHaveProperty('skipped')
    expect(data).toHaveProperty('xfailed')
    expect(data).toHaveProperty('xpassed')
    expect(data).toHaveProperty('test_types')
    expect(data).toHaveProperty('history')
    expect(data).toHaveProperty('tests')

    // Per-test required fields
    const test0 = data.tests[0]
    expect(test0).toHaveProperty('name')
    expect(test0).toHaveProperty('nodeid')
    expect(test0).toHaveProperty('file')
    expect(test0).toHaveProperty('status')
    expect(test0).toHaveProperty('duration')
    expect(test0).toHaveProperty('run_timestamp')
    expect(test0).toHaveProperty('trigger')
    expect(test0).toHaveProperty('component')
    expect(test0).toHaveProperty('error_message')
    expect(test0).toHaveProperty('description')
    expect(test0).toHaveProperty('history')
    expect(test0).toHaveProperty('first_seen')

    // Run history entry required fields
    const runHistory = readRunHistory(tmpDir)
    const entry = runHistory[0]
    expect(entry).toHaveProperty('repo')
    expect(entry).toHaveProperty('runner')
    expect(entry).toHaveProperty('run_id')
    expect(entry).toHaveProperty('timestamp')
    expect(entry).toHaveProperty('trigger')
    expect(entry).toHaveProperty('duration')
    expect(entry).toHaveProperty('summary')
    expect(entry).toHaveProperty('tests')
    expect(entry).toHaveProperty('failures')

    // Summary sub-fields
    expect(entry.summary).toHaveProperty('total')
    expect(entry.summary).toHaveProperty('passed')
    expect(entry.summary).toHaveProperty('failed')
    expect(entry.summary).toHaveProperty('xfailed')
    expect(entry.summary).toHaveProperty('error')
    expect(entry.summary).toHaveProperty('skipped')
  })
})

// ---------------------------------------------------------------------------
// Regression test — nodeIdOf precedence bug (Jhin review finding #2, PR #49)
//
// The while-loop condition in nodeIdOf:
//   while (current && current.type !== 'suite' || (current as Suite)?.filepath === undefined)
// evaluates as (A && B) || C rather than the intended A && (B || C).
// For Task nodes, C is always true (Task has no .filepath), so the || C arm
// masks the rest of the condition. For well-formed trees with a working
// if (!parent) break guard this happens to produce correct output; but the
// grouping is wrong and will misfire if the tree is extended or the guard
// changes. This test pins the correct traversal for a nested describe block.
// ---------------------------------------------------------------------------

describe('TestsDashboardReporter — nodeIdOf nested-describe regression (Jhin finding #2)', () => {
  test('test inside nested describe emits nodeId as filepath::describe::test', async () => {
    const filePath = '/repo/src/nested.test.ts'
    const reporter = new TestsDashboardReporter({ outputDir: path.join(tmpDir, '.test-dashboard') })

    // Build the suite chain: File suite → Describe suite → Test task
    // nodeIdOf walks up via .suite references; we set them explicitly to
    // exercise the traversal path that the precedence bug affects.
    const fileResult = { state: 'pass' as TaskState, duration: 50, errors: [] }
    const fileSuite = {
      id: filePath,
      name: filePath,
      filepath: filePath,
      type: 'suite' as const,
      tasks: [] as Task[],
      result: fileResult,
      mode: 'run' as const,
      meta: {},
      projectName: '',
      suite: undefined,      // file suite has no parent
    } as unknown as File

    const describeResult = { state: 'pass' as TaskState, duration: 30, errors: [] }
    const describeSuite = {
      id: `${filePath}::my describe`,
      name: 'my describe',
      type: 'suite' as const,
      tasks: [] as Task[],
      result: describeResult,
      mode: 'run' as const,
      meta: {},
      // No filepath — describe suites do not have filepath in Vitest
      suite: fileSuite,       // parent is the file suite
    } as unknown as Suite

    const taskResult = { state: 'pass' as TaskState, duration: 10, errors: [] }
    const nestedTask = {
      id: `${filePath}::my describe::nested test`,
      name: 'nested test',
      type: 'test' as const,
      mode: 'run' as const,
      meta: {},
      result: taskResult,
      file: fileSuite,
      suite: describeSuite,  // parent is the describe suite — this is what nodeIdOf walks
    } as unknown as Task

    // Wire up the suite tasks lists (mirrors real Vitest tree shape)
    ;(describeSuite as unknown as Record<string, unknown>)['tasks'] = [nestedTask]
    ;(fileSuite as unknown as Record<string, unknown>)['tasks'] = [describeSuite as unknown as Task]

    await reporter.onFinished([fileSuite], [])

    const data = readResults(tmpDir)
    expect(data.tests).toHaveLength(1)

    const record = data.tests[0]
    // nodeId must be filepath::describe_name::test_name
    // If the precedence bug were to cause incorrect traversal, the describe name
    // would be dropped or duplicated, producing a divergent nodeId.
    expect(record.nodeid).toBe(`${filePath}::my describe::nested test`)
    expect(record.name).toBe('nested test')
    expect(record.status).toBe('passed')
  })
})

// ---------------------------------------------------------------------------
// xfail test — must pass post-implementation (converted from reporter.xfail.test.ts pattern)
// ---------------------------------------------------------------------------

describe('TestsDashboardReporter — xfail integration (must pass post-implementation)', () => {
  test('reporter emits test-results.json with correct top-level fields after onFinished', async () => {
    const reporter = new TestsDashboardReporter({ outputDir: path.join(tmpDir, '.test-dashboard') })

    const tasks = [buildTask({ name: 'my test', state: 'pass' })]
    const files = [buildFile(tasks)]

    await reporter.onFinished(files, [])

    const outFile = path.join(tmpDir, '.test-dashboard', 'test-results.json')
    expect(fs.existsSync(outFile)).toBe(true)

    const data = JSON.parse(fs.readFileSync(outFile, 'utf-8'))
    expect(data.repo).toBe('strawberry-app')
    expect(data.runner).toBe('vitest')
    expect(data).toHaveProperty('run_timestamp')
    expect(data).toHaveProperty('total')
    expect(data).toHaveProperty('tests')
    expect(Array.isArray(data.tests)).toBe(true)
  })
})
