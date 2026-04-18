#!/usr/bin/env node
/**
 * refresh-server.mjs — Tiny local HTTP helper for the usage-dashboard Refresh button.
 *
 * Binds 127.0.0.1 only. Node stdlib only (http, child_process). Zero npm deps.
 *
 * Routes:
 *   GET  /health  -> { ok: true, version: "1" }
 *   POST /refresh -> spawns build.sh; returns { ok, updatedAt, durationMs } or { ok:false, error }
 *
 * CORS: allows Origin: null (file://) and http://localhost:* only.
 *
 * Configuration via env:
 *   PORT      — port to listen on (default 4765)
 *   BUILD_SH  — path to build.sh (default: same directory as this file ../../scripts/usage-dashboard/build.sh)
 */

import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const PORT = parseInt(process.env.PORT || '4765', 10);
const BUILD_SH = process.env.BUILD_SH || join(__dirname, 'build.sh');

/**
 * Returns true if the given Origin header value is from a local context.
 * Allowed: "null" (file://), http://localhost, http://127.0.0.1, http://[::1]
 */
function isLocalOrigin(origin) {
  if (!origin) return true; // no Origin header (non-browser direct call)
  if (origin === 'null') return true; // file:// context
  try {
    const url = new URL(origin);
    const hostname = url.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return url.protocol === 'http:';
    }
  } catch {
    // Invalid URL — deny
  }
  return false;
}

/**
 * Runs build.sh and returns a Promise that resolves to { ok, durationMs, error? }.
 */
function runBuild() {
  return new Promise((resolve) => {
    const start = Date.now();
    const child = spawn('bash', [BUILD_SH], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    child.on('close', (code) => {
      const durationMs = Date.now() - start;
      if (code === 0) {
        resolve({ ok: true, durationMs });
      } else {
        resolve({ ok: false, durationMs, error: stderr.trim() || `build.sh exited with code ${code}` });
      }
    });

    child.on('error', (err) => {
      const durationMs = Date.now() - start;
      resolve({ ok: false, durationMs, error: err.message });
    });
  });
}

function setCorsHeaders(res, origin) {
  // Reflect the allowed origin back
  if (origin === 'null' || !origin) {
    res.setHeader('Access-Control-Allow-Origin', 'null');
  } else {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const origin = req.headers['origin'];
  const url = req.url || '/';
  const method = req.method || 'GET';

  // Handle pre-flight OPTIONS
  if (method === 'OPTIONS') {
    if (!isLocalOrigin(origin)) {
      res.writeHead(403);
      res.end();
      return;
    }
    setCorsHeaders(res, origin);
    res.writeHead(204);
    res.end();
    return;
  }

  // GET /health
  if (method === 'GET' && url === '/health') {
    setCorsHeaders(res, origin);
    sendJson(res, 200, { ok: true, version: '1' });
    return;
  }

  // POST /refresh
  if (method === 'POST' && url === '/refresh') {
    if (!isLocalOrigin(origin)) {
      res.writeHead(403);
      res.end(JSON.stringify({ ok: false, error: 'Forbidden: non-local origin' }));
      return;
    }

    setCorsHeaders(res, origin);
    console.log(`[refresh] ${new Date().toISOString()} POST /refresh received`);

    runBuild().then((result) => {
      const payload = {
        ok: result.ok,
        updatedAt: new Date().toISOString(),
        durationMs: result.durationMs,
      };
      if (!result.ok) {
        payload.error = result.error;
      }
      const statusCode = result.ok ? 200 : 500;
      console.log(`[refresh] ${new Date().toISOString()} build finished ok=${result.ok} in ${result.durationMs}ms`);
      sendJson(res, statusCode, payload);
    });

    return;
  }

  // 404 for anything else
  sendJson(res, 404, { ok: false, error: 'Not found' });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`usage-dashboard refresh helper listening on http://127.0.0.1:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});
process.on('SIGINT', () => {
  server.close(() => process.exit(0));
});
