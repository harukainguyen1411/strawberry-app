/**
 * @strawberry/vitest-reporter-tests-dashboard
 *
 * Custom Vitest reporter that emits:
 *   .test-dashboard/test-results.json      — current-run snapshot (registry of all known tests)
 *   .test-dashboard/test-run-history.json  — ring buffer of the last 50 runs
 *
 * Schema is schema-compatible with the demo-studio-v3 conftest_results_plugin.py output,
 * extended with `repo` and `runner` top-level fields per ADR Decision #3.
 *
 * Writes atomically via temp-file + fs.renameSync so partial writes never corrupt
 * the dashboard's read path.
 *
 * Usage in vitest.config.ts:
 *   import TestsDashboardReporter from '@strawberry/vitest-reporter-tests-dashboard'
 *   export default defineConfig({
 *     test: {
 *       reporters: [new TestsDashboardReporter()],
 *     }
 *   })
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { type Reporter, type File, type TaskResultPack, type Task, type Suite } from 'vitest'
import {
  validateTestResultsPayload,
  type TestRecord,
  type TestHistoryEntry,
  type TestResultsPayload,
  type RunHistoryEntry,
  type RunSummaryEntry,
  type TestStatus,
} from './schema.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REPO = 'strawberry-app'
const RUNNER = 'vitest' as const

const MAX_HISTORY_RUNS = 10
const MAX_RUN_HISTORY_ENTRIES = 50

const OUTPUT_DIR = '.test-dashboard'
const RESULTS_FILENAME = 'test-results.json'
const RUN_HISTORY_FILENAME = 'test-run-history.json'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
}

/** Write data atomically using a temp file in the same directory + renameSync. */
function atomicWrite(filePath: string, data: unknown): void {
  const dir = path.dirname(filePath)
  fs.mkdirSync(dir, { recursive: true })

  // Create temp file in same directory to ensure rename works across same filesystem
  const tmpPath = path.join(dir, `.tmp-${process.pid}-${Date.now()}.json`)
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8')
    fs.renameSync(tmpPath, filePath)
  } catch (err) {
    // Clean up temp file if rename fails
    try { fs.unlinkSync(tmpPath) } catch { /* ignore */ }
    throw err
  }
}

