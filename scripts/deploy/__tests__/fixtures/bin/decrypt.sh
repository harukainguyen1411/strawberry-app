#!/bin/sh
# Stub for tools/decrypt.sh — records invocations for T3 assertions.
# Env:
#   DECRYPT_STUB_LOG   — path to write invocation log (one line per call)
#   DECRYPT_STUB_EMIT  — if set, emit this sentinel value to stdout (tests T4)

LOG="${DECRYPT_STUB_LOG:-/tmp/decrypt-stub.log}"
printf 'decrypt.sh %s\n' "$*" >> "${LOG}"

# If told to emit a sentinel value, do so (used by T4 to check lib does not re-echo it)
if [ -n "${DECRYPT_STUB_EMIT:-}" ]; then
  printf '%s\n' "${DECRYPT_STUB_EMIT}"
fi

exit 0
