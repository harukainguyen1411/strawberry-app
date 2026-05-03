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
CACHE_DIR="${USAGE_CACHE_DIR:-$HOME/.claude/raspberry-usage-cache}"

SESSIONS_JSON="$CACHE_DIR/sessions.json"
BLOCKS_JSON="$CACHE_DIR/blocks.json"
DAILY_JSON="$CACHE_DIR/daily.json"
DATA_JSON="$DASHBOARD_DIR/data.json"
# Tmp file in same directory as destination — guarantees same filesystem for atomic mv
DATA_JSON_TMP="$DASHBOARD_DIR/data.json.tmp"

# Create cache dir if missing
mkdir -p "$CACHE_DIR"

printf 'Running ccusage session...\n'
ccusage session -j > "$SESSIONS_JSON"

printf 'Running ccusage blocks...\n'
ccusage blocks -j > "$BLOCKS_JSON"

printf 'Running ccusage daily...\n'
ccusage daily -j > "$DAILY_JSON"

PHASE_SCAN_JSON="$CACHE_DIR/phase-scan.json"
PROJECTS_JSON="$DASHBOARD_DIR/projects.json"
PLANS_JSON="$DASHBOARD_DIR/plans.json"

# Generate registries BEFORE phase-scan so a fresh checkout (no committed
# projects.json/plans.json yet) still gets attribution on first run.
printf 'Running generate-projects...\n'
PROJECTS_OUT="$PROJECTS_JSON" \
  node "$SCRIPT_DIR/generate-projects.mjs"

printf 'Running generate-plans...\n'
PLANS_OUT="$PLANS_JSON" \
  node "$SCRIPT_DIR/generate-plans.mjs"

printf 'Running phase-scan...\n'
PHASE_SCAN_OUT="$PHASE_SCAN_JSON" \
  node "$SCRIPT_DIR/phase-scan.mjs" \
  --projects "$PROJECTS_JSON" \
  --plans    "$PLANS_JSON"

printf 'Running merge...\n'
node "$SCRIPT_DIR/merge.mjs" \
  --sessions   "$SESSIONS_JSON" \
  --blocks     "$BLOCKS_JSON" \
  --daily      "$DAILY_JSON" \
  --phase-scan "$PHASE_SCAN_JSON" \
  --projects   "$PROJECTS_JSON" \
  --plans      "$PLANS_JSON" \
  --out        "$DATA_JSON_TMP"

# Atomic replace: only clobber data.json if merge succeeded
mv "$DATA_JSON_TMP" "$DATA_JSON"

# Summary line — pass path via argv to handle spaces/special chars in $DATA_JSON
SESSIONS_COUNT=$(node -e 'var d=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));process.stdout.write(String(d.sessions.length))' -- "$DATA_JSON" 2>/dev/null || printf '?')
PROJECTS_COUNT=$(node -e 'var d=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));process.stdout.write(String(d.projects.length))' -- "$DATA_JSON" 2>/dev/null || printf '?')
SCHEMA_VERSION=$(node -e 'var d=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));process.stdout.write(String(d.schemaVersion))' -- "$DATA_JSON" 2>/dev/null || printf '?')

printf 'built data.json (%s sessions, %s projects, schemaVersion %s)\n' "$SESSIONS_COUNT" "$PROJECTS_COUNT" "$SCHEMA_VERSION"
