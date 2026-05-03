/**
 * Playwright globalTeardown — stops Firebase emulators.
 *
 * Reads the PID written by global-setup.ts and sends SIGTERM to the process
 * group so the emulator's child JVM processes also exit cleanly.
 *
 * Refs V0.18
 */

import { readFileSync, existsSync, unlinkSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PID_FILE = path.join(__dirname, '.emulator.pid')

export default async function globalTeardown() {
  if (!existsSync(PID_FILE)) {
    console.log('[global-teardown] No emulator PID file found; skipping.')
    return
  }

  const pid = parseInt(readFileSync(PID_FILE, 'utf8').trim(), 10)
  unlinkSync(PID_FILE)

  if (!pid || isNaN(pid)) {
    console.log('[global-teardown] Invalid PID; skipping.')
    return
  }

  console.log(`[global-teardown] Stopping emulator process group (PID ${pid})…`)
  try {
    // Negative pid kills the entire process group
    process.kill(-pid, 'SIGTERM')
  } catch (err) {
    // Process may already be gone
    console.warn(`[global-teardown] kill(-${pid}) failed:`, (err as Error).message)
  }

  // Give processes a moment to exit
  await new Promise((resolve) => setTimeout(resolve, 2_000))
  console.log('[global-teardown] Done.')
}
