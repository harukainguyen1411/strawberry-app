'use strict';

// --- constants ---
const HEALTH_URL = 'http://127.0.0.1:4765/health';
const HEALTH_TIMEOUT_MS = 300;
const DEBOUNCE_MS = 50;
const BUDGET_TOKENS = 5 * 3600 * 1000; // rough 5h proxy; actual budget is cost-based

const PHASES = ['Brainstorm', 'Plan', 'Implement', 'Review', 'Verify', 'Debug', 'Finish', '(unphased)'];
const PALETTE = ['#cba6f7', '#f38ba8', '#a6e3a1', '#fab387', '#74c7ec'];

// --- state ---
const state = {
  metric: 'tokens',
  hideUnphased: false,
  projectFilter: null,
  data: null,
};

let _chart = null;
let _renderTimer = null;

// --- helpers ---
function fmt(n) {
  if (n == null) return '—';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
  return String(n);
}

function fmtCost(c) {
  if (c == null) return '—';
  return '$' + Number(c).toFixed(4);
}

function metricOf(cell, metric) {
  if (!cell) return 0;
  if (metric === 'tokens')   return cell.tokens   ?? 0;
  if (metric === 'time')     return cell.durationSec ?? 0;
  if (metric === 'sessions') return cell.sessions ?? 0;
  if (metric === 'cost')     return cell.cost     ?? 0;
  return 0;
}

function formatMetric(v, metric) {
  if (!v) return '—';
  if (metric === 'tokens')   return fmt(v);
  if (metric === 'time')     return formatDuration(v);
  if (metric === 'sessions') return String(v);
  if (metric === 'cost')     return '$' + Number(v).toFixed(2);
  return String(v);
}

function formatDuration(sec) {
  if (!sec) return '—';
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60), s = sec % 60;
  if (m < 60) return `${m}m${s ? ` ${s}s` : ''}`;
  const h = Math.floor(m / 60), mm = m % 60;
  return `${h}h${mm ? ` ${mm}m` : ''}`;
}

// --- error / toast ---
function showError(msg) {
  const el = document.getElementById('error-banner');
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
  const hint = document.getElementById('sbu-hint');
  if (hint) hint.hidden = false;
}

function showToast(msg, ms) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
  setTimeout(() => { el.hidden = true; }, ms || 3000);
}

// --- window strip ---
function renderBlockStrip(data) {
  if (!data || !data.window) return;
  const w = data.window;
  const tokens = (w.inputTokens || 0) + (w.outputTokens || 0);
  const pct = BUDGET_TOKENS > 0 ? ((tokens / BUDGET_TOKENS) * 100).toFixed(1) + '%' : '—';

  const end = w.endTime ? new Date(w.endTime) : null;
  let remaining = '—';
  if (end) {
    const ms = end - Date.now();
    if (ms > 0) {
      const mins = Math.floor(ms / 60000);
      remaining = mins + 'm';
    } else {
      remaining = 'expired';
    }
  }

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('window-tokens', fmt(tokens));
  set('window-pct', pct);
  set('window-cost', fmtCost(w.totalCost));
  set('window-countdown', remaining);
}

