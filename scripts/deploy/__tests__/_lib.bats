#!/usr/bin/env bats
# xfail test suite for scripts/deploy/_lib.sh
# Plan: plans/in-progress/2026-04-18-p1-2-lib-sh-tdd.md
# All tests carry "xfail-P1.2:" prefix so the TDD gate can trace them.
# Expected status before impl: ALL FAIL (lib absent).
# Expected status after Jayce's P1.2-C: ALL PASS.

REPO_ROOT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../../.." && pwd)"
LIB="${REPO_ROOT}/scripts/deploy/_lib.sh"
FIXTURES_BIN="${REPO_ROOT}/scripts/deploy/__tests__/fixtures/bin"

# ---------------------------------------------------------------------------
# Shared setup / teardown
# ---------------------------------------------------------------------------

setup() {
  # Create isolated tmp workspace
  WORK="${BATS_TEST_TMPDIR}/repo"
  mkdir -p "${WORK}/logs"
  mkdir -p "${WORK}/secrets/env"
  mkdir -p "${WORK}/tools"
  mkdir -p "${WORK}/bin"

  # Copy stubs into per-test bin so PATH manipulation is safe
  cp "${FIXTURES_BIN}/git"        "${WORK}/bin/git"
  cp "${FIXTURES_BIN}/firebase"   "${WORK}/bin/firebase"
  cp "${FIXTURES_BIN}/age"        "${WORK}/bin/age"
  cp "${FIXTURES_BIN}/decrypt.sh" "${WORK}/tools/decrypt.sh"

  chmod +x "${WORK}/bin/git" \
            "${WORK}/bin/firebase" \
            "${WORK}/bin/age" \
            "${WORK}/tools/decrypt.sh"

  # Write a dummy .env.age cipher stub (binary content does not matter for stub)
  printf 'age-cipher-stub\n' > "${WORK}/secrets/env/myapps-b31ea.env.age"

  # Initialise stub invocation log paths
  export AGE_STUB_LOG="${BATS_TEST_TMPDIR}/age-invocations.log"
  export DECRYPT_STUB_LOG="${BATS_TEST_TMPDIR}/decrypt-invocations.log"
  touch "${AGE_STUB_LOG}" "${DECRYPT_STUB_LOG}"

  # Prepend stub bin to PATH; also expose tools/ for tools/decrypt.sh contract
  export PATH="${WORK}/bin:${WORK}/tools:${PATH}"

  # Override HOME so ~/.config/firebase etc. do not bleed in
  export HOME="${BATS_TEST_TMPDIR}/home"
  mkdir -p "${HOME}"

  # Unset auth env vars to start clean
  unset GOOGLE_APPLICATION_CREDENTIALS || true
  unset DL_AUDIT_ID || true
}

teardown() {
  : # bats removes BATS_TEST_TMPDIR automatically
}

# ---------------------------------------------------------------------------
# T1 — dl_require_clean_tree
# ---------------------------------------------------------------------------

@test "xfail-P1.2: dl_require_clean_tree blocks dirty tree" {
  # Dirty tree: git stub emits non-empty porcelain output
  export GIT_STUB_PORCELAIN=" M scripts/deploy/_lib.sh"

  run bash -c "source '${LIB}'; dl_require_clean_tree"
  [ "$status" -ne 0 ]
  [[ "$output" == *"uncommitted"* ]] || [[ "$stderr" == *"uncommitted"* ]]
}

@test "xfail-P1.2: dl_require_clean_tree allows clean tree" {
  # Clean tree: git stub emits empty porcelain output
  export GIT_STUB_PORCELAIN=""

  run bash -c "source '${LIB}'; dl_require_clean_tree"
  [ "$status" -eq 0 ]
}

# ---------------------------------------------------------------------------
# T2 — dl_require_main_or_branch_flag
# ---------------------------------------------------------------------------

@test "xfail-P1.2: dl_require_main_or_branch_flag allows main branch" {
  export GIT_STUB_BRANCH="main"

  run bash -c "source '${LIB}'; dl_require_main_or_branch_flag"
  [ "$status" -eq 0 ]
}

