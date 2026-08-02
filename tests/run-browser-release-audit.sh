#!/usr/bin/env bash
set -uo pipefail
export PYTHONDONTWRITEBYTECODE=1
cd "$(dirname "$0")/.."
VERSION="$(node scripts/release-version.mjs)"
TAG="v${VERSION//./}"
if ! python3 scripts/browser_qa_preflight.py; then
  printf 'Cài công cụ QA bằng `python3 -m pip install -r requirements-qa.txt` và `python3 -m playwright install chromium`, rồi chạy lại.\n' >&2
  exit 2
fi
LOCK_DIR="/tmp/alpha-design-erp-browser-audit-${TAG}.lock"
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  printf 'Browser audit v%s is already running; refusing concurrent evidence writes.\n' "$VERSION" >&2
  exit 2
fi
trap 'rm -rf "$LOCK_DIR"' EXIT
RESULTS="quality/final-${TAG}/results"
mkdir -p "$RESULTS"
STATUS_FILE="$RESULTS/browser-audit-steps.tsv"
: > "$STATUS_FILE"
FAILURES=0

run_step(){
  local script="$1" timeout_seconds="${2:-180}"
  local name="${script##*/}"; name="${name%.*}"
  local log="$RESULTS/${name}.txt"
  printf '\n=== %s ===\n' "$script"
  timeout --signal=TERM --kill-after=10s "${timeout_seconds}s" python3 "$script" 2>&1 | tee "$log"
  local code=${PIPESTATUS[0]}
  if [[ $code -eq 0 ]]; then
    printf '%s\tPASS\t%s\n' "$script" "$code" >> "$STATUS_FILE"
  else
    printf '%s\tFAIL\t%s\n' "$script" "$code" >> "$STATUS_FILE"
    FAILURES=$((FAILURES+1))
  fi
}

run_step scripts/static-security-audit.py 600
run_step scripts/auth-security-browser-audit-v4515.py 600
run_step scripts/ui-structural-browser-audit-v4525.py 600
run_step scripts/focused-global-table-columns-v4525.py 600
run_step scripts/focused-journal-tax-columns-v4522.py 600
run_step scripts/accessibility-integration-browser-audit-v4519.py 600
run_step scripts/mobile-more-security-browser-audit-v4516.py 600
run_step scripts/focused-accounting-report-layout-v4517.py 600
run_step scripts/focused-tax-integration-typography-v4518.py 600
run_step scripts/ui-modal-scroll-browser-audit-v4515.py 600
run_step scripts/input-workflow-browser-audit-v4515.py 600
run_step scripts/production-invariants-browser-v4527.py 600
run_step scripts/offline-browser-audit.py 600
run_step scripts/xss-browser-audit.py 600
run_step scripts/responsive-browser-audit.py 600
run_step scripts/interaction-smoke-v4521.py 600
run_step scripts/tt99-export-activation-browser-audit-v4560.py 600
run_step scripts/export-center-browser-audit-v4560.py 600

RELEASE_VERSION="$VERSION" STATUS_FILE="$STATUS_FILE" RESULTS="$RESULTS" EXPECTED_STEPS=18 python3 - <<'PY'
import json, os
from pathlib import Path
status_file=Path(os.environ['STATUS_FILE'])
rows=[]
for line in status_file.read_text(encoding='utf-8').splitlines():
    script,status,code=line.split('\t')
    rows.append({'script':script,'status':status,'exitCode':int(code)})
expected=int(os.environ['EXPECTED_STEPS'])
names=[x['script'] for x in rows]
duplicates=sorted({name for name in names if names.count(name)>1})
summary={
  'releaseVersion':os.environ['RELEASE_VERSION'],
  'expectedSteps':expected,
  'steps':rows,
  'passedSteps':sum(x['status']=='PASS' for x in rows),
  'failedSteps':sum(x['status']!='PASS' for x in rows),
  'duplicateScripts':duplicates,
  'reportIntegrity':len(rows)==expected and not duplicates,
  'passed':len(rows)==expected and not duplicates and all(x['status']=='PASS' for x in rows),
  'policy':'Each browser step has a hard timeout, continues after failures, and preserves its stdout/stderr evidence.'
}
(Path(os.environ['RESULTS'])/'browser-release-audit-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(summary,ensure_ascii=False,indent=2))
raise SystemExit(0 if summary['passed'] else 1)
PY
SUMMARY_CODE=$?
if [[ $SUMMARY_CODE -ne 0 && $FAILURES -eq 0 ]]; then FAILURES=1; fi

if [[ $FAILURES -ne 0 ]]; then
  printf '\nV%s BROWSER RELEASE AUDIT FAILED: %s STEP(S)\n' "$VERSION" "$FAILURES" >&2
  exit 1
fi
printf '\nALL V%s DEEP BROWSER, ACCESSIBILITY, OFFLINE AND SECURITY AUDITS PASSED\n' "$VERSION"
