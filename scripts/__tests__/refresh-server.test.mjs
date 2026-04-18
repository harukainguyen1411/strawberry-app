// xfail: plan plans/approved/2026-04-19-claude-usage-dashboard-tasks.md T5
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import http from 'node:http';

const REPO_ROOT = new URL('../../', import.meta.url).pathname.replace(/\/$/, '');
const SERVER_MJS = join(REPO_ROOT, 'scripts/usage-dashboard/refresh-server.mjs');

/**
 * Starts the refresh server on a given port (set via env PORT).
 * Returns { port, cleanup }.
 */
function startServer(port, env = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', [SERVER_MJS], {
      env: { ...process.env, PORT: String(port), ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    let started = false;
    proc.stdout.on('data', (data) => {
      if (!started && data.toString().includes('listening')) {
        started = true;
        resolve({
          port,
          cleanup: () => new Promise((res) => {
            proc.kill('SIGTERM');
            proc.on('exit', res);
          }),
        });
      }
    });

    proc.on('exit', (code) => {
      if (!started) reject(new Error(`Server exited early (code ${code}): ${stderr}`));
    });

    setTimeout(() => {
      if (!started) {
        proc.kill();
        reject(new Error(`Server did not start within 3000ms. stderr: ${stderr}`));
      }
    }, 3000);
  });
}

function httpRequest(port, method, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: '127.0.0.1', port, path, method, headers },
      (res) => {
        let body = '';
        res.on('data', (d) => { body += d; });
        res.on('end', () => resolve({ status: res.statusCode, body, headers: res.headers }));
      }
    );
    req.on('error', reject);
    req.end();
  });
}

// Use staggered ports to avoid collisions between parallel tests
const BASE_PORT = 47660;

// --- Test 1: GET /health returns 200 with {ok:true, version:"1"} ---
test(
  'GET /health returns 200 with {ok:true, version:"1"}',
  {},
  async () => {
    const { port, cleanup } = await startServer(BASE_PORT);
    try {
      const res = await httpRequest(port, 'GET', '/health');
      assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
      const body = JSON.parse(res.body);
      assert.equal(body.ok, true);
      assert.equal(body.version, '1');
    } finally {
      await cleanup();
    }
  }
);

// --- Test 2: POST /refresh with stubbed succeeding build.sh returns 200 ok:true ---
test(
  'POST /refresh with stubbed build.sh that succeeds returns 200 with ok:true',
  {},
  async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rs-t2-'));
    try {
      const shimPath = join(dir, 'build.sh');
      writeFileSync(shimPath, '#!/bin/sh\nexit 0\n');

      const { port, cleanup } = await startServer(BASE_PORT + 1, { BUILD_SH: shimPath });
      try {
        const res = await httpRequest(port, 'POST', '/refresh', { Origin: 'null' });
        assert.equal(res.status, 200, `Expected 200, got ${res.status}: ${res.body}`);
        const body = JSON.parse(res.body);
        assert.equal(body.ok, true);
        assert.ok(typeof body.updatedAt === 'string', 'updatedAt should be a string');
        assert.ok(typeof body.durationMs === 'number', 'durationMs should be a number');
      } finally {
        await cleanup();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
);

// --- Test 3: POST /refresh with stubbed failing build.sh returns 500 ok:false ---
test(
  'POST /refresh with stubbed failing build.sh returns 500 with ok:false and error',
  {},
  async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rs-t3-'));
    try {
      const shimPath = join(dir, 'build.sh');
      writeFileSync(shimPath, '#!/bin/sh\nexit 1\n');

      const { port, cleanup } = await startServer(BASE_PORT + 2, { BUILD_SH: shimPath });
      try {
        const res = await httpRequest(port, 'POST', '/refresh', { Origin: 'null' });
        assert.equal(res.status, 500, `Expected 500, got ${res.status}: ${res.body}`);
        const body = JSON.parse(res.body);
        assert.equal(body.ok, false);
        assert.ok(typeof body.error === 'string', 'error should be a string');
      } finally {
        await cleanup();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
);

// --- Test 4: Non-local Origin returns 403 ---
test(
  'POST /refresh with non-local Origin returns 403',
  {},
  async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rs-t4-'));
    try {
      const shimPath = join(dir, 'build.sh');
      writeFileSync(shimPath, '#!/bin/sh\nexit 0\n');

      const { port, cleanup } = await startServer(BASE_PORT + 3, { BUILD_SH: shimPath });
      try {
        const res = await httpRequest(port, 'POST', '/refresh', { Origin: 'https://evil.example.com' });
        assert.equal(res.status, 403, `Expected 403, got ${res.status}: ${res.body}`);
      } finally {
        await cleanup();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
);