@test "xfail-P1.2: dl_require_main_or_branch_flag blocks feature branch without --branch" {
  export GIT_STUB_BRANCH="feature/x"

  run bash -c "source '${LIB}'; dl_require_main_or_branch_flag"
  [ "$status" -ne 0 ]
  # stderr should hint at both the problem and the escape hatch
  [[ "$output" == *"not main"* ]] || [[ "$output" == *"--branch"* ]] || \
  [[ "$stderr" == *"not main"* ]] || [[ "$stderr" == *"--branch"* ]]
}

@test "xfail-P1.2: dl_require_main_or_branch_flag allows feature branch with --branch flag" {
  export GIT_STUB_BRANCH="feature/x"

  run bash -c "source '${LIB}'; dl_require_main_or_branch_flag --branch"
  [ "$status" -eq 0 ]
}

# ---------------------------------------------------------------------------
# T3 — dl_decrypt_env routes through tools/decrypt.sh exclusively
# ---------------------------------------------------------------------------

@test "xfail-P1.2: dl_decrypt_env invokes tools/decrypt.sh not raw age" {
  # tools/decrypt.sh stub logs every invocation; age stub fails + logs if called
  export DECRYPT_STUB_LOG="${BATS_TEST_TMPDIR}/decrypt-invocations.log"
  export AGE_STUB_LOG="${BATS_TEST_TMPDIR}/age-invocations.log"

  WORK="${BATS_TEST_TMPDIR}/repo"

  run bash -c "
    export PATH='${WORK}/bin:${WORK}/tools:${PATH}'
    export DECRYPT_STUB_LOG='${BATS_TEST_TMPDIR}/decrypt-invocations.log'
    export AGE_STUB_LOG='${BATS_TEST_TMPDIR}/age-invocations.log'
    source '${LIB}'
    dl_decrypt_env myapps-b31ea
  "

  # age must never have been called
  AGE_CALLS=$(wc -l < "${AGE_STUB_LOG}" | tr -d ' ')
  [ "${AGE_CALLS}" -eq 0 ]

  # decrypt.sh must have been called at least once
  DECRYPT_CALLS=$(wc -l < "${DECRYPT_STUB_LOG}" | tr -d ' ')
  [ "${DECRYPT_CALLS}" -gt 0 ]
}

@test "xfail-P1.2: dl_decrypt_env source contains no raw age-decrypt call" {
  # Static grep gate: _lib.sh must not invoke the age binary directly (Rule 6).
  # check-no-raw-age.sh carries the actual pattern; this is the bats wrapper.
  run bash "${REPO_ROOT}/scripts/deploy/__tests__/check-no-raw-age.sh" "${LIB}"
  [ "$status" -eq 0 ]
}

@test "xfail-P1.2: dl_decrypt_env age stub never invoked even when age is on PATH" {
  export AGE_STUB_LOG="${BATS_TEST_TMPDIR}/age-invocations.log"
  WORK="${BATS_TEST_TMPDIR}/repo"

  # _lib.sh must exist and source cleanly — if it doesn't this test fails
  [ -f "${LIB}" ] || {
    echo "_lib.sh not found — xfail: lib absent" >&2
    return 1
  }

  run bash -c "
    export PATH='${WORK}/bin:${WORK}/tools:${PATH}'
    export AGE_STUB_LOG='${BATS_TEST_TMPDIR}/age-invocations.log'
    source '${LIB}'
    dl_decrypt_env myapps-b31ea
  "
  [ "$status" -eq 0 ]

  AGE_CALLS=$(wc -l < "${AGE_STUB_LOG}" | tr -d ' ')
  [ "${AGE_CALLS}" -eq 0 ]
}

# ---------------------------------------------------------------------------
# T4 — dl_decrypt_env never prints plaintext to stdout/stderr
# ---------------------------------------------------------------------------

