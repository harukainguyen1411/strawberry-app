#!/usr/bin/env bash
# Apply ruleset-based branch protection for the app repo.
# Run as harukainguyen1411 (repo owner / admin) or any token with Administration:write.
#
# Usage:
#   bash scripts/setup-branch-protection.sh [OWNER/REPO]
#
#   If OWNER/REPO is not provided as $1, falls back to:
#     1. GITHUB_REPOSITORY env var (set automatically in GitHub Actions)
#     2. git remote get-url origin (parsed from the local checkout)
#
# Requires: gh CLI authenticated as a user with Administration:write on the repo.
# The Duongntd agent account has write (not admin) access and CANNOT run this script.
# harukainguyen1411 (repo owner) must run it, or grant Duongntd admin temporarily.
#
# NOTE: This script uses the Rulesets API (not classic branch protection).
# The ruleset gives harukainguyen1411 bypass_mode:"pull_request" — owner can merge
# via PR without satisfying status checks or review requirements, for shepherding.
# The agent account (Duongntd) is NOT in bypass_actors and faces full enforcement.
set -euo pipefail

_derive_repo_from_remote() {
  local remote_url
  remote_url="$(git remote get-url origin 2>/dev/null)" || return 1
  # Handle both https://github.com/owner/repo.git and git@github.com:owner/repo.git
  echo "$remote_url" | sed -E 's|.*github\.com[:/]||; s|\.git$||'
}

if [ -n "${1:-}" ]; then
  REPO="$1"
elif [ -n "${GITHUB_REPOSITORY:-}" ]; then
  REPO="$GITHUB_REPOSITORY"
else
  REPO="$(_derive_repo_from_remote)" || {
    echo "ERROR: cannot determine repo slug. Pass OWNER/REPO as \$1." >&2
    exit 1
  }
fi

echo "=== Step 1: Apply ruleset branch protection on main ==="
echo "Repo: $REPO"

# harukainguyen1411 user ID: 273533031
# bypass_mode: "pull_request" — owner creates a PR but skips checks/reviews for audit trail.
gh api "repos/$REPO/rulesets" \
  -X POST \
  -H "Accept: application/vnd.github+json" \
  --input - <<'JSON'
{
  "name": "main-branch-protection",
  "target": "branch",
  "enforcement": "active",
  "conditions": {
    "ref_name": { "include": ["refs/heads/main"], "exclude": [] }
  },
  "bypass_actors": [
    { "actor_id": 273533031, "actor_type": "User", "bypass_mode": "pull_request" }
  ],
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 1,
        "dismiss_stale_reviews_on_push": true,
        "require_code_owner_review": false,
        "require_last_push_approval": true,
        "required_review_thread_resolution": true
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": true,
        "required_status_checks": [
          { "context": "xfail-first check" },
          { "context": "regression-test check" },
          { "context": "unit-tests" },
          { "context": "Playwright E2E" },
          { "context": "QA report present (UI PRs)" }
        ]
      }
    }
  ]
}
JSON

echo "Done. Ruleset created."

echo ""
echo "=== Step 2: Verify ruleset ==="
gh api "repos/$REPO/rulesets" \
  --jq '.[] | {id, name, enforcement, target}'

echo ""
echo "=== Step 3: Auto-delete branches on merge (idempotent) ==="
gh repo edit "$REPO" --delete-branch-on-merge
echo "Done. Branches auto-delete after merge."

echo ""
echo "=== Step 4: Full verification ==="
echo "Run: gh api repos/$REPO/rulesets/<RULESET_ID> to inspect bypass_actors + rules."
echo "Classic protection endpoint returns 404 (expected — rulesets live separately):"
gh api "repos/$REPO/branches/main/protection" 2>&1 || echo "  -> 404 expected (OK)"
