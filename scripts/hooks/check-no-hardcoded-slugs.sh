#!/usr/bin/env bash
# check-no-hardcoded-slugs.sh — pre-commit regression guard
#
# Greps staged (or all, when run standalone) source files for literal repo slugs:
#   - harukainguyen1411/strawberry (bare — without the -app suffix; -app is the correct slug)
#   - Duongntd/strawberry
#
# Fails with exit 1 if any hit is found outside the paths listed in
# scripts/hooks/slug-allowlist.txt.
#
# Usage:
#   ./scripts/hooks/check-no-hardcoded-slugs.sh          # standalone — scans working tree
#   Called automatically by the strawberry-managed pre-commit dispatcher.
#
# To add an exemption, append to scripts/hooks/slug-allowlist.txt with a
# rationale comment on the preceding line.

set -e

REPO_ROOT="$(git rev-parse --show-toplevel)"
ALLOWLIST="$REPO_ROOT/scripts/hooks/slug-allowlist.txt"

# Note: harukainguyen1411/strawberry([^-]|$) catches the bare slug (missing -app suffix)
# without false-positive-matching the correct slug harukainguyen1411/strawberry-app.
PATTERNS="harukainguyen1411/strawberry([^-]|$)|Duongntd/strawberry"

SCAN_EXTENSIONS="-e .ts -e .tsx -e .js -e .yml -e .yaml -e .sh"

# Build grep --include flags for each extension
INCLUDE_FLAGS=""
for ext in "*.ts" "*.tsx" "*.js" "*.yml" "*.yaml" "*.sh"; do
  INCLUDE_FLAGS="$INCLUDE_FLAGS --include=$ext"
done

# Read allowlist into a newline-separated string (strip comments and blanks)
allowed_paths=""
if [ -f "$ALLOWLIST" ]; then
  allowed_paths="$(grep -v '^#' "$ALLOWLIST" | grep -v '^[[:space:]]*$')"
fi

# Check if a path matches any allowlist entry (supports trailing glob **)
path_is_allowed() {
  local file_rel="$1"
  while IFS= read -r pattern; do
    [ -z "$pattern" ] && continue
    # Exact match
    if [ "$file_rel" = "$pattern" ]; then
      return 0
    fi
    # Trailing /** glob — match any file under that directory prefix
    case "$pattern" in
      *"/**")
        dir_prefix="${pattern%/**}"
        case "$file_rel" in
          "$dir_prefix/"*) return 0 ;;
        esac
        ;;
    esac
  done <<EOF
$allowed_paths
EOF
  return 1
}

# Run the grep; capture output
# Use grep -rn to get filename:linenum:content triples.
# We intentionally suppress grep's own exit-1-on-no-match with || true.
raw_hits=""
raw_hits="$(cd "$REPO_ROOT" && grep -rEn "$PATTERNS" $INCLUDE_FLAGS . 2>/dev/null | sed 's|^\./||')" || true

if [ -z "$raw_hits" ]; then
  exit 0
fi

found_violations=0
violations=""

while IFS= read -r line; do
  [ -z "$line" ] && continue
  # line format: path/to/file.ts:42:content...
  file_rel="${line%%:*}"
  if ! path_is_allowed "$file_rel"; then
    violations="${violations}  $line\n"
    found_violations=1
  fi
done <<EOF
$raw_hits
EOF

if [ "$found_violations" -eq 1 ]; then
  printf '\n[check-no-hardcoded-slugs] FAIL: hardcoded repo slug found outside allowlist.\n'
  printf 'Violations:\n'
  printf '%b' "$violations"
  printf '\nTo fix: parametrize the slug (read from GITHUB_REPOSITORY env var) or\n'
  printf 'add the path to scripts/hooks/slug-allowlist.txt with a rationale comment.\n\n'
  exit 1
fi

exit 0