@test "xfail-P1.2: dl_decrypt_env keeps plaintext out of stdio" {
  SENTINEL="STRAWBERRY_SENTINEL_PLAINTEXT_$(date +%s)"
  export DECRYPT_STUB_EMIT="${SENTINEL}"
  WORK="${BATS_TEST_TMPDIR}/repo"

  # _lib.sh must exist — otherwise the test passes vacuously (no output = no sentinel)
  [ -f "${LIB}" ] || {
    echo "_lib.sh not found — xfail: lib absent" >&2
    return 1
  }

  run bash -c "
    export PATH='${WORK}/bin:${WORK}/tools:${PATH}'
    export DECRYPT_STUB_EMIT='${SENTINEL}'
    export DECRYPT_STUB_LOG='${BATS_TEST_TMPDIR}/decrypt-invocations.log'
    source '${LIB}'
    dl_decrypt_env myapps-b31ea
  "
  # The call itself must succeed
  [ "$status" -eq 0 ]

  # sentinel must not appear in stdout or stderr
  [[ "$output" != *"${SENTINEL}"* ]]
  [[ "${stderr:-}" != *"${SENTINEL}"* ]]
}

# ---------------------------------------------------------------------------
# T5 — dl_audit_log_start
# ---------------------------------------------------------------------------

@test "xfail-P1.2: dl_audit_log_start writes a well-formed started record" {
  WORK="${BATS_TEST_TMPDIR}/repo"
  LOG="${WORK}/logs/deploy-audit.jsonl"

  run bash -c "
    export PATH='${WORK}/bin:${WORK}/tools:${PATH}'
    source '${LIB}'
    dl_audit_log_start myapps-b31ea functions abc1234
  "
  [ "$status" -eq 0 ]

  # Exactly one line written
  LINE_COUNT=$(wc -l < "${LOG}" | tr -d ' ')
  [ "${LINE_COUNT}" -eq 1 ]

  # Line is valid JSON
  run bash -c "jq -e . '${LOG}'"
  [ "$status" -eq 0 ]

  # Required fields present
  run bash -c "jq -e '.project == \"myapps-b31ea\"' '${LOG}'"
  [ "$status" -eq 0 ]

  run bash -c "jq -e '.surface == \"functions\"' '${LOG}'"
  [ "$status" -eq 0 ]

  run bash -c "jq -e '.ref == \"abc1234\"' '${LOG}'"
  [ "$status" -eq 0 ]

  run bash -c "jq -e '.status == \"started\"' '${LOG}'"
  [ "$status" -eq 0 ]

  run bash -c "jq -e '.started_at != null and .started_at != \"\"' '${LOG}'"
  [ "$status" -eq 0 ]

  run bash -c "jq -e '.invoker != null and .invoker != \"\"' '${LOG}'"
  [ "$status" -eq 0 ]

  run bash -c "jq -e '.hostname != null and .hostname != \"\"' '${LOG}'"
  [ "$status" -eq 0 ]

  run bash -c "jq -e '.id != null and .id != \"\"' '${LOG}'"
  [ "$status" -eq 0 ]
}

@test "xfail-P1.2: dl_audit_log_start exports id for finish to consume" {
  WORK="${BATS_TEST_TMPDIR}/repo"

  run bash -c "
    export PATH='${WORK}/bin:${WORK}/tools:${PATH}'
    source '${LIB}'
    dl_audit_log_start myapps-b31ea functions abc1234
    # DL_AUDIT_ID must be set after start
    test -n \"\${DL_AUDIT_ID:-}\"
  "
  [ "$status" -eq 0 ]
}

# ---------------------------------------------------------------------------
# T6 — dl_audit_log_finish
# ---------------------------------------------------------------------------

@test "xfail-P1.2: dl_audit_log_finish writes success record matching start id" {
  WORK="${BATS_TEST_TMPDIR}/repo"
  LOG="${WORK}/logs/deploy-audit.jsonl"

  run bash -c "
    export PATH='${WORK}/bin:${WORK}/tools:${PATH}'
    source '${LIB}'
    dl_audit_log_start myapps-b31ea functions abc1234
    sleep 0.01
    dl_audit_log_finish success
  "
  [ "$status" -eq 0 ]

  # Two lines total
  LINE_COUNT=$(wc -l < "${LOG}" | tr -d ' ')
  [ "${LINE_COUNT}" -eq 2 ]

  # Both share the same id
  ID1=$(jq -r '.id' "${LOG}" | head -1)
  ID2=$(jq -r '.id' "${LOG}" | tail -1)
  [ "${ID1}" = "${ID2}" ]

  # Finish record has status=success and positive duration_ms
  run bash -c "jq -e 'select(.status == \"success\") | .duration_ms > 0' '${LOG}'"
  [ "$status" -eq 0 ]
}

