#!/usr/bin/env bash
set -uo pipefail
export PYTHONDONTWRITEBYTECODE=1
cd "$(dirname "$0")/.."
VERSION="$(node scripts/release-version.mjs)"
TAG="v${VERSION//./}"
python3 scripts/browser_qa_preflight.py || exit 2
RESULTS="quality/final-${TAG}/extended-results"
mkdir -p "$RESULTS"
STATUS_FILE="$RESULTS/extended-browser-steps.tsv"
: > "$STATUS_FILE"
FAILURES=0

run_step(){
  local script="$1" name="${1##*/}" code
  name="${name%.*}"
  printf '\n=== %s ===\n' "$script"
  timeout --signal=TERM --kill-after=10s 600s python3 "$script" 2>&1 | tee "$RESULTS/${name}.txt"
  code=${PIPESTATUS[0]}
  if [[ $code -eq 0 ]]; then
    printf '%s\tPASS\t%s\n' "$script" "$code" >> "$STATUS_FILE"
  else
    printf '%s\tFAIL\t%s\n' "$script" "$code" >> "$STATUS_FILE"
    FAILURES=$((FAILURES+1))
  fi
}

run_step scripts/annual-benefits-browser-audit-v4545.py
run_step scripts/clear-charts-tax-calendar-browser-audit-v4553.py
run_step scripts/end-to-end-input-accounting-browser-audit-v4554.py
run_step scripts/enterprise-data-alignment-browser-audit-v4550.py
run_step scripts/global-column-centering-browser-audit-v4551.py
run_step scripts/payroll-header-layout-browser-audit-v4543.py
run_step scripts/responsive-sidebar-table-centering-browser-v4548.py
run_step scripts/sticky-table-workflow-browser-audit-v4546.py
run_step scripts/table-viewport-browser-audit-v4549.py
run_step scripts/ui-tax-accounting-refinement-browser-audit-v4555.py
run_step scripts/version-final-workflow-browser-audit-v4556.py

if [[ $FAILURES -ne 0 ]]; then
  printf '\nV%s EXTENDED BROWSER REGRESSION FAILED: %s STEP(S)\n' "$VERSION" "$FAILURES" >&2
  exit 1
fi
printf '\nALL V%s EXTENDED BROWSER REGRESSIONS PASSED\n' "$VERSION"
