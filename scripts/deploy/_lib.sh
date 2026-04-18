#!/bin/bash
# scripts/deploy/_lib.sh — shared helpers for all surface deploy scripts
# Plan: plans/in-progress/2026-04-17-deployment-pipeline.md
# Plan: plans/in-progress/2026-04-18-p1-2-lib-sh-tdd.md
#
# Usage: source scripts/deploy/_lib.sh
#
# All functions are prefixed dl_ (deploy-lib) to avoid name clashes.
# This file must be safe to source under set -euo pipefail with no env
# pre-set (no top-level commands that can exit non-zero at source time).
#
# Rules enforced:
#   Rule 6  — use tools/decrypt.sh exclusively; do not invoke the age binary.
#   Rule 10 — POSIX bash, no zsh-isms, works on Git Bash on Windows.
#   ADR §1a.7 — every firebase deploy must use --only <surface>.

# ---------------------------------------------------------------------------
# Internal: derive repo root at source time.
#
# Priority order:
#   1. DL_REPO_ROOT env var (explicit caller override — set this in callers).
#   2. If tools/decrypt.sh is findable as a bare command on PATH, its parent's
#      parent is treated as the repo root. The test harness places the decrypt
#      stub at <root>/tools/decrypt.sh and puts <root>/tools on PATH, so this
#      heuristic lets tests run hermetically without touching the real working
#      tree.
#   3. Fall back to BASH_SOURCE[0]-derived path (real repo root).
#
# All detection uses `if` guards so the top-level code is safe under set -e.
# ---------------------------------------------------------------------------

_DL_LIB_SELF="${BASH_SOURCE[0]}"
_DL_LIB_DIR="$(cd "$(dirname "${_DL_LIB_SELF}")" && pwd)"
_DL_SOURCE_ROOT="$(cd "${_DL_LIB_DIR}/../.." && pwd)"

if [ -z "${DL_REPO_ROOT:-}" ]; then
    # Heuristic: if decrypt.sh is on PATH as a bare command, its parent's
    # parent is the project root (test-harness convention).
    _DL_DECRYPT_ON_PATH=""
    if command -v decrypt.sh >/dev/null 2>&1; then
        _DL_DECRYPT_ON_PATH="$(command -v decrypt.sh)"
    fi

    if [ -n "${_DL_DECRYPT_ON_PATH}" ]; then
        _DL_TOOLS_DIR="$(cd "$(dirname "${_DL_DECRYPT_ON_PATH}")" && pwd)"
        DL_REPO_ROOT="$(dirname "${_DL_TOOLS_DIR}")"
    else
        DL_REPO_ROOT="${_DL_SOURCE_ROOT}"
    fi
fi

# Audit log path — overridable via env var for advanced use-cases.
DL_AUDIT_LOG="${DL_AUDIT_LOG:-${DL_REPO_ROOT}/logs/deploy-audit.jsonl}"

# ---------------------------------------------------------------------------
# _dl_uuid — generate a pseudo-unique ID without external dependencies
# ---------------------------------------------------------------------------
_dl_uuid() {
    printf '%s-%s-%s%s' "$(date -u +%s)" "$$" "${RANDOM}" "${RANDOM}"
}

# ---------------------------------------------------------------------------
# _dl_resolve_decrypt_tool — locate the decrypt helper
# Prefers the stub on PATH (test isolation); falls back to repo-relative path.
# ---------------------------------------------------------------------------
_dl_resolve_decrypt_tool() {
    if command -v decrypt.sh >/dev/null 2>&1; then
        command -v decrypt.sh
        return 0
    fi
    printf '%s' "${DL_REPO_ROOT}/tools/decrypt.sh"
}

# ---------------------------------------------------------------------------
# dl_require_clean_tree
# Exits non-zero with a message to stderr if the working tree is dirty.
# ---------------------------------------------------------------------------
dl_require_clean_tree() {
    local porcelain
    porcelain="$(git status --porcelain 2>/dev/null)"
    if [ -n "${porcelain}" ]; then
        printf 'dl_require_clean_tree: uncommitted changes detected. Commit or stash before deploying.\n' >&2
        return 1
    fi
    return 0
}

# ---------------------------------------------------------------------------
# dl_require_main_or_branch_flag [--branch]
# Exits non-zero if not on main and --branch flag is not supplied.
# ---------------------------------------------------------------------------
dl_require_main_or_branch_flag() {
    local allow_branch=0
    local arg
    for arg in "$@"; do
        if [ "${arg}" = "--branch" ]; then
            allow_branch=1
        fi
    done

    local current_branch
    current_branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null)"

    if [ "${current_branch}" = "main" ]; then
        return 0
    fi

    if [ "${allow_branch}" -eq 1 ]; then
        return 0
    fi

    printf 'dl_require_main_or_branch_flag: current branch is not main ("%s"). Use --branch to deploy from a non-main branch.\n' \
        "${current_branch}" >&2
    return 1
}

# ---------------------------------------------------------------------------
# dl_decrypt_env <project>
# Invokes tools/decrypt.sh for the project ciphertext env file.
# The age binary is never invoked directly (Rule 6).
# Plaintext is not forwarded to stdout/stderr (FM-4).
# ---------------------------------------------------------------------------
dl_decrypt_env() {
    local project="${1:?dl_decrypt_env: project argument required}"
    local cipher_file="${DL_REPO_ROOT}/secrets/env/${project}.env.age"
    local decrypt_tool
    decrypt_tool="$(_dl_resolve_decrypt_tool)"

    # Invoke the decrypt helper. Redirect its output so plaintext does not
    # appear in our stdio streams. Let the helper surface its own errors.
    "${decrypt_tool}" "${cipher_file}" >/dev/null 2>/dev/null
}

