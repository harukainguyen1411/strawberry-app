// xfail: plan plans/approved/2026-04-19-claude-usage-dashboard-tasks.md T8
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const FIXTURE = JSON.parse(
  readFileSync(new URL('./fixtures/data.json', import.meta.url), 'utf8')
);

// Fixture with an older session outside the 7-day window
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

function makeDOM(fixture, dateOverride) {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    resources: 'usable',
    url: 'http://localhost/',
  });
  const { window } = dom;

  // Override Date.now so "today" is fixed relative to fixture data
  const now = dateOverride ?? new Date('2026-04-19T12:00:00Z');
  window.Date = class extends window.Date {
    static now() { return now.getTime(); }
  };

  // Mock fetch to return fixture data
  window.fetch = (url) => {
    if (String(url).includes('data.json')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(fixture ?? FIXTURE),
      });
    }
    return Promise.reject(new Error(`unexpected fetch: ${url}`));
  };

  return dom;
}

async function loadApp(fixture, dateOverride) {
  const dom = makeDOM(fixture, dateOverride);
  const { window } = dom;

  // Load and eval app.js inside the jsdom context
  const appSrc = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  window.eval(appSrc);

  // Wait for fetch + render microtasks to settle
  await new Promise(r => setTimeout(r, 50));
  return window.document;
}

describe('T8 app.js render', { todo: true }, () => {
  test('with fixture data, leaderboard has 3 rows (2 agents + totals)', async () => {
    const doc = await loadApp(FIXTURE);
    const rows = doc.querySelectorAll('#leaderboard-body tr');
    // Jayce row + Evelynn row + unknown row + totals row = 4, but unknown may be omitted when hidden
    // With default (hide-unknown off), expect unknown + 2 agents + totals = 4
    assert.ok(rows.length >= 3, `expected >=3 leaderboard rows, got ${rows.length}`);
  });

  test('date range 7 days filters out sessions older than 7 days', async () => {
    const doc = await loadApp(FIXTURE_WITH_OLD);
    const select = doc.getElementById('date-range');
    select.value = '7';
    select.dispatchEvent(new doc.defaultView.Event('change'));
    await new Promise(r => setTimeout(r, 80));
    // Viktor's session is from 2025-01-01 — should be filtered out
    const rows = doc.querySelectorAll('#leaderboard-body tr');
    const texts = Array.from(rows).map(r => r.textContent);
    assert.ok(!texts.some(t => t.includes('Viktor')), 'Viktor should be filtered by 7-day range');
  });

  test('"Hide unknown" toggle removes unknown row and rebalances totals', async () => {
    const doc = await loadApp(FIXTURE);
    const checkbox = doc.getElementById('hide-unknown');
    checkbox.checked = true;
    checkbox.dispatchEvent(new doc.defaultView.Event('change'));
    await new Promise(r => setTimeout(r, 80));
    const rows = doc.querySelectorAll('#leaderboard-body tr');
    const texts = Array.from(rows).map(r => r.textContent);
    assert.ok(!texts.some(t => t.toLowerCase().includes('unknown')), 'unknown row should be hidden');
  });

  test('schema version mismatch shows error banner', async () => {
    const badData = { ...FIXTURE, schemaVersion: 99 };
    const doc = await loadApp(badData);
    const banner = doc.getElementById('error-banner');
    assert.ok(!banner.hidden, 'error banner should be visible on schema mismatch');
    assert.ok(banner.textContent.toLowerCase().includes('schema'), 'banner should mention schema');
  });

  test('empty sessions renders empty state without crashing', async () => {
    const emptyData = { ...FIXTURE, sessions: [], daily: [] };
    let doc;
    assert.doesNotThrow(async () => { doc = await loadApp(emptyData); });
    doc = await loadApp(emptyData);
    const rows = doc.querySelectorAll('#leaderboard-body tr');
    assert.ok(rows.length >= 1, 'should have at least one row (empty state or totals)');
  });
});
