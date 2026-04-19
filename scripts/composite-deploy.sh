#!/usr/bin/env bash
# DEPRECATED: kept for .github/workflows/{release,preview}.yml; superseded by scripts/deploy/*.sh per plans/in-progress/2026-04-17-deployment-pipeline.md §4.
# Assembles all app dists into a single deploy/ directory for Firebase Hosting.
# Run from the repo root: bash scripts/composite-deploy.sh
set -euo pipefail

DEPLOY_DIR="deploy"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Assembling composite deploy directory..."
rm -rf "$ROOT_DIR/$DEPLOY_DIR"
mkdir -p "$ROOT_DIR/$DEPLOY_DIR"

# Portal at root (prefer apps/portal, fall back to apps/darkstrawberry-apps for transition period)
if [ -d "$ROOT_DIR/apps/portal/dist" ]; then
  echo "  Copying portal (apps/portal/dist) -> $DEPLOY_DIR/"
  cp -r "$ROOT_DIR/apps/portal/dist/." "$ROOT_DIR/$DEPLOY_DIR/"
elif [ -d "$ROOT_DIR/apps/darkstrawberry-apps/dist" ]; then
  echo "  Copying portal (apps/darkstrawberry-apps/dist) -> $DEPLOY_DIR/ [transition]"
  cp -r "$ROOT_DIR/apps/darkstrawberry-apps/dist/." "$ROOT_DIR/$DEPLOY_DIR/"
else
  echo "ERROR: No portal dist found (apps/portal/dist or apps/darkstrawberry-apps/dist)" >&2
  exit 1
fi

# myApps — each standalone app under /myApps/{slug}/
# Support both apps/darkstrawberry-apps/myApps/ (canonical) and apps/myApps/ (legacy)
MYAPPS_DIR=""
if [ -d "$ROOT_DIR/apps/darkstrawberry-apps/myApps" ]; then
  MYAPPS_DIR="$ROOT_DIR/apps/darkstrawberry-apps/myApps"
elif [ -d "$ROOT_DIR/apps/myApps" ]; then
  MYAPPS_DIR="$ROOT_DIR/apps/myApps"
fi
if [ -n "$MYAPPS_DIR" ]; then
  for app_dir in "$MYAPPS_DIR/"/*/; do
    [ -d "$app_dir" ] || continue
    SLUG=$(basename "$app_dir")
    if [ -d "$app_dir/dist" ]; then
      echo "  Copying myApps/$SLUG -> $DEPLOY_DIR/myApps/$SLUG/"
      mkdir -p "$ROOT_DIR/$DEPLOY_DIR/myApps/$SLUG"
      cp -r "$app_dir/dist/." "$ROOT_DIR/$DEPLOY_DIR/myApps/$SLUG/"
    else
      echo "  WARNING: $app_dir has no dist/ — skipping (run build first)" >&2
    fi
  done
fi

# yourApps — each app under /yourApps/{slug}/
# Support both apps/darkstrawberry-apps/yourApps/ (canonical) and apps/yourApps/ (legacy)
YOURAPPS_DIR=""
if [ -d "$ROOT_DIR/apps/darkstrawberry-apps/yourApps" ]; then
  YOURAPPS_DIR="$ROOT_DIR/apps/darkstrawberry-apps/yourApps"
elif [ -d "$ROOT_DIR/apps/yourApps" ]; then
  YOURAPPS_DIR="$ROOT_DIR/apps/yourApps"
fi
if [ -n "$YOURAPPS_DIR" ]; then
  for app_dir in "$YOURAPPS_DIR/"/*/; do
    [ -d "$app_dir" ] || continue
    SLUG=$(basename "$app_dir")
    if [ -d "$app_dir/dist" ]; then
      echo "  Copying yourApps/$SLUG -> $DEPLOY_DIR/yourApps/$SLUG/"
      mkdir -p "$ROOT_DIR/$DEPLOY_DIR/yourApps/$SLUG"
      cp -r "$app_dir/dist/." "$ROOT_DIR/$DEPLOY_DIR/yourApps/$SLUG/"
    else
      echo "  WARNING: $app_dir has no dist/ — skipping (run build first)" >&2
    fi
  done
fi

echo "Done. Deploy directory assembled at: $ROOT_DIR/$DEPLOY_DIR"
echo "To deploy: npx firebase-tools deploy --only hosting --project myapps-b31ea"
