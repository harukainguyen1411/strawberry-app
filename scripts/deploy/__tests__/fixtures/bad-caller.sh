#!/bin/sh
# Fixture: intentionally contains a bare `firebase deploy` without --only.
# Used by check-no-bare-deploy.sh to prove the gate detects violations
# before any real caller exists under scripts/deploy/.

firebase deploy --project myapps-b31ea
