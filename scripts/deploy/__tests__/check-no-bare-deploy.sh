#!/bin/sh
# Static gate G2: no bare `firebase deploy` (without --only) in the given path.
# Usage: bash scripts/deploy/__tests__/check-no-bare-deploy.sh <search-path> [--exclude <pattern>]
#
# Options:
#   --exclude <pattern>  grep -v pattern applied to found file paths (e.g. __tests__)
#
# The script greps for `firebase deploy` lines that do NOT have --only
# somewhere on the same logical line (allowing for line continuations).
# Exit 1 (bad) if violations found; exit 0 (good) if clean.
#
# Design note: violations means the gate works (self-test fixture uses this).
# Callers invert expectation based on which path is being searched.

set -eu

SEARCH_PATH="${1:-}"
EXCLUDE_PATTERN=""

if [ -z "${SEARCH_PATH}" ]; then
  printf 'Usage: %s <search-path> [--exclude <pattern>]\n' "$0" >&2
  exit 2
fi
shift

# Parse optional --exclude flag
while [ $# -gt 0 ]; do
  case "$1" in
    --exclude)
      EXCLUDE_PATTERN="${2:-}"
      shift 2
      ;;
    *)
      printf 'Unknown option: %s\n' "$1" >&2
      exit 2
      ;;
  esac
done

if [ ! -e "${SEARCH_PATH}" ]; then
  printf 'FAIL: search path does not exist: %s\n' "${SEARCH_PATH}" >&2
  exit 2
fi

# Find lines containing `firebase deploy` but not `--only`
# Uses grep -rEn; awk filters out lines that also contain --only on same line.
RAW_HITS=$(grep -rEn 'firebase[[:space:]]+deploy' "${SEARCH_PATH}" 2>/dev/null || true)

# Apply --exclude if provided
if [ -n "${EXCLUDE_PATTERN}" ] && [ -n "${RAW_HITS}" ]; then
  HITS=$(printf '%s\n' "${RAW_HITS}" | grep -v "${EXCLUDE_PATTERN}" || true)
else
  HITS="${RAW_HITS}"
fi

# Now filter out lines that include --only (those are compliant)
VIOLATIONS=$(printf '%s\n' "${HITS}" | grep -v '\-\-only' | grep -v '^$' || true)

if [ -n "${VIOLATIONS}" ]; then
  printf 'FAIL (G2): bare firebase deploy found (no --only):\n%s\n' "${VIOLATIONS}" >&2
  exit 1
fi

printf 'PASS (G2): no bare firebase deploy found in: %s\n' "${SEARCH_PATH}"
exit 0
