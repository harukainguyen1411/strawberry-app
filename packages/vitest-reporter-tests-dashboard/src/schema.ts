/**
 * Typed representation of the shared tests-dashboard JSON schema.
 *
 * This module mirrors the structure produced by the demo-studio-v3 pytest plugin
 * (conftest_results_plugin.py) with two additive top-level fields: `repo` and
 * `runner` (per ADR Decision #3).
 *
 * The canonical schema file lives at:
 *   strawberry-agents/schemas/tests-dashboard-data-schema.json
 *
 * This module validates emitted payloads at write time and throws on drift so
 * that schema incompatibilities surface immediately during development rather than
 * silently corrupting the dashboard.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TestStatus = 'passed' | 'failed' | 'error' | 'skipped' | 'xfailed' | 'xpassed'

export type RunnerType = 'vitest' | 'playwright' | 'pytest' | 'bash'

/** One entry in a test's per-test history ring (last 10 runs). */
export interface TestHistoryEntry {
  status: TestStatus
  duration: number
  run_timestamp: string
}

/** Per-test record in test-results.json `tests[]`. */
export interface TestRecord {
  name: string
  nodeid: string
  file: string
  status: TestStatus
  duration: number
  run_timestamp: string
  trigger: string
  component: string | null
  error_message: string | null
  description: string
  /** Rolling history ring for this test (last 10 runs). */
  history: TestHistoryEntry[]
  /** first_seen timestamp — ISO-8601. Set on first encounter. */
  first_seen?: string
}

/** One entry in the top-level history array of test-results.json (last 10 runs). */
export interface RunSummaryEntry {
  run_timestamp: string
  total: number
  passed: number
  failed: number
  error: number
  skipped: number
  xfailed: number
  xpassed: number
}

/** Group of test node IDs by category (unit / integration / dashboard). */
export type TestTypes = Record<string, string[]>

/** test-results.json root. */
export interface TestResultsPayload {
  /** ADR Decision #3 — repo identifier. */
  repo: string
  /** ADR Decision #3 — runner identifier. */
  runner: RunnerType
  run_timestamp: string
  total: number
  passed: number
  failed: number
  error: number
  skipped: number
  xfailed: number
  xpassed: number
  test_types: TestTypes
  /** Top-level run-summary history (last 10 runs). */
  history: RunSummaryEntry[]
  tests: TestRecord[]
}

// ---------------------------------------------------------------------------
// test-run-history.json types
// ---------------------------------------------------------------------------

export interface RunHistorySummary {
  total: number
  passed: number
  failed: number
  xfailed: number
  error: number
  skipped: number
}

export interface RunHistoryTestEntry {
  nodeid: string
  status: TestStatus
  error_message: string | null
}

export interface RunHistoryFailureEntry {
  name: string
  nodeid: string
  error_message: string | null
}

/** One entry in test-run-history.json (a ring buffer of recent runs). */
export interface RunHistoryEntry {
  /** ADR Decision #3 — repo identifier. */
  repo: string
  /** ADR Decision #3 — runner identifier. */
  runner: RunnerType
  run_id: string
  timestamp: string
  trigger: string
  duration: number
  summary: RunHistorySummary
  tests: RunHistoryTestEntry[]
  failures: RunHistoryFailureEntry[]
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const VALID_STATUSES = new Set<string>(['passed', 'failed', 'error', 'skipped', 'xfailed', 'xpassed'])
const VALID_RUNNERS = new Set<string>(['vitest', 'playwright', 'pytest', 'bash'])

/**
 * Lightweight structural validation that throws if required fields are missing
 * or have wrong types.  Not a full JSON-Schema validator — the canonical
 * validation is done in test suites via tests-dashboard-data-schema.json.
 */
export function validateTestResultsPayload(payload: unknown): asserts payload is TestResultsPayload {
  if (typeof payload !== 'object' || payload === null) {
    throw new TypeError('[vitest-reporter-tests-dashboard] payload must be an object')
  }
  const p = payload as Record<string, unknown>

  assertString(p, 'repo')
  assertString(p, 'runner')
  if (!VALID_RUNNERS.has(p['runner'] as string)) {
    throw new TypeError(`[vitest-reporter-tests-dashboard] runner must be one of ${[...VALID_RUNNERS].join(', ')}; got ${p['runner']}`)
  }
  assertString(p, 'run_timestamp')
  assertNumber(p, 'total')
  assertNumber(p, 'passed')
  assertNumber(p, 'failed')
  assertNumber(p, 'error')
  assertNumber(p, 'skipped')
  assertNumber(p, 'xfailed')
  assertNumber(p, 'xpassed')
  assertArray(p, 'tests')
  assertArray(p, 'history')

  for (const test of p['tests'] as unknown[]) {
    validateTestRecord(test)
  }
}

function validateTestRecord(record: unknown): asserts record is TestRecord {
  if (typeof record !== 'object' || record === null) {
    throw new TypeError('[vitest-reporter-tests-dashboard] test record must be an object')
  }
  const r = record as Record<string, unknown>
  assertString(r, 'name')
  assertString(r, 'nodeid')
  assertString(r, 'file')
  assertString(r, 'status')
  if (!VALID_STATUSES.has(r['status'] as string)) {
    throw new TypeError(`[vitest-reporter-tests-dashboard] test status must be one of ${[...VALID_STATUSES].join(', ')}; got ${r['status']}`)
  }
  assertNumber(r, 'duration')
  assertString(r, 'run_timestamp')
  assertArray(r, 'history')
}

function assertString(obj: Record<string, unknown>, key: string): void {
  if (typeof obj[key] !== 'string') {
    throw new TypeError(`[vitest-reporter-tests-dashboard] expected string at key "${key}", got ${typeof obj[key]}`)
  }
}

function assertNumber(obj: Record<string, unknown>, key: string): void {
  if (typeof obj[key] !== 'number') {
    throw new TypeError(`[vitest-reporter-tests-dashboard] expected number at key "${key}", got ${typeof obj[key]}`)
  }
}

function assertArray(obj: Record<string, unknown>, key: string): void {
  if (!Array.isArray(obj[key])) {
    throw new TypeError(`[vitest-reporter-tests-dashboard] expected array at key "${key}", got ${typeof obj[key]}`)
  }
}
