#!/bin/sh
# install-cron.sh — install a crontab entry that runs build.sh every 10 minutes.
# Idempotent: deduplicates an existing entry for the same build.sh path.
# Runs a verify-cutover precheck before declaring success.
set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BUILD_SH="$SCRIPT_DIR/build.sh"
CACHE_DIR="$HOME/.claude/raspberry-usage-cache"
DATA_JSON="${DASHBOARD_DIR:-$REPO_ROOT/dashboards/usage-dashboard}/data.json"
CRON_ENTRY="*/10 * * * * USAGE_CACHE_DIR=$HOME/.claude/raspberry-usage-cache sh $BUILD_SH >>$HOME/.claude/raspberry-usage-cache/cron.log 2>&1"

verify_cutover() {
  printf 'Running one build to verify pipeline...\n'
  USAGE_CACHE_DIR="$HOME/.claude/raspberry-usage-cache" sh "$BUILD_SH"
  if ! test -f "$DATA_JSON"; then
    printf 'ERROR: build did not produce %s\n' "$DATA_JSON" >&2; exit 1
  fi
  if ! grep -q '"schemaVersion": 2' "$DATA_JSON"; then
    printf 'ERROR: %s schemaVersion is not 2\n' "$DATA_JSON" >&2; exit 1
  fi
  printf 'cutover verified — schemaVersion 2 in %s\n' "$DATA_JSON"
}

verify_cutover

# Capture existing crontab, stripping any prior entry for this build.sh
EXISTING="$(crontab -l 2>/dev/null | grep -vF "$BUILD_SH" || true)"

printf '%s\n%s\n' "$EXISTING" "$CRON_ENTRY" | crontab -

printf 'Crontab entry installed:\n  %s\n' "$CRON_ENTRY"

if test -d "$HOME/.claude/strawberry-usage-cache"; then
  printf '\nLegacy cache directory still present at %s/.claude/strawberry-usage-cache\n' "$HOME"
  printf 'After verifying the new dashboard works, remove it with:\n'
  printf '  rm -rf "%s/.claude/strawberry-usage-cache"\n' "$HOME"
fi