# ---------------------------------------------------------------------------
# dl_audit_log_start <project> <surface> <ref>
# Appends a "started" JSONL record to DL_AUDIT_LOG.
# Exports DL_AUDIT_ID (uuid-ish string) for dl_audit_log_finish to consume.
# ---------------------------------------------------------------------------
dl_audit_log_start() {
    local project="${1:?dl_audit_log_start: project required}"
    local surface="${2:?dl_audit_log_start: surface required}"
    local ref="${3:?dl_audit_log_start: ref required}"

    local id
    id="$(_dl_uuid)"

    local started_at
    started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

    local invoker
    invoker="${USER:-${LOGNAME:-unknown}}"

    local hostname_val
    hostname_val="$(hostname -s 2>/dev/null || printf 'unknown')"

    local log_dir
    log_dir="$(dirname "${DL_AUDIT_LOG}")"
    mkdir -p "${log_dir}"

    printf '{"id":"%s","project":"%s","surface":"%s","ref":"%s","status":"started","started_at":"%s","invoker":"%s","hostname":"%s"}\n' \
        "${id}" \
        "${project}" \
        "${surface}" \
        "${ref}" \
        "${started_at}" \
        "${invoker}" \
        "${hostname_val}" \
        >> "${DL_AUDIT_LOG}"

    # Export id for dl_audit_log_finish (T5b contract).
    DL_AUDIT_ID="${id}"
    export DL_AUDIT_ID

    # Record start epoch for duration_ms calculation in finish.
    _DL_START_EPOCH="$(date -u +%s)"
    export _DL_START_EPOCH
}

# ---------------------------------------------------------------------------
# dl_audit_log_finish <status> [error-message]
# Appends a "success|failure" JSONL record matching the prior start id.
# Exits non-zero if called without a prior dl_audit_log_start (FM-5).
# ---------------------------------------------------------------------------
dl_audit_log_finish() {
    local outcome="${1:?dl_audit_log_finish: status (success|failure) required}"
    local error_msg="${2:-}"

    if [ -z "${DL_AUDIT_ID:-}" ]; then
        printf 'dl_audit_log_finish: no DL_AUDIT_ID set — call dl_audit_log_start first.\n' >&2
        return 1
    fi

    local finished_at
    finished_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

    # POSIX-portable duration: seconds difference × 1000.
    local duration_ms=1
    if [ -n "${_DL_START_EPOCH:-}" ]; then
        local now_epoch
        now_epoch="$(date -u +%s)"
        duration_ms=$(( (now_epoch - _DL_START_EPOCH) * 1000 ))
        if [ "${duration_ms}" -le 0 ]; then
            duration_ms=1
        fi
    fi

    local log_dir
    log_dir="$(dirname "${DL_AUDIT_LOG}")"
    mkdir -p "${log_dir}"

    if [ -n "${error_msg}" ]; then
        printf '{"id":"%s","status":"%s","finished_at":"%s","duration_ms":%s,"error":"%s"}\n' \
            "${DL_AUDIT_ID}" \
            "${outcome}" \
            "${finished_at}" \
            "${duration_ms}" \
            "${error_msg}" \
            >> "${DL_AUDIT_LOG}"
    else
        printf '{"id":"%s","status":"%s","finished_at":"%s","duration_ms":%s}\n' \
            "${DL_AUDIT_ID}" \
            "${outcome}" \
            "${finished_at}" \
            "${duration_ms}" \
            >> "${DL_AUDIT_LOG}"
    fi
}

# ---------------------------------------------------------------------------
# dl_require_firebase_only_flag <deploy-command-string>
# Exits non-zero if the string contains a bare invocation of the firebase
# deploy subcommand without --only. ADR §1a.7 hard contract.
# ---------------------------------------------------------------------------
dl_require_firebase_only_flag() {
    local cmd_string="${1:?dl_require_firebase_only_flag: command string required}"

    # If the string does not contain the deploy subcommand, allow it.
    if ! printf '%s' "${cmd_string}" | grep -qE 'firebase[[:space:]]+deploy'; then
        return 0
    fi

    # The string has the deploy subcommand — require --only to be present.
    if printf '%s' "${cmd_string}" | grep -qE 'firebase[[:space:]]+deploy.*--only'; then
        return 0
    fi

    printf 'dl_require_firebase_only_flag: surface isolation violated — use --only <surface>.\n' >&2
    return 1
}

# ---------------------------------------------------------------------------
# dl_detect_firebase_auth
# Echoes "sa-file" when GOOGLE_APPLICATION_CREDENTIALS is set and the file
# exists. Echoes "personal-cli" when a Firebase CLI login is active.
# Exits non-zero when no auth is found.
# Does NOT silently fall back from SA-file to personal-CLI (FM-8).
# ---------------------------------------------------------------------------
dl_detect_firebase_auth() {
    if [ -n "${GOOGLE_APPLICATION_CREDENTIALS:-}" ]; then
        if [ -f "${GOOGLE_APPLICATION_CREDENTIALS}" ]; then
            printf 'sa-file\n'
            return 0
        else
            printf 'dl_detect_firebase_auth: GOOGLE_APPLICATION_CREDENTIALS set but file not found: %s\n' \
                "${GOOGLE_APPLICATION_CREDENTIALS}" >&2
            return 1
        fi
    fi

    # No SA credentials env var — probe the CLI for an active login session.
    local login_output
    if login_output="$(firebase login:list 2>/dev/null)"; then
        if printf '%s' "${login_output}" | grep -qiE 'User:|@'; then
            printf 'personal-cli\n'
            return 0
        fi
    fi

    printf 'dl_detect_firebase_auth: no Firebase authentication found. Set GOOGLE_APPLICATION_CREDENTIALS or run firebase login.\n' >&2
    return 1
}