// --- phase x project grid ---
function renderProjectGrid(data, { metric, hideUnphased, projectFilter }) {
  const tbody = document.getElementById('grid-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!data || !data.grid || !data.grid.byProject) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:2rem;opacity:.5">No grid data</td></tr>';
    return;
  }

  let projects = Object.entries(data.grid.byProject)
    .filter(([slug]) => !projectFilter || slug === projectFilter)
    .map(([slug, p]) => ({ slug, ...p }))
    .sort((a, b) => metricOf(b.total, metric) - metricOf(a.total, metric));

  // Move (unscoped) to the end
  const unscopedIdx = projects.findIndex(p => p.slug === '(unscoped)');
  if (unscopedIdx > 0) {
    const [unscoped] = projects.splice(unscopedIdx, 1);
    projects.push(unscoped);
  }

  // Compute per-column max for heatmap intensity
  const colMax = {};
  for (const ph of PHASES) {
    colMax[ph] = Math.max(0, ...projects.map(p => metricOf(p.byPhase && p.byPhase[ph], metric)));
  }

  // Determine which phase columns to render
  const visiblePhases = hideUnphased ? PHASES.filter(ph => ph !== '(unphased)') : PHASES;

  for (const p of projects) {
    const tr = document.createElement('tr');
    tr.className = 'grid-row border-b border-[#313244] hover:bg-[#313244]/40';
    tr.dataset.project = p.slug;
    tr.setAttribute('aria-expanded', 'false');

    const phaseCells = visiblePhases.map(ph => {
      const v = metricOf(p.byPhase && p.byPhase[ph], metric);
      const intensity = colMax[ph] ? v / colMax[ph] : 0;
      return `<td class="px-3 py-2 text-right heatmap-cell" style="--intensity:${intensity}" data-phase="${ph}">${v ? formatMetric(v, metric) : '—'}</td>`;
    }).join('');

    tr.innerHTML = `
      <td class="px-3 py-2 text-left">
        <span class="chevron">▸</span>
        <span class="ml-1">${p.slug}</span>
      </td>
      ${phaseCells}
      <td class="px-3 py-2 text-right font-semibold">${formatMetric(metricOf(p.total, metric), metric)}</td>
    `;
    tbody.appendChild(tr);

    // Expandable plan rows (initially hidden)
    const byPlan = p.byPlan || {};
    const planRows = Object.entries(byPlan)
      .sort((a, b) => metricOf(b[1].total, metric) - metricOf(a[1].total, metric));

    for (const [planSlug, planData] of planRows) {
      const planMeta = (data.plans || []).find(pl => pl.slug === planSlug) ?? { state: 'spec-only' };
      const planTr = document.createElement('tr');
      planTr.className = 'plan-row hidden border-b border-[#313244]/50';
      planTr.dataset.parent = p.slug;

      const planPhaseCells = visiblePhases.map(ph => {
        const v = metricOf(planData.byPhase && planData.byPhase[ph], metric);
        return `<td class="px-3 py-2 text-right" data-phase="${ph}">${v ? formatMetric(v, metric) : '—'}</td>`;
      }).join('');

      planTr.innerHTML = `
        <td class="px-3 py-2 text-left">
          ${planSlug}
          <span class="state-badge ${planMeta.state}">${planMeta.state}</span>
        </td>
        ${planPhaseCells}
        <td class="px-3 py-2 text-right font-semibold">${formatMetric(metricOf(planData.total, metric), metric)}</td>
      `;
      tbody.appendChild(planTr);
    }
  }

  // Wire row expansion
  tbody.querySelectorAll('.grid-row').forEach(row => {
    row.addEventListener('click', e => {
      // Don't trigger expansion when clicking a phase cell (drill-down handles it)
      if (e.target.closest('td[data-phase]')) return;
      const expanded = row.getAttribute('aria-expanded') === 'true';
      row.setAttribute('aria-expanded', String(!expanded));
      const chevron = row.querySelector('.chevron');
      if (chevron) chevron.style.transform = expanded ? '' : 'rotate(90deg)';
      tbody.querySelectorAll(`.plan-row[data-parent="${row.dataset.project}"]`)
        .forEach(pr => pr.classList.toggle('hidden', expanded));
    });
  });

  // Wire cell drill-down (delegate to all cells with data-phase)
  tbody.addEventListener('click', e => {
    const cell = e.target.closest('td[data-phase]');
    if (!cell) return;
    e.stopPropagation();
    const row     = cell.closest('tr');
    const project = row.classList.contains('grid-row') ? row.dataset.project : row.dataset.parent;
    const phase   = cell.dataset.phase;
    showSessionDrill(data, { project, phase });
  });
}

