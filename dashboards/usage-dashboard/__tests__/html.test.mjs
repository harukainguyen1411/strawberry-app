// plan: plans/approved/2026-04-19-claude-usage-dashboard-tasks.md T7
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const { document } = new JSDOM(html).window;

describe('T7 index.html shell', () => {
  test('required section IDs exist', () => {
    assert.ok(document.getElementById('window-strip'), '#window-strip missing');
    assert.ok(document.getElementById('agent-leaderboard'), '#agent-leaderboard missing');
    assert.ok(document.getElementById('project-breakdown'), '#project-breakdown missing');
    assert.ok(document.getElementById('sparkline'), '#sparkline missing');
  });

  test('date-range select has exactly 5 options with values 7/30/90/180/360', () => {
    const select = document.querySelector('select#date-range, select[name="date-range"]');
    assert.ok(select, 'date-range select missing');
    const values = Array.from(select.options).map(o => o.value);
    assert.deepEqual(values, ['7', '30', '90', '180', '360']);
  });

  test('Refresh button exists with hidden attribute by default', () => {
    const btn = document.getElementById('refresh-btn');
    assert.ok(btn, '#refresh-btn missing');
    assert.ok(btn.hasAttribute('hidden'), 'Refresh button should have hidden attribute by default');
  });
});
