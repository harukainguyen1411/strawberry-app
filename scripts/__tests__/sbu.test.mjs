// xfail: plan plans/approved/2026-04-19-claude-usage-dashboard-tasks.md T6
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync, spawnSync } from 'node:child_process';

const REPO_ROOT = new URL('../../', import.meta.url).pathname.replace(/\/$/, '');
const SBU_SH = join(REPO_ROOT, 'scripts/usage-dashboard/sbu.sh');

/**
 * Run sbu.sh with custom env, shimmed build.sh and open command, return result.
 */
function runSbu(args = [], env = {}) {
  return spawnSync('bash', [SBU_SH, ...args], {
    env: { ...process.env, ...env },
    stdio: 'pipe',
    timeout: 10000,
  });
}

// --- Test 1: sbu with stubbed build.sh (true) and shimmed open exits 0 and records no PID file ---
test(
  'sbu with stubbed build.sh (true) and shimmed open exits 0 and records no PID file',
  {},
  () => {
    const dir = mkdtempSync(join(tmpdir(), 'sbu-t1-'));
    const pidDir = mkdtempSync(join(tmpdir(), 'sbu-pid-'));
    try {
      // build.sh shim that always succeeds
      const buildShim = join(dir, 'build.sh');
      writeFileSync(buildShim, '#!/bin/sh\nexit 0\n');
      execSync(`chmod +x ${buildShim}`);

      // open shim that always succeeds (prevents actual browser open)
      const openShim = join(dir, 'open');
      writeFileSync(openShim, '#!/bin/sh\nexit 0\n');
      execSync(`chmod +x ${openShim}`);

      const pidFile = join(pidDir, 'refresh-server.pid');

      const result = runSbu([], {
        PATH: `${dir}:${process.env.PATH}`,
        BUILD_SH: buildShim,
        PID_FILE: pidFile,
        REPO_ROOT,
      });

      assert.equal(result.status, 0, `Expected exit 0, got ${result.status}. stderr: ${result.stderr.toString()}`);
      assert.ok(!existsSync(pidFile), 'PID file should NOT be created when --serve is not passed');
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(pidDir, { recursive: true, force: true });
    }
  }
);

// --- Test 2: sbu --serve spawns refresh-server and writes PID file ---
test(
  'sbu --serve spawns refresh-server and writes PID file',
  {},
  () => {
    const dir = mkdtempSync(join(tmpdir(), 'sbu-t2-'));
    const pidDir = mkdtempSync(join(tmpdir(), 'sbu-pid2-'));
    try {
      // build.sh shim
      const buildShim = join(dir, 'build.sh');
      writeFileSync(buildShim, '#!/bin/sh\nexit 0\n');
      execSync(`chmod +x ${buildShim}`);

      // open shim
      const openShim = join(dir, 'open');
      writeFileSync(openShim, '#!/bin/sh\nexit 0\n');
      execSync(`chmod +x ${openShim}`);

      // refresh-server shim: just sleeps briefly to simulate server startup
      const serverShim = join(dir, 'refresh-server.mjs');
      writeFileSync(serverShim, '#!/usr/bin/env node\nsetTimeout(() => {}, 2000);\n');

      const pidFile = join(pidDir, 'refresh-server.pid');

      const result = runSbu(['--serve'], {
        PATH: `${dir}:${process.env.PATH}`,
        BUILD_SH: buildShim,
        REFRESH_SERVER_MJS: serverShim,
        PID_FILE: pidFile,
        REPO_ROOT,
      });

      assert.equal(result.status, 0, `Expected exit 0, got ${result.status}. stderr: ${result.stderr.toString()}`);
      assert.ok(existsSync(pidFile), 'PID file SHOULD be created when --serve is passed');
      const pid = readFileSync(pidFile, 'utf8').trim();
      assert.ok(/^\d+$/.test(pid), `PID file should contain a numeric PID, got: ${pid}`);

      // Clean up the spawned process
      try { process.kill(parseInt(pid, 10), 'SIGTERM'); } catch { /* already exited */ }
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(pidDir, { recursive: true, force: true });
    }
  }
);