@test "xfail-P1.2: dl_audit_log_finish writes failure record with error field" {
  WORK="${BATS_TEST_TMPDIR}/repo"
  LOG="${WORK}/logs/deploy-audit.jsonl"

  run bash -c "
    export PATH='${WORK}/bin:${WORK}/tools:${PATH}'
    source '${LIB}'
    dl_audit_log_start myapps-b31ea functions abc1234
    dl_audit_log_finish failure 'deploy rejected'
  "
  [ "$status" -eq 0 ]

  run bash -c "jq -e 'select(.status == \"failure\") | .error == \"deploy rejected\"' '${LOG}'"
  [ "$status" -eq 0 ]
}

@test "xfail-P1.2: dl_audit_log_finish without prior start exits non-zero" {
  WORK="${BATS_TEST_TMPDIR}/repo"
  LOG="${WORK}/logs/deploy-audit.jsonl"

  # _lib.sh must exist — without it, source itself fails non-zero which would
  # make this test pass vacuously before the function is ever implemented.
  [ -f "${LIB}" ] || {
    echo "_lib.sh not found — xfail: lib absent" >&2
    return 1
  }

  # No start — DL_AUDIT_ID unset
  unset DL_AUDIT_ID || true

  run bash -c "
    export PATH='${WORK}/bin:${WORK}/tools:${PATH}'
    unset DL_AUDIT_ID
    source '${LIB}'
    dl_audit_log_finish success
  "
  [ "$status" -ne 0 ]

  # No malformed line appended (file should be empty or absent)
  if [ -f "${LOG}" ]; then
    LINE_COUNT=$(wc -l < "${LOG}" | tr -d ' ')
    [ "${LINE_COUNT}" -eq 0 ]
  fi
}

# ---------------------------------------------------------------------------
# T7 — dl_require_firebase_only_flag
# ---------------------------------------------------------------------------

@test "xfail-P1.2: dl_require_firebase_only_flag rejects bare firebase deploy" {
  run bash -c "
    source '${LIB}'
    dl_require_firebase_only_flag 'firebase deploy --project myapps-b31ea'
  "
  [ "$status" -ne 0 ]
  [[ "$output" == *"--only"* ]] || [[ "${stderr:-}" == *"--only"* ]]
}

@test "xfail-P1.2: dl_require_firebase_only_flag allows deploy with --only single surface" {
  run bash -c "
    source '${LIB}'
    dl_require_firebase_only_flag 'firebase deploy --only functions --project myapps-b31ea'
  "
  [ "$status" -eq 0 ]
}

@test "xfail-P1.2: dl_require_firebase_only_flag allows deploy with --only comma list" {
  run bash -c "
    source '${LIB}'
    dl_require_firebase_only_flag 'firebase deploy --only hosting,functions --project myapps-b31ea'
  "
  [ "$status" -eq 0 ]
}

@test "xfail-P1.2: dl_require_firebase_only_flag ignores non-deploy firebase commands" {
  run bash -c "
    source '${LIB}'
    dl_require_firebase_only_flag 'firebase emulators:start'
  "
  [ "$status" -eq 0 ]
}

# ---------------------------------------------------------------------------
# T8 — dl_detect_firebase_auth
# ---------------------------------------------------------------------------

@test "xfail-P1.2: dl_detect_firebase_auth returns sa-file when credentials file exists" {
  SA_FILE="${BATS_TEST_TMPDIR}/fixture-sa.json"
  printf '{"type":"service_account"}\n' > "${SA_FILE}"
  export GOOGLE_APPLICATION_CREDENTIALS="${SA_FILE}"
  WORK="${BATS_TEST_TMPDIR}/repo"

  run bash -c "
    export PATH='${WORK}/bin:${WORK}/tools:${PATH}'
    export GOOGLE_APPLICATION_CREDENTIALS='${SA_FILE}'
    source '${LIB}'
    dl_detect_firebase_auth
  "
  [ "$status" -eq 0 ]
  [[ "$output" == *"sa-file"* ]]
}

