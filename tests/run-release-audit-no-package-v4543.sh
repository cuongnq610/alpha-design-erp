#!/usr/bin/env bash
set -euo pipefail
export PYTHONDONTWRITEBYTECODE=1
cd "$(dirname "$0")/.."
find . -type d -name __pycache__ -prune -exec rm -rf {} +
find . -type f -name "*.pyc" -delete
node scripts/build-public.mjs
node --check app.js
node --check calculation-core.js
node --check statutory-template-manager.js
node --check payroll-detail.js
node --check export-center.js
node --check cloud-v2.js
node --check auth-security.js
node libraries/check-libraries.mjs
node tests/calculation-core.test.js
node tests/reporting-period-company-profile-v4539.test.js
node tests/statutory-template-filter-chart-tax-v4540.test.mjs
node tests/stability-browser-data-quality-v4541.test.mjs
node tests/detailed-payroll-v4542.test.mjs
node tests/ui-detailed-payroll-v4542.test.mjs
node tests/sql-detailed-payroll-v4542.test.mjs
node tests/ui-payroll-header-layout-v4543.test.mjs
node tests/sql-payroll-header-layout-v4543.test.mjs
node tests/sql-template-manager-v4540.test.mjs
node tests/sql-stability-browser-data-quality-v4541.test.mjs
node tests/sql-release-profile-period-v4539.test.mjs
node tests/financial-reporting-integrity-v4536.test.js
node tests/sql-financial-reporting-integrity-v4536.test.mjs
node tests/production-financial-certification-v4538.test.js
node tests/sql-production-financial-certification-v4538.test.mjs
node tests/ui-production-financial-certification-v4538.test.mjs
node tests/production-invariants-v4527.test.js
node tests/production-invariants-v4527-static.test.mjs
node tests/pwa-cache-isolation-v4529.test.mjs
node tests/effective-dated-tax-policy-v4526.test.js
node tests/multi-scenario-business-formula-v4529.test.js
node tests/adversarial-complex-calculation-v4531.test.js
node tests/adversarial-complex-randomized-v4531.test.js
node tests/enterprise-load-demo-v4532.test.js
node tests/vnd-rounding-edge-v4516.test.js
node tests/vnd-safe-boundary-v4523.test.js
node tests/project-controls.test.js
node tests/project-controls-fuzz.test.js
node tests/golden-dataset.test.js
node tests/procurement-asset.test.js
node tests/financial-analytics.test.js
node tests/contract-linkage.test.js
node tests/dashboard-formula-linkage.test.js
node tests/long-term-core.test.js
node tests/stress/calculation-stress.test.js
node tests/deep-audit-regression.test.js
node tests/integrity-linkage-hardening.test.js
node tests/formula-linkage-web-security-v454.test.mjs
node tests/ui-formula-deep-audit-v455.test.mjs
node tests/ui-balance-contrast-v456.test.mjs
node tests/formula-simulation-v456.test.js
node tests/final-randomized-release-v4515.test.js
node tests/final-money-linkage-v4518.test.js
node tests/adversarial-money-security-v4521.test.js
node tests/input-workflow-formula-v457.test.js
node tests/input-workflow-ui-v457.test.mjs
node tests/ui-compact-kpi-runtime-v458.test.mjs
node tests/ui-full-table-layout-v459.test.mjs
node tests/ui-table-separation-action-v4510.test.mjs
node tests/ui-action-collision-v4511.test.mjs
node tests/ui-final-closure-v4512.test.mjs
node tests/ui-modal-scroll-v4515.test.mjs
node tests/ui-accounting-report-fit-v4517.test.mjs
node tests/ui-commented-fixes-v4533.test.mjs
node tests/ui-table-filter-layout-v4535.test.mjs
node tests/ui-tax-integration-typography-v4518.test.mjs
node tests/ui-accessibility-table-fit-v4519.test.mjs
node tests/ui-global-table-columns-v4520.test.mjs
node tests/ui-responsive-sidebar-table-centering-v4548.test.mjs
node tests/ui-journal-tax-columns-v4522.test.mjs
node tests/ui-commercial-control-columns-v4525.test.mjs
node tests/no-silent-mutation-security.test.mjs
node tests/server-entity-integrity-static.test.mjs
node tests/accounting-transition-security-v4521.test.mjs
node tests/uid-security-v4521.test.mjs
node tests/schema-build-integrity-v4521.test.mjs
node tests/sql-lexical-integrity.test.mjs
node tests/server-payload-demo-compatibility.test.mjs
node tests/sync-offline-security-coverage.test.mjs
node tests/csv-upload-security.test.mjs
node tests/export-xlsx-semantics-v4525.test.mjs
node tests/notification-ui-static.test.mjs
node tests/auth-security-static.test.mjs
node tests/auth-security-flow.test.mjs
node tests/backend-mfa-fail-closed-v4516.test.mjs
node tests/supabase-key-headers.test.mjs
node tests/proxy-rate-limit-security.test.mjs
node tests/deploy-preflight-strict.test.mjs
node tests/responsive-layout-static.test.mjs
node tests/backend-smoke.test.mjs
VERSION=$(node scripts/release-version.mjs)
printf '\nALL V%s RELEASE AUDIT TESTS PASSED\n' "$VERSION"