/** Load JSON from disk or return a fallback. */
function loadJsonOrDefault<T>(filePath: string, fallback: T): T {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

/** Infer test category from file path (mirrors conftest_results_plugin.py). */
function inferTestType(filePath: string): string {
  const basename = path.basename(filePath)
  if (basename.includes('tdd')) return 'tdd'
  if (basename.includes('integration')) return 'integration'
  if (basename.includes('dashboard')) return 'dashboard'
  return 'unit'
}

/** Infer trigger from file path. */
function inferTrigger(filePath: string): string {
  const basename = path.basename(filePath)
  if (basename.includes('tdd')) return 'pre-commit'
  if (basename.includes('integration')) return 'pre-push'
  return process.env['TEST_TRIGGER'] ?? 'manual'
}

/** Map Vitest task state + optional xfail/skip semantics to a TestStatus. */
function resolveStatus(task: Task): TestStatus {
  const result = task.result
  if (!result) return 'skipped'

  const state = result.state

  // Vitest sets result.note for xfail / xpassed
  // Check for retry-related annotations via mode
  if (state === 'pass') {
    // Check if this was an expected failure (xfail that passed = xpassed)
    if (task.mode === 'todo') return 'skipped'
    if ((result as Record<string, unknown>)['note'] === 'xfailed') return 'xfailed'
    if ((result as Record<string, unknown>)['note'] === 'xpassed') return 'xpassed'
    return 'passed'
  }

  if (state === 'fail') {
    if (task.mode === 'todo') return 'skipped'
    // test.fails() is Vitest xfail — when the test correctly fails, state is 'pass'
    // When a test.fails() unexpectedly passes, state is 'fail' with a specific error
    if ((result as Record<string, unknown>)['note'] === 'xfailed') return 'xfailed'
    return 'failed'
  }

  if (state === 'skip') return 'skipped'
  if (state === 'todo') return 'skipped'

  // Vitest internal states
  if (state === 'run' || state === 'queued') return 'skipped'

  return 'skipped'
}

/** Determine if a task is a leaf test (not a suite). */
function isLeafTest(task: Task): boolean {
  return task.type === 'test' || task.type === 'custom'
}

/** Recursively collect all leaf tests from a File's task tree. */
function collectTests(tasks: Task[]): Task[] {
  const result: Task[] = []
  for (const task of tasks) {
    if (isLeafTest(task)) {
      result.push(task)
    } else {
      // Suite — recurse
      const suite = task as Suite
      if (suite.tasks && suite.tasks.length > 0) {
        result.push(...collectTests(suite.tasks))
      }
    }
  }
  return result
}

/** Derive a node ID string from a Vitest task. */
function nodeIdOf(task: Task, filePath: string): string {
  // Build a path of suite/test names from the task upward
  const parts: string[] = []
  let current: Task | Suite = task
  while (current && current.type !== 'suite' || (current as Suite)?.filepath === undefined) {
    parts.unshift(current.name)
    const parent = (current as Task & { suite?: Suite }).suite
    if (!parent) break
    current = parent as Task
  }
  const relative = filePath.startsWith('/') ? filePath : filePath
  return `${relative}::${parts.join('::')}`
}

// ---------------------------------------------------------------------------
// Reporter
// ---------------------------------------------------------------------------

/**
 * TestsDashboardReporter implements Vitest's Reporter interface.
 *
 * It collects test results during the run and writes them to disk in
 * onFinished, atomically, to .test-dashboard/test-results.json and
 * .test-dashboard/test-run-history.json.
 */
export default class TestsDashboardReporter implements Reporter {
  private readonly outputDir: string
  private readonly resultsPath: string
  private readonly runHistoryPath: string
  private readonly startTime: number

  constructor(options: { outputDir?: string } = {}) {
    // Allow output dir to be overridden (useful in tests)
    this.outputDir = options.outputDir ?? path.join(process.cwd(), OUTPUT_DIR)
    this.resultsPath = path.join(this.outputDir, RESULTS_FILENAME)
    this.runHistoryPath = path.join(this.outputDir, RUN_HISTORY_FILENAME)
    this.startTime = Date.now()
  }

  // onTestFinished is called for each test as it completes (Vitest 4.x hook).
  // We don't need to store state here — onFinished gives us the full file tree.
  onTestFinished(_test: unknown, _result: unknown): void {
    // No-op: we process everything in onFinished for a consistent snapshot.
  }

  /**
   * Called after all tests in the run complete.
   * Builds the payload and writes both output files atomically.
   */
  async onFinished(files: File[] = [], _errors: unknown[] = []): Promise<void> {
    const runTs = nowIso()
    const runId = runTs.replace(/[:.+]/g, '-')
    const durationS = Math.round((Date.now() - this.startTime) / 10) / 100

    // ---------------------------------------------------------------------------
    // 1. Load previous test-results.json (for history ring maintenance)
    // ---------------------------------------------------------------------------
    const prevData = loadJsonOrDefault<TestResultsPayload | Record<string, unknown>>(
      this.resultsPath,
      {}
    )
    const prevTestsByNodeId = new Map<string, TestRecord>(
      ((prevData as TestResultsPayload).tests ?? []).map((t) => [t.nodeid, t])
    )

    // ---------------------------------------------------------------------------
    // 2. Collect current-run results from all files
    // ---------------------------------------------------------------------------
    const currentResults: TestRecord[] = []
    const collectedNodeIds = new Set<string>()

    for (const file of files) {
      const leafTests = collectTests(file.tasks)
      for (const task of leafTests) {
        const filePath = file.filepath ?? file.name
        const nodeid = nodeIdOf(task, filePath)
        const status = resolveStatus(task)
        const duration = Math.round((task.result?.duration ?? 0) * 10) / 10

        const errorMessage = resolveErrorMessage(task, status)
        const trigger = inferTrigger(filePath)

        collectedNodeIds.add(nodeid)

        const prev = prevTestsByNodeId.get(nodeid)
        const prevHistory: TestHistoryEntry[] = prev?.history ?? []
        const historyEntry: TestHistoryEntry = { status, duration, run_timestamp: runTs }
        const updatedHistory = [...prevHistory, historyEntry].slice(-MAX_HISTORY_RUNS)

        const record: TestRecord = {
          name: task.name,
          nodeid,
          file: filePath,
          status,
          duration,
          run_timestamp: runTs,
          trigger,
          component: null,
          error_message: errorMessage,
          description: '',
          history: updatedHistory,
          first_seen: prev?.first_seen ?? runTs,
        }

        currentResults.push(record)
      }
    }

    // ---------------------------------------------------------------------------
    // 3. Merge current run results into the registry (preserve tests not in this run)
    // ---------------------------------------------------------------------------
    for (const record of currentResults) {
      prevTestsByNodeId.set(record.nodeid, record)
    }

    // Prune tests whose source files no longer exist (matches pytest plugin logic)
    const mergedTests: TestRecord[] = [...prevTestsByNodeId.values()].filter((t) => {
      if (collectedNodeIds.has(t.nodeid)) return true
      // Check if file still exists
      const filePath = t.file
      if (filePath && !fs.existsSync(filePath)) return false
      return true
    })

    // ---------------------------------------------------------------------------
    // 4. Build totals
    // ---------------------------------------------------------------------------
    const passed = mergedTests.filter((t) => t.status === 'passed').length
    const failed = mergedTests.filter((t) => t.status === 'failed').length
    const error = mergedTests.filter((t) => t.status === 'error').length
    const skipped = mergedTests.filter((t) => t.status === 'skipped').length
    const xfailed = mergedTests.filter((t) => t.status === 'xfailed').length
    const xpassed = mergedTests.filter((t) => t.status === 'xpassed').length

    // Session-only totals (for top-level history and run-history)
    const sessionPassed = currentResults.filter((t) => t.status === 'passed').length
    const sessionFailed = currentResults.filter((t) => t.status === 'failed').length
    const sessionError = currentResults.filter((t) => t.status === 'error').length
    const sessionSkipped = currentResults.filter((t) => t.status === 'skipped').length
    const sessionXfailed = currentResults.filter((t) => t.status === 'xfailed').length
    const sessionXpassed = currentResults.filter((t) => t.status === 'xpassed').length

    // ---------------------------------------------------------------------------
    // 5. Build test_types grouping
    // ---------------------------------------------------------------------------
    const testTypes: Record<string, string[]> = {}
    for (const t of mergedTests) {
      const category = inferTestType(t.file)
      if (!testTypes[category]) testTypes[category] = []
      testTypes[category].push(t.nodeid)
    }

    // ---------------------------------------------------------------------------
    // 6. Build top-level run summary history
    // ---------------------------------------------------------------------------
    const prevTopHistory: RunSummaryEntry[] = (prevData as TestResultsPayload).history ?? []
    const runSummaryEntry: RunSummaryEntry = {
      run_timestamp: runTs,
      total: currentResults.length,
      passed: sessionPassed,
      failed: sessionFailed,
      error: sessionError,
      skipped: sessionSkipped,
      xfailed: sessionXfailed,
      xpassed: sessionXpassed,
    }
    const topHistory = [...prevTopHistory, runSummaryEntry].slice(-MAX_HISTORY_RUNS)

    // ---------------------------------------------------------------------------
    // 7. Build test-results.json payload and validate
    // ---------------------------------------------------------------------------
    const payload: TestResultsPayload = {
      repo: REPO,
      runner: RUNNER,
      run_timestamp: runTs,
      total: mergedTests.length,
      passed,
      failed,
      error,
      skipped,
      xfailed,
      xpassed,
      test_types: testTypes,
      history: topHistory,
      tests: mergedTests,
    }

    validateTestResultsPayload(payload)

    // ---------------------------------------------------------------------------
    // 8. Build test-run-history.json entry
    // ---------------------------------------------------------------------------
    const historyEntry: RunHistoryEntry = {
      repo: REPO,
      runner: RUNNER,
      run_id: runId,
      timestamp: runTs,
      trigger: process.env['TEST_TRIGGER'] ?? 'manual',
      duration: durationS,
      summary: {
        total: sessionPassed + sessionXpassed + sessionFailed + sessionError + sessionSkipped + sessionXfailed,
        passed: sessionPassed + sessionXpassed,
        failed: sessionFailed,
        xfailed: sessionXfailed,
        error: sessionError,
        skipped: sessionSkipped,
      },
      tests: currentResults.map((t) => ({
        nodeid: t.nodeid,
        status: t.status,
        error_message: t.error_message,
      })),
      failures: currentResults
        .filter((t) => t.status === 'failed' || t.status === 'error')
        .map((t) => ({
          name: t.name,
          nodeid: t.nodeid,
          error_message: t.error_message,
        })),
    }

    const existingHistory = loadJsonOrDefault<RunHistoryEntry[]>(this.runHistoryPath, [])
    const updatedHistory = [...existingHistory, historyEntry].slice(-MAX_RUN_HISTORY_ENTRIES)

    // ---------------------------------------------------------------------------
    // 9. Atomic writes
    // ---------------------------------------------------------------------------
    atomicWrite(this.resultsPath, payload)
    atomicWrite(this.runHistoryPath, updatedHistory)
  }
}

// ---------------------------------------------------------------------------
// Error message extraction helper
// ---------------------------------------------------------------------------

function resolveErrorMessage(task: Task, status: TestStatus): string | null {
  if (status !== 'failed' && status !== 'error' && status !== 'skipped') return null

  const result = task.result
  if (!result) return null

  if (status === 'skipped') {
    // Vitest records skip reason in result.note
    const note = (result as Record<string, unknown>)['note']
    if (typeof note === 'string') return note
    return null
  }

  // Collect error messages from errors array
  const errors = result.errors
  if (errors && errors.length > 0) {
    return errors
      .map((e) => {
        const msg = e.message ?? ''
        const stack = e.stack ?? ''
        return stack ? `${msg}\n${stack}` : msg
      })
      .join('\n\n')
  }

  return null
}

// Re-export types for consumers
export type {
  TestRecord,
  TestResultsPayload,
  RunHistoryEntry,
  TestStatus,
  RunnerType,
} from './schema.js'