@test "xfail-P1.2: dl_detect_firebase_auth exits non-zero when credentials file is missing" {
  export GOOGLE_APPLICATION_CREDENTIALS="/nonexistent/path/sa.json"
  WORK="${BATS_TEST_TMPDIR}/repo"

  run bash -c "
    export PATH='${WORK}/bin:${WORK}/tools:${PATH}'
    export GOOGLE_APPLICATION_CREDENTIALS='/nonexistent/path/sa.json'
    source '${LIB}'
    dl_detect_firebase_auth
  "
  [ "$status" -ne 0 ]
  # stderr must mention the missing path — no silent fallback to personal CLI
  [[ "$output" == *"/nonexistent/path/sa.json"* ]] || \
  [[ "${stderr:-}" == *"/nonexistent/path/sa.json"* ]]
}

@test "xfail-P1.2: dl_detect_firebase_auth returns personal-cli when firebase login active" {
  unset GOOGLE_APPLICATION_CREDENTIALS || true
  export FIREBASE_STUB_LOGIN_LIST="active"
  WORK="${BATS_TEST_TMPDIR}/repo"

  run bash -c "
    export PATH='${WORK}/bin:${WORK}/tools:${PATH}'
    export FIREBASE_STUB_LOGIN_LIST='active'
    unset GOOGLE_APPLICATION_CREDENTIALS
    source '${LIB}'
    dl_detect_firebase_auth
  "
  [ "$status" -eq 0 ]
  [[ "$output" == *"personal-cli"* ]]
}

@test "xfail-P1.2: dl_detect_firebase_auth exits non-zero when no auth present" {
  unset GOOGLE_APPLICATION_CREDENTIALS || true
  export FIREBASE_STUB_LOGIN_LIST="none"
  WORK="${BATS_TEST_TMPDIR}/repo"

  # _lib.sh must exist — without it, source fails non-zero vacuously
  [ -f "${LIB}" ] || {
    echo "_lib.sh not found — xfail: lib absent" >&2
    return 1
  }

  run bash -c "
    export PATH='${WORK}/bin:${WORK}/tools:${PATH}'
    export FIREBASE_STUB_LOGIN_LIST='none'
    unset GOOGLE_APPLICATION_CREDENTIALS
    source '${LIB}'
    dl_detect_firebase_auth
  "
  [ "$status" -ne 0 ]
}

# ---------------------------------------------------------------------------
# G1 — Static gate: shellcheck clean
# ---------------------------------------------------------------------------

@test "xfail-P1.2: shellcheck clean on scripts/deploy/_lib.sh" {
  run bash "${REPO_ROOT}/scripts/deploy/__tests__/check-shellcheck.sh" "${REPO_ROOT}"
  [ "$status" -eq 0 ]
}

# ---------------------------------------------------------------------------
# G2 — Static gate: no bare firebase deploy in scripts/deploy/**
# ---------------------------------------------------------------------------

@test "xfail-P1.2: no bare firebase deploy in scripts/deploy real tree" {
  # Real scripts/deploy/ tree should be clean — exclude __tests__/fixtures which
  # intentionally contain a bad-caller.sh for gate self-testing (G2 design).
  run bash "${REPO_ROOT}/scripts/deploy/__tests__/check-no-bare-deploy.sh" \
    "${REPO_ROOT}/scripts/deploy" --exclude "__tests__"
  [ "$status" -eq 0 ]
}

@test "xfail-P1.2: gate detects bare deploy in bad-caller fixture" {
  # The fixture intentionally has a bare firebase deploy — gate must exit 1
  run bash "${REPO_ROOT}/scripts/deploy/__tests__/check-no-bare-deploy.sh" \
    "${REPO_ROOT}/scripts/deploy/__tests__/fixtures/bad-caller.sh"
  [ "$status" -eq 1 ]
}

# ---------------------------------------------------------------------------
# G3 — Safe-to-source gate
# ---------------------------------------------------------------------------

@test "xfail-P1.2: safe-to-source under set -euo pipefail" {
  run bash -c "set -euo pipefail; source '${LIB}'; echo OK"
  [ "$status" -eq 0 ]
  [[ "$output" == *"OK"* ]]
}
