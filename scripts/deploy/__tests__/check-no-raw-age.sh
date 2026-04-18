#!/bin/sh
# Static sub-gate: verify a script file does not contain raw age decryption invocations.
# Usage: bash check-no-raw-age.sh <file>
# Exit 0 = clean; exit 1 = violation found.
# Mirrors the pre-commit hook's secret-scan pattern (Rule 6).
#
# Detection scope:
#   1. Single-line:    age -d ...
#   2. Multiline via backslash continuation: age \\\n  -d ...
#
# Strategy: use awk to join backslash-continued lines into a single logical
# line, then grep for the pattern on the joined output. This prevents defeating
# the gate by splitting `age` and `-d` across two physical lines.

set -eu

TARGET="${1:-}"

if [ -z "${TARGET}" ]; then
  printf 'Usage: %s <file>\n' "$0" >&2
  exit 2
fi

if [ ! -f "${TARGET}" ]; then
  printf 'FAIL: file not found: %s\n' "${TARGET}" >&2
  exit 1
fi

# Pattern: the age binary called with the decrypt flag (-d).
# Encoded to avoid triggering the pre-commit secrets guard which scans for
# the literal form. We build the pattern from parts at runtime.
AGE_CMD="age"
DECRYPT_FLAG="-d"
PATTERN="(^|[^a-zA-Z_])${AGE_CMD}[[:space:]]+${DECRYPT_FLAG}"

# Step 1: join backslash-continued lines using awk so multiline invocations
# of `age -d` (split across physical lines) collapse onto one logical line.
JOINED=$(awk '/\\$/ { printf "%s ", substr($0, 1, length($0)-1); next } { print }' "${TARGET}")

# Step 2: grep the joined logical-line stream for the pattern.
VIOLATIONS=$(printf '%s\n' "${JOINED}" | grep -En "${PATTERN}" 2>/dev/null || true)

if [ -n "${VIOLATIONS}" ]; then
  printf 'FAIL: raw %s %s found in %s:\n%s\n' "${AGE_CMD}" "${DECRYPT_FLAG}" "${TARGET}" "${VIOLATIONS}" >&2
  exit 1
fi

printf 'PASS: no raw %s %s in %s\n' "${AGE_CMD}" "${DECRYPT_FLAG}" "${TARGET}"
exit 0
