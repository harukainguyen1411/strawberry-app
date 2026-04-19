#!/usr/bin/env bash
# scripts/hooks/pre-commit-email-guard.sh
#
# Reject commits that use a work-identity email on a personal repo.
# Personal repos are any checkout under ~/Documents/Personal/.
#
# The work email leaked once into strawberry-app history when global
# ~/.gitconfig was still set to duong.nguyen.thai@missmp.eu. This guard
# prevents it from happening again.
#
# Exit codes:
#   0  ok, allow commit
#   1  guard tripped, abort commit
set -e

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo "")"
case "$REPO_ROOT" in
  "$HOME/Documents/Personal/"*) ;;
  *) exit 0 ;;  # not a personal repo — skip
esac

email="$(git config user.email 2>/dev/null || echo "")"

case "$email" in
  *@missmp.eu|*@mmp.*)
    echo "pre-commit-email-guard: refusing to commit with work email ($email) on personal repo." >&2
    echo "Fix: git config user.email duongntd99@users.noreply.github.com" >&2
    exit 1
    ;;
esac

exit 0
