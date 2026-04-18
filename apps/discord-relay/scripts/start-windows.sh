#!/usr/bin/env bash
# start-windows.sh — run discord-relay under Git Bash on Windows.
# Reads secrets from the repo's secrets/ directory, exports env vars, runs npm start.
# Usage: bash apps/discord-relay/scripts/start-windows.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
RELAY_DIR="$REPO_ROOT/apps/discord-relay"
SECRETS_DIR="$REPO_ROOT/secrets"

read_secret() {
  local file="$SECRETS_DIR/$1"
  if [[ ! -f "$file" ]]; then
    echo "ERROR: secret file not found: $file" >&2
    exit 1
  fi
  # Strip trailing newline
  tr -d '\r\n' < "$file"
}

# Prefer env-file form (sourced), fall back to .txt (per-file raw value).
# The .env form is produced by tools/decrypt.sh writing KEY=value into a target file.
source_or_read() {
  local env_file="$SECRETS_DIR/$1.env"
  local txt_file="$SECRETS_DIR/$2"
  if [[ -f "$env_file" ]]; then
    # shellcheck disable=SC1090
    source "$env_file"
  elif [[ -f "$txt_file" ]]; then
    export "$3"="$(tr -d '\r\n' < "$txt_file")"
  else
    echo "ERROR: neither $env_file nor $txt_file found" >&2
    exit 1
  fi
}

source_or_read gemini gemini-api-key.txt GEMINI_API_KEY
source_or_read discord discord-bot-token.txt DISCORD_BOT_TOKEN
source_or_read github github-triage-pat.txt GITHUB_TOKEN
export TRIAGE_DISCORD_CHANNEL_ID="${TRIAGE_DISCORD_CHANNEL_ID:-1489570533103112375}"
export PORT="${PORT:-8080}"

echo "[start-windows] Starting discord-relay..."
exec npm --prefix "$RELAY_DIR" start
