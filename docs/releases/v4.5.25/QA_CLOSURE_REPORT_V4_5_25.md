# QA Closure Report — ALPHA DESIGN ERP Cloud v4.5.25

**Audit date:** 2026-07-28  
**Release:** 4.5.25  
**Migration:** 052  
**Decision:** Staging/UAT approved; Production not yet approved.

## Defect closure

| ID | Severity | Result | Closure evidence |
|---|---:|---|---|
| QA-001 | High | Closed | Browser runner has per-step timeout, preserved logs, deterministic cleanup, concurrency lock and 15-step integrity check. Clean run PASS 15/15. |
| QA-002 | High | Closed | Runtime, backend, exports, verification scripts, evidence paths and migration marker use current release metadata. |
| QA-003 | High | Closed | XLSX dates use Excel serial values; percent points are normalized before `%` formatting. Regression PASS. |
| QA-004 | Medium | Closed | PDF/ZIP/legal export labels use dynamic release version. |
| QA-005 | Medium | Closed | Structural/global audits log in through Demo and verify the unlocked app shell before measurement. |
| QA-006 | External gate | Open | Requires real Supabase, RLS, MFA, SMTP, backup/restore, physical devices and accounting reconciliation. Not reproducible or closable from the source package alone. |

## Automated results

- Core/release suite: PASS.
- 571,257 formula/money/adversarial scenario executions: PASS.
- Browser runner: 15/15 PASS; no duplicates; report integrity PASS.
- Structural UI: 364/364 PASS.
- Global tables: 208/208 PASS.
- Input workflow: 30/30 PASS.
- Modal scroll: 24/24 PASS.
- Responsive: 6 certified widths PASS.
- Offline and XSS: PASS.
- Migration chain: 001–052, lexical PASS.

## Final assessment

All defects that were reproducible inside the supplied source package have been corrected and covered by regression tests. Production approval remains intentionally false until the external Staging/UAT gates are completed and independently signed off.
