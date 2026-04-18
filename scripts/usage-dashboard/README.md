# usage-dashboard scripts

Pipeline scripts for the Strawberry Usage Dashboard.

| Script | Purpose |
|--------|---------|
| `generate-roster.mjs` | Parse `agent-network.md` and write `roster.json` |
| `agent-scan.mjs` | Scan JSONL transcripts and emit `agents.json` (T2) |
| `merge.mjs` | Join ccusage output with `agents.json`, write `data.json` (T3) |
| `build.sh` | Orchestrator: runs all of the above in order (T4) |
| `refresh-server.mjs` | Local HTTP helper enabling the in-page Refresh button (T5) |
| `sbu.sh` | One-command entry point: build + open (T6) |

## Quick start

```sh
# Regenerate roster from agent-network.md
npm --prefix dashboards/usage-dashboard run roster

# Full rebuild (requires ccusage on PATH)
bash scripts/usage-dashboard/build.sh
```

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

# Rebuild only, skip opening the browser (useful in headless/CI environments)
sbu --no-open

# Rebuild + start helper, skip opening the browser
sbu --serve --no-open
```

### How it works

1. Runs `scripts/usage-dashboard/build.sh` to regenerate `data.json` from your local ccusage data.
2. (With `--serve`) Starts `refresh-server.mjs` in the background on `http://127.0.0.1:4765`.
   The server stays alive until you kill it; the PID is recorded at
   `~/.claude/strawberry-usage-cache/refresh-server.pid`. Running `sbu --serve` a second
   time while the server is alive will print a warning and exit non-zero rather than
   spawning a duplicate.
3. Opens `dashboards/usage-dashboard/index.html` via the `open` command (macOS).

### Refresh server

The refresh server (`refresh-server.mjs`) is an optional local HTTP helper that enables the
one-click "Refresh" button inside the dashboard page. Without it, the Refresh button is
hidden and a `sbu` hint is shown instead.

To start the server manually (without rebuilding first):

```sh
node ~/Documents/Personal/strawberry-app/scripts/usage-dashboard/refresh-server.mjs &
```

To stop it:

```sh
kill "$(cat ~/.claude/strawberry-usage-cache/refresh-server.pid)"
```
