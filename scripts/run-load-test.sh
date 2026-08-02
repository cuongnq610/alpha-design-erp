#!/usr/bin/env bash
set -euo pipefail
command -v k6 >/dev/null || { echo 'Install k6 before running the database load test.'; exit 1; }
: "${SUPABASE_URL:?Set SUPABASE_URL}"
: "${SUPABASE_PUBLISHABLE_KEY:=${SUPABASE_ANON_KEY:-}}"
: "${SUPABASE_PUBLISHABLE_KEY:?Set SUPABASE_PUBLISHABLE_KEY or SUPABASE_ANON_KEY}"
export SUPABASE_ANON_KEY="$SUPABASE_PUBLISHABLE_KEY"
: "${ACCESS_TOKEN:?Set ACCESS_TOKEN}"
k6 run tests/load/k6-read-reports.js
printf 'READ_LOAD_TEST_DONE\n'
