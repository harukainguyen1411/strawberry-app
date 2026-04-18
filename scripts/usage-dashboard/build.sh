#!/bin/sh
# Usage-dashboard build pipeline.
# POSIX-portable: runs on macOS sh and Git Bash on Windows.
set -eu

# Resolve script directory portably (no readlink -f on macOS sh)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# Repo root is two levels up from scripts/usage-dashboard/
REPO_ROOT="${REPO_ROOT:-$(cd "$SCRIPT_DIR/../.." && pwd)}"

# Require ccusage before referencing HOME (so missing-binary error fires early)
if ! command -v ccusage > /dev/null 2>&1; then
  printf 'Error: ccusage not found on PATH.\n' >&2
  printf 'Install it with: npm install -g ccusage\n' >&2
  exit 1
fi

DASHBOARD_DIR="${DASHBOARD_DIR:-$REPO_ROOT/dashboards/usage-dashboard}"
CACHE_DIR="${USAGE_CACHE_DIR:-$HOME/.claude/strawberry-usage-cache}"

SESSIONS_JSON="$CACHE_DIR/sessions.json"
BLOCKS_JSON="$CACHE_DIR/blocks.json"
DAILY_JSON="$CACHE_DIR/daily.json"
AGENTS_JSON="$CACHE_DIR/agents.json"
ROSTER_JSON="$DASHBOARD_DIR/roster.json"
DATA_JSON="$DASHBOARD_DIR/data.json"
DATA_JSON_TMP="$CACHE_DIR/data.json.tmp"

# Create cache dir if missing
mkdir -p "$CACHE_DIR"

printf 'Running ccusage session...\n'
ccusage session -j -i -p > "$SESSIONS_JSON"

printf 'Running ccusage blocks...\n'
ccusage blocks -j > "$BLOCKS_JSON"

printf 'Running ccusage daily...\n'
ccusage daily -j > "$DAILY_JSON"

printf 'Running agent-scan...\n'
ROSTER_FILE="$ROSTER_JSON" \
AGENTS_OUT="$AGENTS_JSON" \
  node "$SCRIPT_DIR/agent-scan.mjs"

printf 'Running merge...\n'
node "$SCRIPT_DIR/merge.mjs" \
  --sessions "$SESSIONS_JSON" \
  --blocks   "$BLOCKS_JSON" \
  --daily    "$DAILY_JSON" \
  --agents   "$AGENTS_JSON" \
  --roster   "$ROSTER_JSON" \
  --out      "$DATA_JSON_TMP"

# Atomic replace: only clobber data.json if merge succeeded
mv "$DATA_JSON_TMP" "$DATA_JSON"

# Summary line
SESSIONS_COUNT=$(node -e "process.stdout.write(String(JSON.parse(require('fs').readFileSync('$DATA_JSON','utf8')).sessions.length))" 2>/dev/null || printf '?')
AGENTS_COUNT=$(node -e "process.stdout.write(String(JSON.parse(require('fs').readFileSync('$DATA_JSON','utf8')).roster.length))" 2>/dev/null || printf '?')
UNKNOWN_COUNT=$(node -e "process.stdout.write(String(JSON.parse(require('fs').readFileSync('$DATA_JSON','utf8')).unknownCount))" 2>/dev/null || printf '?')

printf 'built data.json (%s sessions, %s agents, %s unknown)\n' "$SESSIONS_COUNT" "$AGENTS_COUNT" "$UNKNOWN_COUNT"
