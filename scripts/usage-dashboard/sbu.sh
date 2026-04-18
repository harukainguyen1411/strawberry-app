#!/bin/sh
# sbu — Strawberry Build & Update CLI alias for the usage dashboard.
#
# Usage:
#   sbu                 Build data.json then open the dashboard in the browser.
#   sbu --serve         Also start refresh-server.mjs in the background (PID guard).
#   sbu --no-open       Skip the `open` step (useful in CI or headless environments).
#   sbu --serve --no-open
#
# Environment overrides (mostly for testing):
#   BUILD_SH              Path to build.sh (default: same dir as this script)
#   REFRESH_SERVER_MJS    Path to refresh-server.mjs (default: same dir)
#   PID_FILE              Path to PID file (default: ~/.claude/strawberry-usage-cache/refresh-server.pid)
#   REPO_ROOT             Repo root (default: two levels up from this script's dir)
#
# POSIX-portable: runs on macOS sh and Git Bash on Windows.

set -eu

# --- Resolve paths ---
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="${REPO_ROOT:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
BUILD_SH="${BUILD_SH:-$SCRIPT_DIR/build.sh}"
REFRESH_SERVER_MJS="${REFRESH_SERVER_MJS:-$SCRIPT_DIR/refresh-server.mjs}"
DASHBOARD_INDEX="$REPO_ROOT/dashboards/usage-dashboard/index.html"
PID_FILE="${PID_FILE:-$HOME/.claude/strawberry-usage-cache/refresh-server.pid}"

# --- Parse flags ---
DO_SERVE=0
DO_OPEN=1

for arg in "$@"; do
  case "$arg" in
    --serve)    DO_SERVE=1 ;;
    --no-open)  DO_OPEN=0 ;;
    *)
      printf 'Unknown flag: %s\n' "$arg" >&2
      printf 'Usage: sbu [--serve] [--no-open]\n' >&2
      exit 1
      ;;
  esac
done

# --- Run build ---
printf 'sbu: running build...\n'
bash "$BUILD_SH"

# --- Optionally start refresh server ---
if [ "$DO_SERVE" = "1" ]; then
  # PID guard: refuse to start a second instance if PID file exists and process is alive
  if [ -f "$PID_FILE" ]; then
    OLD_PID="$(cat "$PID_FILE")"
    if kill -0 "$OLD_PID" 2>/dev/null; then
      printf 'sbu: refresh-server is already running (PID %s). Not starting another instance.\n' "$OLD_PID" >&2
      exit 1
    else
      # Stale PID file — clean it up
      rm -f "$PID_FILE"
    fi
  fi

  # Ensure cache dir exists for PID file
  mkdir -p "$(dirname "$PID_FILE")"

  # Start server in background (nohup, detached)
  nohup node "$REFRESH_SERVER_MJS" >/dev/null 2>&1 &
  SERVER_PID=$!
  printf '%s' "$SERVER_PID" > "$PID_FILE"
  printf 'sbu: refresh-server started (PID %s), PID recorded at %s\n' "$SERVER_PID" "$PID_FILE"

  # Quick liveness check — catches immediate bind failures
  sleep 0.5
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    printf 'sbu: refresh-server exited immediately after launch — check port conflicts.\n' >&2
    rm -f "$PID_FILE"
    exit 1
  fi
fi

# --- Cross-platform open helper ---
open_url() {
  _url="$1"
  if command -v open >/dev/null 2>&1; then
    open "$_url"
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$_url"
  elif command -v start >/dev/null 2>&1; then
    start "$_url"
  else
    printf 'sbu: cannot open browser automatically — no open/xdg-open/start found on PATH.\n' >&2
    printf 'sbu: open this file manually: %s\n' "$_url" >&2
    return 1
  fi
}

# --- Open dashboard ---
if [ "$DO_OPEN" = "1" ]; then
  printf 'sbu: opening %s\n' "$DASHBOARD_INDEX"
  open_url "$DASHBOARD_INDEX"
fi

printf 'sbu: done.\n'