function showSessionDrill(data, { project, phase }) {
  // Remove any existing drill panel
  const existing = document.getElementById('drill-panel');
  if (existing) existing.remove();

  const panelGrid = document.getElementById('panel-grid');
  if (!panelGrid) return;

  const sessions = data.sessions || [];

  // Best-effort: match sessions by cwd containing the project slug
  // (proper attribution requires per-session phase tagging — deferred)
  let matched = sessions;
  if (project && project !== '(unscoped)') {
    matched = sessions.filter(s => s.cwd && s.cwd.toLowerCase().includes(project.toLowerCase()));
  }

  if (matched.length === 0) {
    matched = [];
  }

  // Sort by tokens desc and take top 20
  const top20 = matched
    .map(s => ({ ...s, totalTokens: (s.tokensIn || 0) + (s.tokensOut || 0) }))
    .sort((a, b) => b.totalTokens - a.totalTokens)
    .slice(0, 20);

  const drillEl = document.createElement('div');
  drillEl.id = 'drill-panel';
  drillEl.className = 'border-t border-[#45475a] p-3';

  const note = project !== '(unscoped)' && matched.length > 0
    ? ''
    : '<p class="text-xs text-[#6c7086] italic mb-2">Note: drill-down uses cwd heuristic — per-session phase attribution deferred.</p>';

  const rows = top20.length === 0
    ? '<tr><td colspan="4" class="py-4 text-center text-[#6c7086]">No sessions matched</td></tr>'
    : top20.map(s => {
        const day = s.startedAt ? s.startedAt.slice(0, 10) : '—';
        return `<tr class="border-b border-[#313244]/50 text-xs">
          <td class="py-1 pr-3 font-mono text-[0.7rem] text-[#6c7086]">${s.sessionId || '—'}</td>
          <td class="text-right py-1 px-2">${day}</td>
          <td class="text-right py-1 px-2">${fmt(s.totalTokens)}</td>
          <td class="text-right py-1 pl-2 text-[#6c7086]">${s.model || '—'}</td>
        </tr>`;
      }).join('');

  drillEl.innerHTML = `
    <div class="flex items-center justify-between mb-2">
      <span class="text-xs font-semibold text-[#cba6f7]">Drill: ${project} / ${phase} (top 20 sessions by tokens)</span>
      <button id="drill-close" class="text-xs text-[#6c7086] hover:text-[#cdd6f4] px-2 py-0.5 rounded border border-[#45475a]">Close</button>
    </div>
    ${note}
    <div class="overflow-x-auto">
      <table class="w-full text-sm border-collapse">
        <thead>
          <tr class="border-b border-[#313244] text-[#6c7086] text-xs uppercase tracking-wider">
            <th class="text-left py-1 pr-3 font-medium">Session ID</th>
            <th class="text-right py-1 px-2 font-medium">Day</th>
            <th class="text-right py-1 px-2 font-medium">Tokens</th>
            <th class="text-right py-1 pl-2 font-medium">Model</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;

  panelGrid.appendChild(drillEl);
  document.getElementById('drill-close').addEventListener('click', () => drillEl.remove());
}

// --- per-repo breakdown ---
function renderPerRepo(data, { metric }) {
  const tbody = document.getElementById('project-body');
  if (!tbody) return;

  if (!data || !data.perRepo || data.perRepo.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:2rem;opacity:.5">No data</td></tr>';
    return;
  }

  const sorted = [...data.perRepo].sort((a, b) => {
    const va = metric === 'sessions' ? (a.sessions || 0)
      : metric === 'time'     ? (a.durationSec || 0)
      : metric === 'cost'     ? (a.cost || 0)
      : (a.tokens || 0);
    const vb = metric === 'sessions' ? (b.sessions || 0)
      : metric === 'time'     ? (b.durationSec || 0)
      : metric === 'cost'     ? (b.cost || 0)
      : (b.tokens || 0);
    return vb - va;
  });

  const rows = sorted.map(r => {
    const metricVal = metric === 'sessions' ? String(r.sessions || 0)
      : metric === 'time'     ? formatDuration(r.durationSec || 0)
      : metric === 'cost'     ? ('$' + Number(r.cost || 0).toFixed(2))
      : fmt(r.tokens || 0);
    return `<tr class="border-b border-[#313244]">
      <td class="py-1.5 pr-4">${r.repo || '—'}</td>
      <td class="text-right py-1.5 px-2">${r.sessions || 0}</td>
      <td class="text-right py-1.5 px-2">${fmt(r.tokens || 0)}</td>
      <td class="text-right py-1.5 pl-2">${metricVal}</td>
    </tr>`;
  }).join('');

  tbody.innerHTML = rows;
}

// --- sparkline ---
function renderProjectSparkline(data, { metric, projectFilter }) {
  const canvas = document.getElementById('sparkline-canvas');
  if (!canvas || typeof Chart === 'undefined') return;

  if (_chart) { _chart.destroy(); _chart = null; }

  if (!data || !data.sparkline || data.sparkline.length === 0) return;

  const last14 = data.sparkline;

  // Top-5 projects by total tokens across the 14 days
  const totals = {};
  for (const day of last14) {
    for (const [p, t] of Object.entries(day.byProject || {})) {
      totals[p] = (totals[p] ?? 0) + t;
    }
  }
  const top5 = Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([p]) => p);

  const filtered = projectFilter ? [projectFilter] : (top5.length > 0 ? top5 : Object.keys(totals).slice(0, 5));

  const labels = last14.map(d => d.date);
  const datasets = filtered.map((p, i) => ({
    label: p,
    data: last14.map(d => (d.byProject || {})[p] ?? 0),
    borderColor: PALETTE[i % PALETTE.length],
    backgroundColor: PALETTE[i % PALETTE.length] + '22',
    fill: false,
    tension: 0.2,
    pointRadius: 3,
    pointHoverRadius: 5,
  }));

  _chart = new Chart(canvas, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#cdd6f4', font: { family: 'monospace' } },
          onClick: (e, legendItem) => onSparklineLegendClick(legendItem.text),
        },
      },
      scales: {
        x: { ticks: { color: '#6c7086' }, grid: { color: '#313244' } },
        y: {
          ticks: { color: '#6c7086', callback: v => fmt(v) },
          grid: { color: '#313244' },
        },
      },
    },
  });
}

function onSparklineLegendClick(projectSlug) {
  state.projectFilter = state.projectFilter === projectSlug ? null : projectSlug;
  renderAll();
}

// --- last updated ---
function renderLastUpdated() {
  const el = document.getElementById('last-updated');
  if (!el || !state.data) return;
  el.textContent = state.data.generatedAt ? new Date(state.data.generatedAt).toLocaleString() : '—';
}

// --- render all ---
function renderAll() {
  const opts = {
    metric: state.metric,
    hideUnphased: state.hideUnphased,
    projectFilter: state.projectFilter,
  };
  renderBlockStrip(state.data);
  renderProjectGrid(state.data, opts);
  renderPerRepo(state.data, opts);
  renderProjectSparkline(state.data, opts);
  renderLastUpdated();
}

function scheduleRender() {
  if (_renderTimer) clearTimeout(_renderTimer);
  _renderTimer = setTimeout(renderAll, DEBOUNCE_MS);
}

// --- health probe ---
function probeHealth() {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => { controller.abort(); }, HEALTH_TIMEOUT_MS) : null;
  const opts = controller ? { signal: controller.signal } : {};
  fetch(HEALTH_URL, opts).then(res => {
    if (timer) clearTimeout(timer);
    if (res.ok) {
      const btn = document.getElementById('refresh-btn');
      const indicator = document.getElementById('live-indicator');
      if (btn) btn.hidden = false;
      if (indicator) indicator.hidden = false;
    }
  }).catch(() => {
    if (timer) clearTimeout(timer);
  });
}

// --- load data ---
function load() {
  fetch('./data.json').then(res => {
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }).then(data => {
    if (data.schemaVersion !== 2) {
      showError('Schema mismatch — regenerate with latest build.sh (got schemaVersion ' + data.schemaVersion + ')');
      return;
    }
    state.data = data;
    renderAll();
  }).catch(err => {
    showError('Could not load data.json: ' + err.message + '. Run `sbu` to generate data.');
    const hint = document.getElementById('sbu-hint');
    if (hint) hint.hidden = false;
  });
}

// --- wire controls ---
document.addEventListener('DOMContentLoaded', () => {
  const metricSelect = document.getElementById('metric');
  if (metricSelect) {
    metricSelect.addEventListener('change', e => {
      state.metric = e.target.value;
      scheduleRender();
    });
  }

  const hideCheckbox = document.getElementById('hide-unphased');
  if (hideCheckbox) {
    hideCheckbox.addEventListener('change', e => {
      state.hideUnphased = e.target.checked;
      scheduleRender();
    });
  }

  const rangeSelect = document.getElementById('date-range');
  if (rangeSelect) {
    rangeSelect.addEventListener('change', () => {
      // Range filtering not currently applied to schema-v2 data; kept for UI compatibility
      scheduleRender();
    });
  }

  const refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      const spinner = document.getElementById('refresh-spinner');
      const label = document.getElementById('refresh-label');
      if (spinner) spinner.classList.remove('hidden');
      if (label) label.textContent = 'Refreshing…';
      refreshBtn.disabled = true;
      fetch('./data.json?_=' + Date.now())
        .then(r => r.json())
        .then(data => {
          state.data = data;
          renderAll();
          showToast('Data refreshed');
        })
        .catch(err => showError('Refresh failed: ' + err.message))
        .finally(() => {
          if (spinner) spinner.classList.add('hidden');
          if (label) label.textContent = 'Refresh';
          refreshBtn.disabled = false;
        });
    });
  }

  load();
  probeHealth();
});
