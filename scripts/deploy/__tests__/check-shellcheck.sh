#!/bin/sh
# Static gate G1: shellcheck must pass on scripts/deploy/_lib.sh with zero findings.
# Usage: bash scripts/deploy/__tests__/check-shellcheck.sh [repo-root]
# Exit 0 = clean; non-zero = findings or file absent.

set -eu

REPO_ROOT="${1:-$(cd "$(dirname "$0")/../../.." && pwd)}"
LIB="${REPO_ROOT}/scripts/deploy/_lib.sh"

if [ ! -f "${LIB}" ]; then
  printf 'FAIL (G1): scripts/deploy/_lib.sh not found at: %s\n' "${LIB}" >&2
  exit 1
fi

if ! command -v shellcheck >/dev/null 2>&1; then
  printf 'SKIP (G1): shellcheck not installed — install via brew install shellcheck\n' >&2
  exit 1
fi

shellcheck --shell=bash "${LIB}"