// --- Test 4: open_url() errors when no open/xdg-open/start is on PATH ---
test(
  'open_url errors with readable hint when open, xdg-open, and start are all absent',
  {},
  () => {
    const dir = mkdtempSync(join(tmpdir(), 'sbu-t4-'));
    const pidDir = mkdtempSync(join(tmpdir(), 'sbu-pid4-'));
    try {
      // build.sh shim that succeeds
      const buildShim = join(dir, 'build.sh');
      writeFileSync(buildShim, '#!/bin/sh\nexit 0\n');
      execSync(`chmod +x ${buildShim}`);

      // Build a synthetic PATH: symlink every executable from /usr/bin and /bin
      // into a fake bin dir, EXCEPT open/xdg-open/start, so sbu.sh can still
      // find dirname, nohup, etc. but not any browser opener.
      const fakeBin = join(dir, 'bin');
      execSync(`mkdir -p ${fakeBin}`);
      for (const srcDir of ['/bin', '/usr/bin']) {
        execSync(
          `for f in ${srcDir}/*; do [ -x "$f" ] && b=$(basename "$f"); ` +
          `case "$b" in open|xdg-open|start) ;; *) ln -sf "$f" ${fakeBin}/"$b" 2>/dev/null || true ;; esac; done`,
          { shell: '/bin/sh' }
        );
      }

      // Use the full original PATH but replace /usr/bin entries with fakeBin
      const safePath = [
        dir,       // build.sh shim lives here
        fakeBin,   // /usr/bin tools minus open/xdg-open/start
        ...process.env.PATH.split(':').filter((d) => !/\/usr\/bin(\/|$)/.test(d)),
      ].join(':');

      const pidFile = join(pidDir, 'refresh-server.pid');

      const result = runSbu([], {
        PATH: safePath,
        BUILD_SH: buildShim,
        PID_FILE: pidFile,
        REPO_ROOT,
      });

      // sbu should exit non-zero because open_url cannot find any opener
      assert.notEqual(result.status, 0, `Expected non-zero exit, got ${result.status}`);
      const stderr = result.stderr.toString();
      assert.ok(
        stderr.includes('open') || stderr.includes('xdg-open') || stderr.includes('start'),
        `Expected hint mentioning open helpers, got stderr: ${stderr}`
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(pidDir, { recursive: true, force: true });
    }
  }
);

// --- Test 3: second sbu --serve while PID file alive refuses to start ---
test(
  'second sbu --serve while PID file is alive refuses to start another instance',
  {},
  () => {
    const dir = mkdtempSync(join(tmpdir(), 'sbu-t3-'));
    const pidDir = mkdtempSync(join(tmpdir(), 'sbu-pid3-'));
    try {
      const buildShim = join(dir, 'build.sh');
      writeFileSync(buildShim, '#!/bin/sh\nexit 0\n');
      execSync(`chmod +x ${buildShim}`);

      const openShim = join(dir, 'open');
      writeFileSync(openShim, '#!/bin/sh\nexit 0\n');
      execSync(`chmod +x ${openShim}`);

      const serverShim = join(dir, 'refresh-server.mjs');
      writeFileSync(serverShim, '#!/usr/bin/env node\nsetTimeout(() => {}, 5000);\n');
      execSync(`chmod +x ${serverShim}`);

      const pidFile = join(pidDir, 'refresh-server.pid');

      // Write a live PID (use the current test process PID as a "live" process)
      const livePid = process.pid;
      mkdirSync(pidDir, { recursive: true });
      writeFileSync(pidFile, String(livePid));

      // Second invocation should refuse
      const result = runSbu(['--serve'], {
        PATH: `${dir}:${process.env.PATH}`,
        BUILD_SH: buildShim,
        REFRESH_SERVER_MJS: serverShim,
        PID_FILE: pidFile,
        REPO_ROOT,
      });

      assert.notEqual(result.status, 0, 'Second sbu --serve with live PID file should exit non-zero');
      const combined = result.stdout.toString() + result.stderr.toString();
      assert.ok(
        combined.toLowerCase().includes('already') || combined.toLowerCase().includes('running'),
        `Expected "already running" message, got: ${combined}`
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(pidDir, { recursive: true, force: true });
    }
  }
);
