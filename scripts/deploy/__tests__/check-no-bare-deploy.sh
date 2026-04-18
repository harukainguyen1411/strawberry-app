#!/bin/sh
# Static gate G2: no bare `firebase deploy` (without --only) in the given path.
# Usage: bash scripts/deploy/__tests__/check-no-bare-deploy.sh <search-path> [--exclude <pattern>]
#
# Options:
#   --exclude <pattern>  grep -v pattern applied to found file paths (e.g. __tests__/fixtures/)
#
# The script greps for `firebase deploy` lines that do NOT have --only
# somewhere on the same logical line (allowing for line continuations).
# Exit 1 (bad) if violations found; exit 0 (good) if clean.
#
# Design note: violations means the gate works (self-test fixture uses this).
# Callers invert expectation based on which path is being searched.
#
# False-positive filtering:
#   After collecting raw grep hits, the pipeline strips lines where
#   `firebase deploy` appears only as a text string (not a shell invocation):
#     - Lines whose code portion is a shell comment (starts with #)
#     - Lines inside a bats @test name annotation
#     - Lines inside a printf/echo format string
#     - Lines inside a single-quoted string argument
#   This allows __tests__/ helper scripts and _lib.bats to reference the
#   pattern in strings/comments without triggering the gate, while still
#   catching actual bare `firebase deploy` shell invocations.

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

# Collect raw hits: filename:linenum:content lines containing `firebase deploy`
RAW_HITS=$(grep -rEn 'firebase[[:space:]]+deploy' "${SEARCH_PATH}" 2>/dev/null || true)

# Apply --exclude if provided (match against full file path)
if [ -n "${EXCLUDE_PATTERN}" ] && [ -n "${RAW_HITS}" ]; then
  HITS=$(printf '%s\n' "${RAW_HITS}" | grep -v "${EXCLUDE_PATTERN}" || true)
else
  HITS="${RAW_HITS}"
fi

# Strip lines that are already compliant (have --only on the same line)
HITS=$(printf '%s\n' "${HITS}" | grep -v '\-\-only' | grep -v '^$' || true)

# Strip false positives: lines where firebase deploy is only a text string, not a command.
# grep -v patterns applied in sequence:
#   1. Shell comment lines (code portion starts with optional whitespace then #)
#   2. bats @test annotation lines (test names — firebase deploy is a label)
#   3. printf / echo format strings containing firebase deploy
#   4. Single-quoted string arguments containing firebase deploy
VIOLATIONS=$(printf '%s\n' "${HITS}" \
  | grep -vE ':[0-9]+:[[:space:]]*#' \
  | grep -v '@test ' \
  | grep -vE "(printf|echo)[[:space:]]" \
  | grep -v "'firebase[[:space:]]" \
  | grep -v '"firebase[[:space:]]' \
  | grep -v '^$' \
  || true)

if [ -n "${VIOLATIONS}" ]; then
  printf 'FAIL (G2): bare firebase deploy found (no --only):\n%s\n' "${VIOLATIONS}" >&2
  exit 1
fi

printf 'PASS (G2): no bare firebase deploy found in: %s\n' "${SEARCH_PATH}"
exit 0
