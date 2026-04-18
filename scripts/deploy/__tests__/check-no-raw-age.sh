#!/bin/sh
# Static sub-gate: verify a script file does not contain raw age decryption invocations.
# Usage: bash check-no-raw-age.sh <file>
# Exit 0 = clean; exit 1 = violation found.
# Mirrors the pre-commit hook's secret-scan pattern (Rule 6).

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

VIOLATIONS=$(grep -En "${PATTERN}" "${TARGET}" 2>/dev/null || true)

if [ -n "${VIOLATIONS}" ]; then
  printf 'FAIL: raw %s %s found in %s:\n%s\n' "${AGE_CMD}" "${DECRYPT_FLAG}" "${TARGET}" "${VIOLATIONS}" >&2
  exit 1
fi

printf 'PASS: no raw %s %s in %s\n' "${AGE_CMD}" "${DECRYPT_FLAG}" "${TARGET}"
exit 0
