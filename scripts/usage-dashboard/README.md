# usage-dashboard scripts

Pipeline scripts for the Raspberry Usage Dashboard.

## Pipeline

```
ccusage session/blocks/daily
        |
        v
  phase-scan.mjs  generate-projects.mjs  generate-plans.mjs
        |                  |                     |
        +------------------+---------------------+
                           |
                        merge.mjs
                           |
                           v
                       data.json
                           |
                           v
                dashboards/usage-dashboard/
```

## Scripts

| Script | Purpose |
|--------|---------|
| `phase-scan.mjs` | Scan JSONL transcripts; emit `phase-scan.json` keyed by project/date |
| `generate-projects.mjs` | Read `projects/` registry; emit `projects.json` |
| `generate-plans.mjs` | Read `plans/` registry; emit `plans.json` |
| `merge.mjs` | Join ccusage output with phase/project/plan data; write `data.json` (schemaVersion 2) |
| `build.sh` | Orchestrator: runs all of the above in order |
| `install-cron.sh` | Install a crontab entry that auto-runs `build.sh` every 10 minutes |
| `refresh-server.mjs` | Local HTTP helper enabling the in-page Refresh button |
| `sbu.sh` | One-command entry point: build + open |

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `USAGE_CACHE_DIR` | `~/.claude/raspberry-usage-cache` | Directory for ccusage JSON output and phase-scan cache |
| `CUTOVER_DATE` | _(none)_ | ISO date string; sessions before this date treated as pre-cutover |
| `IDLE_CAP_SEC` | `300` | Session idle gap in seconds before a session is split |
| `RASPBERRY_DIR` | auto-detected | Path to this (raspberry) repo root |
| `PROJECTS_JSON` | `<RASPBERRY_DIR>/dashboards/usage-dashboard/projects.json` | Override path to projects registry (consumed by `phase-scan.mjs`) |
| `PLANS_JSON` | `<RASPBERRY_DIR>/dashboards/usage-dashboard/plans.json` | Override path to plans registry (consumed by `phase-scan.mjs`) |
| `PRODUCT_REPOS` | _(derived from projects.json)_ | JSON map of `{ productName: absolutePath }` for bare-product-repo cwd matching in `phase-scan.mjs` |
| `PORT` | `4765` | Port for `refresh-server.mjs` |
| `BUILD_SH` | _(same dir)_ | Path to `build.sh` used by `refresh-server.mjs` and `sbu.sh` |

## `phase-scan.mjs` CLI flags

`phase-scan.mjs` also accepts two CLI flags that override the env vars above:

| Flag | Default | Description |
|------|---------|-------------|
| `--projects <path>` | `$PROJECTS_JSON` or dashboard dir default | Path to `projects.json` registry |
| `--plans <path>` | `$PLANS_JSON` or dashboard dir default | Path to `plans.json` registry |

These flags are passed automatically by `build.sh`. Override manually if testing with a different registry:

```sh
PHASE_SCAN_OUT=/tmp/test-scan.json node scripts/usage-dashboard/phase-scan.mjs \
  --projects /tmp/my-projects.json \
  --plans    /tmp/my-plans.json
```

## Manual build

```sh
# Full rebuild (requires ccusage on PATH)
USAGE_CACHE_DIR="$HOME/.claude/raspberry-usage-cache" bash scripts/usage-dashboard/build.sh
```

Expected output: `built data.json (N sessions, M projects, schemaVersion 2)`

## `sbu` — one-command entry point

`sbu` rebuilds `data.json` and opens the dashboard in your browser with a single command.

### Install

Add the following alias to your `~/.zshrc` (or `~/.bashrc`):

```sh
alias sbu='bash ~/Documents/Personal/strawberry-app/scripts/usage-dashboard/sbu.sh'
```

Then reload your shell:

```sh
source ~/.zshrc
```

### Usage

```sh
# Rebuild data.json and open the dashboard
sbu

# Rebuild + start the in-page Refresh helper (enables the Refresh button in the UI)
sbu --serve

# Rebuild only, skip opening the browser
sbu --no-open

# Rebuild + start helper, skip opening the browser
sbu --serve --no-open
```

### Refresh server

The refresh server (`refresh-server.mjs`) is an optional local HTTP helper that enables the
one-click "Refresh" button inside the dashboard page. Without it, the Refresh button is
hidden and a `sbu` hint is shown instead.

To start the server manually:

```sh
node ~/Documents/Personal/strawberry-app/scripts/usage-dashboard/refresh-server.mjs &
```

To stop it:

```sh
kill "$(cat ~/.claude/raspberry-usage-cache/refresh-server.pid)"
```

## Cutover from legacy cache

The old cache was at `~/.claude/strawberry-usage-cache`. To migrate:

1. Run `install-cron.sh` — it runs a build, verifies `schemaVersion: 2` in the new cache, then installs the crontab entry:

   ```sh
   bash scripts/usage-dashboard/install-cron.sh
   ```

2. Open the dashboard and confirm the data looks correct.

3. Once satisfied, remove the legacy cache:

   ```sh
   rm -rf ~/.claude/strawberry-usage-cache
   ```

## Cutover from strawberry agent dashboard

This dashboard replaced the per-roster-agent attribution (strawberry-usage-cache) with phase × project attribution (raspberry-usage-cache). Schemas are not compatible.

- Old cache (read-only, kept one week post-cutover): `~/.claude/strawberry-usage-cache/`
- New cache (active): `~/.claude/raspberry-usage-cache/`

After a week of confirmed-working new pipeline, remove the legacy directory:

    rm -rf ~/.claude/strawberry-usage-cache

`sbu.sh` falls back to `~/.claude/strawberry-usage-cache/data.json` if `build.sh` produces no new output, printing a one-line warning to stderr. Post-cutover, a silently-failing build will surface legacy data instead of erroring — confirm new data is being generated (`tail ~/.claude/raspberry-usage-cache/cron.log` and check the `generatedAt` in `dashboards/usage-dashboard/data.json` is recent) before removing the legacy cache.
