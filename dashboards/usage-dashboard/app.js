(function () {
  'use strict';

  // --- constants ---
  var HEALTH_URL = 'http://127.0.0.1:4765/health';
  var HEALTH_TIMEOUT_MS = 300;
  var DEBOUNCE_MS = 50;
  var BUDGET_TOKENS = 5 * 3600 * 1000; // rough 5h proxy; actual budget is cost-based

  // --- state ---
  var _data = null;
  var _range = 30;
  var _hideUnknown = false;
  var _chart = null;
  var _renderTimer = null;

  // --- helpers ---
  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

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

  function cutoff() {
    var d = new Date(Date.now());
    d.setDate(d.getDate() - _range);
    return d.toISOString();
  }

  function filteredSessions() {
    if (!_data) return [];
    var cut = cutoff();
    return _data.sessions.filter(function (s) {
      if (_hideUnknown && s.agent === 'unknown') return false;
      return !s.startedAt || s.startedAt >= cut;
    });
  }

  function filteredDaily() {
    if (!_data) return [];
    var cut = cutoff().slice(0, 10);
    return _data.daily.filter(function (d) { return d.date >= cut; });
  }

  // --- error / toast ---
  function showError(msg) {
    var el = document.getElementById('error-banner');
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    var hint = document.getElementById('sbu-hint');
    if (hint) hint.hidden = false;
  }

  function showToast(msg, ms) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    setTimeout(function () { el.hidden = true; }, ms || 3000);
  }

  // --- window strip ---
  function renderWindowStrip() {
    if (!_data || !_data.window) return;
    var w = _data.window;
    var tokens = (w.inputTokens || 0) + (w.outputTokens || 0);
    var pct = BUDGET_TOKENS > 0 ? ((tokens / BUDGET_TOKENS) * 100).toFixed(1) + '%' : '—';

    var end = w.endTime ? new Date(w.endTime) : null;
    var remaining = '—';
    if (end) {
      var ms = end - Date.now();
      if (ms > 0) {
        var mins = Math.floor(ms / 60000);
        remaining = mins + 'm';
      } else {
        remaining = 'expired';
      }
    }

    var set = function (id, v) { var el = document.getElementById(id); if (el) el.textContent = v; };
    set('window-tokens', fmt(tokens));
    set('window-pct', pct);
    set('window-cost', fmtCost(w.totalCost));
    set('window-countdown', remaining);
  }

  // --- agent leaderboard ---
  function renderLeaderboard() {
    var tbody = document.getElementById('leaderboard-body');
    if (!tbody) return;
    var sessions = filteredSessions();

    if (sessions.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:2rem;opacity:.5">No sessions in range</td></tr>';
      return;
    }

    // Group by agent
    var map = {};
    sessions.forEach(function (s) {
      if (!map[s.agent]) map[s.agent] = { sessions: 0, tokensIn: 0, tokensOut: 0, cacheRead: 0, cacheCreate: 0, cost: 0 };
      var a = map[s.agent];
      a.sessions++;
      a.tokensIn += s.tokensIn || 0;
      a.tokensOut += s.tokensOut || 0;
      a.cacheRead += s.cacheRead || 0;
      a.cacheCreate += s.cacheCreate || 0;
      a.cost += s.cost || 0;
    });

    // Sort by total tokens desc; unknown last
    var agents = Object.keys(map).sort(function (a, b) {
      if (a === 'unknown') return 1;
      if (b === 'unknown') return -1;
      var ta = map[a].tokensIn + map[a].tokensOut;
      var tb = map[b].tokensIn + map[b].tokensOut;
      return tb - ta;
    });

    var totals = { sessions: 0, tokensIn: 0, tokensOut: 0, cacheRead: 0, cacheCreate: 0, cost: 0 };
    var rows = agents.map(function (agent) {
      var a = map[agent];
      totals.sessions += a.sessions;
      totals.tokensIn += a.tokensIn;
      totals.tokensOut += a.tokensOut;
      totals.cacheRead += a.cacheRead;
      totals.cacheCreate += a.cacheCreate;
      totals.cost += a.cost;
      var tokens = a.tokensIn + a.tokensOut;
      var avg = a.sessions > 0 ? Math.round(tokens / a.sessions) : 0;
      return '<tr class="expandable border-b border-[#313244] hover:bg-[#313244]/40" data-agent="' + escHtml(agent) + '">' +
        '<td class="py-1.5 pr-4">' + escHtml(agent) + '</td>' +
        '<td class="text-right py-1.5 px-2">' + a.sessions + '</td>' +
        '<td class="text-right py-1.5 px-2">' + fmt(tokens) + '</td>' +
        '<td class="text-right py-1.5 px-2">' + fmt(a.tokensIn) + '</td>' +
        '<td class="text-right py-1.5 px-2">' + fmt(a.tokensOut) + '</td>' +
        '<td class="text-right py-1.5 px-2">' + fmt(a.cacheRead + a.cacheCreate) + '</td>' +
        '<td class="text-right py-1.5 px-2">' + fmtCost(a.cost) + '</td>' +
        '<td class="text-right py-1.5 pl-2">' + fmt(avg) + '</td>' +
        '</tr>';
    });

    var totalTokens = totals.tokensIn + totals.tokensOut;
    var totalAvg = totals.sessions > 0 ? Math.round(totalTokens / totals.sessions) : 0;
    var totalsRow = '<tr class="border-t-2 border-[#45475a] font-semibold text-[#cba6f7]">' +
      '<td class="py-1.5 pr-4">Totals</td>' +
      '<td class="text-right py-1.5 px-2">' + totals.sessions + '</td>' +
      '<td class="text-right py-1.5 px-2">' + fmt(totalTokens) + '</td>' +
      '<td class="text-right py-1.5 px-2">' + fmt(totals.tokensIn) + '</td>' +
      '<td class="text-right py-1.5 px-2">' + fmt(totals.tokensOut) + '</td>' +
      '<td class="text-right py-1.5 px-2">' + fmt(totals.cacheRead + totals.cacheCreate) + '</td>' +
      '<td class="text-right py-1.5 px-2">' + fmtCost(totals.cost) + '</td>' +
      '<td class="text-right py-1.5 pl-2">' + fmt(totalAvg) + '</td>' +
      '</tr>';

    tbody.innerHTML = rows.join('') + totalsRow;

    // Expand on click — show flat session list
    tbody.querySelectorAll('tr.expandable').forEach(function (row) {
      row.addEventListener('click', function () {
        var agent = row.getAttribute('data-agent');
        var existing = tbody.querySelector('tr[data-expand="' + escHtml(agent) + '"]');
        if (existing) { existing.remove(); return; }
        var agentSessions = sessions.filter(function (s) { return s.agent === agent; });
        var detail = agentSessions.map(function (s) {
          return '<tr data-expand="' + escHtml(agent) + '" class="text-xs text-[#6c7086] border-b border-[#313244]/50">' +
            '<td class="pl-4 py-1 pr-4 font-mono text-[0.7rem]">' + escHtml(s.sessionId) + '</td>' +
            '<td class="text-right py-1 px-2">1</td>' +
            '<td class="text-right py-1 px-2">' + fmt(s.tokensIn + s.tokensOut) + '</td>' +
            '<td class="text-right py-1 px-2">' + fmt(s.tokensIn) + '</td>' +
            '<td class="text-right py-1 px-2">' + fmt(s.tokensOut) + '</td>' +
            '<td class="text-right py-1 px-2">' + fmt(s.cacheRead + s.cacheCreate) + '</td>' +
            '<td class="text-right py-1 px-2">' + fmtCost(s.cost) + '</td>' +
            '<td class="text-right py-1 pl-2">' + escHtml(s.model) + '</td>' +
            '</tr>';
        }).join('');
        row.insertAdjacentHTML('afterend', detail);
      });
    });

    // Footer cost
    var footerCost = document.getElementById('footer-cost');
    if (footerCost) footerCost.textContent = fmtCost(totals.cost);
  }

  // --- project breakdown ---
  function renderProjectBreakdown() {
    var tbody = document.getElementById('project-body');
    if (!tbody) return;
    var sessions = filteredSessions();

    if (sessions.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:2rem;opacity:.5">No data</td></tr>';
      return;
    }

    var map = {};
    sessions.forEach(function (s) {
      var p = s.project || 'other';
      if (!map[p]) map[p] = { sessions: 0, tokens: 0, cost: 0 };
      map[p].sessions++;
      map[p].tokens += (s.tokensIn || 0) + (s.tokensOut || 0);
      map[p].cost += s.cost || 0;
    });

    var projects = Object.keys(map).sort(function (a, b) { return map[b].tokens - map[a].tokens; });
    var rows = projects.map(function (p) {
      var d = map[p];
      return '<tr class="border-b border-[#313244]">' +
        '<td class="py-1.5 pr-4">' + escHtml(p) + '</td>' +
        '<td class="text-right py-1.5 px-2">' + d.sessions + '</td>' +
        '<td class="text-right py-1.5 px-2">' + fmt(d.tokens) + '</td>' +
        '<td class="text-right py-1.5 pl-2">' + fmtCost(d.cost) + '</td>' +
        '</tr>';
    });

    tbody.innerHTML = rows.join('');
  }

  // --- sparkline ---
  function renderSparkline() {
    var canvas = document.getElementById('sparkline-canvas');
    if (!canvas || typeof Chart === 'undefined') return;

    var daily = filteredDaily();
    if (daily.length === 0) return;

    // Find top-5 agents by total tokens across filtered sessions
    var sessions = filteredSessions();
    var agentTotals = {};
    sessions.forEach(function (s) {
      var t = (s.tokensIn || 0) + (s.tokensOut || 0);
      agentTotals[s.agent] = (agentTotals[s.agent] || 0) + t;
    });
    var top5 = Object.keys(agentTotals).sort(function (a, b) { return agentTotals[b] - agentTotals[a]; }).slice(0, 5);

    var labels = daily.map(function (d) { return d.date; });
    var COLORS = ['#cba6f7', '#89b4fa', '#a6e3a1', '#f9e2af', '#f38ba8'];
    var datasets = top5.map(function (agent, i) {
      return {
        label: agent,
        data: daily.map(function (d) { return d.byAgent && d.byAgent[agent] ? d.byAgent[agent] : 0; }),
        borderColor: COLORS[i % COLORS.length],
        backgroundColor: COLORS[i % COLORS.length] + '22',
        tension: 0.3,
        pointRadius: 3,
        pointHoverRadius: 5,
      };
    });

    if (_chart) { _chart.destroy(); _chart = null; }
    _chart = new Chart(canvas, {
      type: 'line',
      data: { labels: labels, datasets: datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#cdd6f4', font: { family: 'monospace' } } },
        },
        scales: {
          x: { ticks: { color: '#6c7086' }, grid: { color: '#313244' } },
          y: { ticks: { color: '#6c7086', callback: function (v) { return fmt(v); } }, grid: { color: '#313244' } },
        },
        onClick: function (evt, elements) {
          if (!elements.length) return;
          var idx = elements[0].index;
          var day = daily[idx];
          if (!day) return;
          var agent = top5[elements[0].datasetIndex];
          renderSparklineDayDetail(day.date, agent);
        },
      },
    });
  }

  function renderSparklineDayDetail(date, agent) {
    var detail = document.getElementById('sparkline-day-detail');
    var tbody = document.getElementById('sparkline-day-body');
    if (!detail || !tbody) return;
    var sessions = filteredSessions().filter(function (s) {
      return s.startedAt && s.startedAt.startsWith(date) && s.agent === agent;
    });
    if (sessions.length === 0) { detail.hidden = true; return; }
    detail.hidden = false;
    tbody.innerHTML = sessions.map(function (s) {
      return '<tr class="border-b border-[#313244]/50">' +
        '<td class="py-1 pr-3 font-mono text-[0.7rem]">' + escHtml(s.sessionId) + '</td>' +
        '<td class="text-right py-1 px-2">' + fmt((s.tokensIn || 0) + (s.tokensOut || 0)) + '</td>' +
        '<td class="text-right py-1 pl-2">' + fmtCost(s.cost) + '</td>' +
        '</tr>';
    }).join('');
  }

  // --- last updated ---
  function renderLastUpdated() {
    var el = document.getElementById('last-updated');
    if (!el || !_data) return;
    el.textContent = _data.generatedAt ? new Date(_data.generatedAt).toLocaleString() : '—';
  }

  // --- render all ---
  function render() {
    renderWindowStrip();
    renderLeaderboard();
    renderProjectBreakdown();
    renderSparkline();
    renderLastUpdated();
  }

  function scheduleRender() {
    if (_renderTimer) clearTimeout(_renderTimer);
    _renderTimer = setTimeout(render, DEBOUNCE_MS);
  }

  // --- load data ---
  function load() {
    fetch('./data.json').then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }).then(function (data) {
      if (data.schemaVersion !== 1) {
        showError('Schema mismatch — regenerate with latest build.sh (got schemaVersion ' + data.schemaVersion + ')');
        return;
      }
      _data = data;
      render();
    }).catch(function (err) {
      showError('Could not load data.json: ' + err.message + '. Run `sbu` to generate data.');
      var hint = document.getElementById('sbu-hint');
      if (hint) hint.hidden = false;
    });
  }

  // --- health probe (T9 wires button; probe here so T8 doesn't break when server absent) ---
  function probeHealth() {
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, HEALTH_TIMEOUT_MS) : null;
    var opts = controller ? { signal: controller.signal } : {};
    fetch(HEALTH_URL, opts).then(function (res) {
      if (timer) clearTimeout(timer);
      if (res.ok) {
        var btn = document.getElementById('refresh-btn');
        var indicator = document.getElementById('live-indicator');
        if (btn) btn.hidden = false;
        if (indicator) indicator.hidden = false;
      }
    }).catch(function () {
      if (timer) clearTimeout(timer);
      // server not running — keep button hidden, sbu-hint shown after load error if any
    });
  }

  // --- wire controls ---
  document.addEventListener('DOMContentLoaded', function () {
    var rangeSelect = document.getElementById('date-range');
    if (rangeSelect) {
      rangeSelect.addEventListener('change', function () {
        _range = parseInt(rangeSelect.value, 10);
        scheduleRender();
      });
    }

    var hideCheckbox = document.getElementById('hide-unknown');
    if (hideCheckbox) {
      hideCheckbox.addEventListener('change', function () {
        _hideUnknown = hideCheckbox.checked;
        scheduleRender();
      });
    }

    load();
    probeHealth();
  });

})();
