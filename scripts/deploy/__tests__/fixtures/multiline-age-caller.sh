#!/bin/sh
# Fixture: intentionally contains a raw `age -d` split across two physical
# lines via backslash continuation. Used by check-no-raw-age.sh to prove the
# gate detects multiline invocations that would bypass a single-line grep.

age \
  -d secrets/env/myapps-b31ea.env.age
