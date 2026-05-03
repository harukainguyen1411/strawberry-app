/**
 * Playwright globalSetup — starts Firebase emulators and seeds test data.
 *
 * Boots auth + firestore + functions emulators for the portfolio-tracker-e2e
 * project. Seeds config/auth_allowlist with the test email so the
 * beforeUserSignedIn blocking function allows sign-in.
 *
 * Behaviour:
 *   - If emulators are already running (reuseExistingServer / local dev),
 *     just seeds the allowlist and returns.
 *   - If SKIP_EMULATORS=true is set, no-ops immediately (used in xfail verification).
 *   - Otherwise, spawns emulators, waits for them, seeds, and saves the PID
 *     for globalTeardown to clean up.
 *
 * Refs V0.18
 */

import { spawn, execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PT_DIR = path.resolve(__dirname, '..')
const PROJECT_ID = 'portfolio-tracker-e2e'

// Store the emulator process handle so teardown can kill it
export const PID_FILE = path.join(PT_DIR, 'e2e', '.emulator.pid')

// How long to wait for emulators
const WAIT_MS = process.env.CI ? 90_000 : 60_000

export default async function globalSetup() {
  // Allow skipping emulator startup entirely (e.g. for xfail-only verification)
  if (process.env.SKIP_EMULATORS === 'true') {
    console.log('[global-setup] SKIP_EMULATORS=true — no-op.')
    return
  }

  // Quick probe: are emulators already running? (reuseExistingServer mode)
  const alreadyUp = await probeEmulators(2_000)
  if (alreadyUp) {
    console.log('[global-setup] Emulators already running — skipping spawn.')
    await clearEmulatorData()
    await seedAllowlist()
    return
  }

  console.log('[global-setup] Building Cloud Functions (noEmitOnError false)…')
  try {
    execSync('npx tsc --noEmitOnError false', {
      cwd: path.join(PT_DIR, 'functions'),
      stdio: 'pipe',
    })
  } catch {
    // TS errors are pre-existing; JS output is still emitted when noEmitOnError=false
    console.warn('[global-setup] tsc reported pre-existing errors; JS output still emitted')
  }

  console.log('[global-setup] Starting Firebase emulators…')
  const emulatorProcess = spawn(
    'firebase',
    [
      'emulators:start',
      '--only', 'auth,firestore,functions',
      '--project', PROJECT_ID,
    ],
    {
      cwd: PT_DIR,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        // Suppress interactive prompts
        CI: '1',
      },
    },
  )

  // Save PID for teardown
  writeFileSync(PID_FILE, String(emulatorProcess.pid ?? ''))

  // Forward emulator output for debugging
  emulatorProcess.stdout?.on('data', (chunk: Buffer) => {
    process.stdout.write('[emulator] ' + chunk.toString())
  })
  emulatorProcess.stderr?.on('data', (chunk: Buffer) => {
    process.stderr.write('[emulator] ' + chunk.toString())
  })

  // Wait for emulators to be ready
  const ready = await waitForEmulators(WAIT_MS)
  if (!ready) {
    throw new Error('[global-setup] Timed out waiting for Firebase emulators')
  }

  // Clear any stale data from previous runs, then seed
  await clearEmulatorData()
  await seedAllowlist()
  console.log('[global-setup] Emulators ready, allowlist seeded.')
}

async function probeProjectScopedEmulator(host: string, path: string, timeoutMs: number): Promise<boolean> {
  // Project-scoped probe — only 200s when the emulator is running for *this* project.
  // Plain `fetch('http://127.0.0.1:9099/')` returns 200 for any process bound to the port,
  // including a stranger's emulator on a different project — would make us silently wipe their data.
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const res = await fetch(`http://${host}${path}`, { signal: controller.signal })
    clearTimeout(timer)
    return res.ok
  } catch {
    return false
  }
}

async function probeEmulators(timeoutMs: number): Promise<boolean> {
  return probeProjectScopedEmulator(
    '127.0.0.1:9099',
    `/emulator/v1/projects/${PROJECT_ID}/config`,
    timeoutMs,
  )
}

async function waitForEmulators(maxWaitMs: number, intervalMs = 1_000): Promise<boolean> {
  const deadline = Date.now() + maxWaitMs
  while (Date.now() < deadline) {
    const [authOk, fsOk] = await Promise.all([
      probeProjectScopedEmulator(
        '127.0.0.1:9099',
        `/emulator/v1/projects/${PROJECT_ID}/config`,
        2_000,
      ),
      probeProjectScopedEmulator(
        '127.0.0.1:8080',
        `/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
        2_000,
      ),
    ])
    if (authOk && fsOk) {
      console.log('[global-setup] Auth + Firestore emulators are up.')
      return true
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
  return false
}

async function clearEmulatorData(): Promise<void> {
  // Clear Firestore emulator data so each run starts clean.
  // Uses the emulator's admin HTTP endpoint (DELETE all documents).
  const url =
    `http://127.0.0.1:8080/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`
  const res = await fetch(url, { method: 'DELETE' })
  if (!res.ok && res.status !== 404) {
    const text = await res.text()
    console.warn(`[global-setup] clearEmulatorData warning: HTTP ${res.status}: ${text}`)
  } else {
    console.log('[global-setup] Firestore emulator data cleared.')
  }

  // Clear Auth emulator accounts
  const authUrl =
    `http://127.0.0.1:9099/emulator/v1/projects/${PROJECT_ID}/accounts`
  const authRes = await fetch(authUrl, { method: 'DELETE' })
  if (!authRes.ok && authRes.status !== 404 && authRes.status !== 405) {
    const text = await authRes.text()
    console.warn(`[global-setup] clearAuthData warning: HTTP ${authRes.status}: ${text}`)
  } else {
    console.log('[global-setup] Auth emulator accounts cleared.')
  }
}

async function seedAllowlist(): Promise<void> {
  // Use the Firestore emulator REST API with the admin bypass token.
  // The config/auth_allowlist doc has `allow read, write: if false` in
  // production rules; the emulator honours `Authorization: Bearer owner` to
  // bypass security rules for seed/teardown operations.
  const url =
    `http://127.0.0.1:8080/v1/projects/${PROJECT_ID}/databases/(default)/documents/config/auth_allowlist`
  const body = {
    fields: {
      emails: {
        arrayValue: {
          values: [{ stringValue: 'duong@allowed.test' }],
        },
      },
    },
  }

  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      // Emulator admin bypass — bypasses Firestore security rules
      Authorization: 'Bearer owner',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Failed to seed allowlist — HTTP ${res.status}: ${text}`)
  }
  console.log('[global-setup] Allowlist seeded: duong@allowed.test')
}
