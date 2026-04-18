// plan: plans/approved/2026-04-19-claude-usage-dashboard-tasks.md T8
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

const FIXTURE = JSON.parse(
  readFileSync(new URL('./fixtures/data.json', import.meta.url), 'utf8')
);

const APP_SRC = readFileSync(new URL('../app.js', import.meta.url), 'utf8');

const HTML_SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

const FIXTURE_WITH_OLD = {
  ...FIXTURE,
  sessions: [
    ...FIXTURE.sessions,
    {
      sessionId: 's4',
      agent: 'Viktor',
      project: 'strawberry-app',
      cwd: '/home/user/strawberry-app',
      tokensIn: 100,
      tokensOut: 50,
      cacheRead: 0,
      cacheCreate: 0,
      cost: 0.002,
      model: 'claude-sonnet-4-6',
      startedAt: '2025-01-01T00:00:00Z',
    },
  ],
};

async function loadApp(fixture) {
  const dom = new JSDOM(HTML_SRC, {
    url: 'http://localhost/',
    runScripts: 'outside-only',
  });
  const { window } = dom;

  // Stub Chart.js globally in window
  window.Chart = function () { return { destroy: function () {} }; };

  // Mock fetch — data.json returns fixture; health probe rejects silently
  window.fetch = function (url) {
    if (String(url).includes('data.json')) {
      return Promise.resolve({
        ok: true,
        json: function () { return Promise.resolve(fixture); },
      });
    }
    return Promise.reject(new Error('network unavailable in test'));
  };

  // Eval app.js in the window context (document/fetch/etc. all live on window)
  window.eval(APP_SRC);

  // Dispatch DOMContentLoaded so the app's event listener fires
  const evt = window.document.createEvent('Event');
  evt.initEvent('DOMContentLoaded', true, true);
  window.document.dispatchEvent(evt);

  // Wait for fetch + debounce to settle (150ms > 50ms debounce + promise chain)
  await new Promise(function (r) { setTimeout(r, 150); });

  return window.document;
}

describe('T8 app.js render', () => {
  test('with fixture data, leaderboard has 3 rows (2 agents + totals)', async () => {
    const doc = await loadApp(FIXTURE);
    const rows = doc.querySelectorAll('#leaderboard-body tr');
    // Jayce + Evelynn + unknown + totals = 4
    assert.ok(rows.length >= 3, `expected >=3 leaderboard rows, got ${rows.length}`);
  });

  test('date range 7 days filters out sessions older than 7 days', async () => {
    const doc = await loadApp(FIXTURE_WITH_OLD);
    const select = doc.getElementById('date-range');
    select.value = '7';
    select.dispatchEvent(new doc.defaultView.Event('change'));
    await new Promise(r => setTimeout(r, 150));
    const rows = doc.querySelectorAll('#leaderboard-body tr');
    const texts = Array.from(rows).map(r => r.textContent);
    assert.ok(!texts.some(t => t.includes('Viktor')), 'Viktor should be filtered by 7-day range');
  });

  test('"Hide unknown" toggle removes unknown row', async () => {
    const doc = await loadApp(FIXTURE);
    const checkbox = doc.getElementById('hide-unknown');
    checkbox.checked = true;
    checkbox.dispatchEvent(new doc.defaultView.Event('change'));
    await new Promise(r => setTimeout(r, 150));
    const rows = doc.querySelectorAll('#leaderboard-body tr');
    const texts = Array.from(rows).map(r => r.textContent);
    assert.ok(!texts.some(t => t.toLowerCase().includes('unknown')), 'unknown row should be hidden');
  });

  test('schema version mismatch shows error banner', async () => {
    const doc = await loadApp({ ...FIXTURE, schemaVersion: 99 });
    const banner = doc.getElementById('error-banner');
    assert.ok(!banner.hidden, 'error banner should be visible on schema mismatch');
    assert.ok(banner.textContent.toLowerCase().includes('schema'), 'banner should mention schema');
  });

  test('empty sessions renders empty state without crashing', async () => {
    const doc = await loadApp({ ...FIXTURE, sessions: [], daily: [] });
    const rows = doc.querySelectorAll('#leaderboard-body tr');
    assert.ok(rows.length >= 1, 'should have at least one row (empty state)');
  });
});
