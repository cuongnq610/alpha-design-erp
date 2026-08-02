import assert from 'node:assert/strict';
import fs from 'node:fs';
const app=fs.readFileSync('app.js','utf8');
const migration=fs.readFileSync('supabase/migrations/051_deep_audit_transition_permissions_v4521.sql','utf8');
const migration52=fs.readFileSync('supabase/migrations/052_qa_closure_release_v4525.sql','utf8');
const migration53=fs.readFileSync('supabase/migrations/053_effective_dated_tax_qa_portability_v4526.sql','utf8');
const migration54=fs.readFileSync('supabase/migrations/054_production_invariants_v4527.sql','utf8');
const migration55=fs.readFileSync('supabase/migrations/055_financial_reporting_integrity_v4536.sql','utf8');
const migration56=fs.readFileSync('supabase/migrations/056_production_financial_certification_v4538.sql','utf8');
const migration57=fs.readFileSync('supabase/migrations/057_company_profile_dynamic_reporting_period_v4539.sql','utf8');
const migration58=fs.readFileSync('supabase/migrations/058_statutory_template_manager_filter_chart_tax_v4540.sql','utf8');
const migration59=fs.readFileSync('supabase/migrations/059_stability_browser_qa_data_quality_v4541.sql','utf8');
const migration60=fs.readFileSync('supabase/migrations/060_detailed_employee_payroll_v4542.sql','utf8');
const migration61=fs.readFileSync('supabase/migrations/061_payroll_header_layout_refinement_v4543.sql','utf8');
const migration62=fs.readFileSync('supabase/migrations/062_global_table_grid_alignment_v4544.sql','utf8');
const migration63=fs.readFileSync('supabase/migrations/063_annual_bonus_travel_fund_v4545.sql','utf8');
const migration64=fs.readFileSync('supabase/migrations/064_sticky_table_workflow_formula_hardened_v4546.sql','utf8');
const migration65=fs.readFileSync('supabase/migrations/065_accounting_operations_tax_package_update_v4547.sql','utf8');
const migration66=fs.readFileSync('supabase/migrations/066_responsive_sidebar_table_centering_v4548.sql','utf8');
const migration67=fs.readFileSync('supabase/migrations/067_table_viewport_formula_linkage_hardened_v4549.sql','utf8');
const migration68=fs.readFileSync('supabase/migrations/068_enterprise_data_alignment_operational_audit_v4550.sql','utf8');
const migration69=fs.readFileSync('supabase/migrations/069_accounting_tax_legal_hardening_v4561.sql','utf8');
const migration70=fs.readFileSync('supabase/migrations/070_vat_payment_evidence_tk242_parity_v4562.sql','utf8');
const migration71=fs.readFileSync('supabase/migrations/071_table_scroll_continuity_release_v4563.sql','utf8');
const migration72=fs.readFileSync('supabase/migrations/072_prepaint_table_viewport_release_v4564.sql','utf8');
const migration73=fs.readFileSync('supabase/migrations/073_full_control_terminology_release_v4565.sql','utf8');
const migration74=fs.readFileSync('supabase/migrations/074_recycle_bin_restore_v4566.sql','utf8');
const schema=fs.readFileSync('SUPABASE_PRODUCTION_SCHEMA.sql','utf8');
for(const marker of [
  "requirePrivilegedAction(['accounting.post']",
  "requirePrivilegedAction(['accounting.close','accounting.period.lock']",
  "requirePrivilegedAction(['timesheet.approve']",
  "requirePrivilegedAction(['procurement.approve']",
  "unlockReason=reason",
  "lập chứng từ điều chỉnh hoặc chứng từ đảo"
]) assert.ok(app.includes(marker),`Missing browser control: ${marker}`);
assert.ok(app.includes("globalThis.crypto?.randomUUID?.()"),'Browser IDs must prefer crypto.randomUUID');
for(const marker of [
  "p_collection='accountingPeriods'",
  "then case when p_write then 'accounting.close'",
  'POSTED_JOURNAL_IMMUTABLE',
  'ACCOUNTING_POST_PERMISSION_REQUIRED',
  'MFA_AAL2_REQUIRED_FOR_ACCOUNTING_POST',
  'ACCOUNTING_PERIOD_UNLOCK_REASON_REQUIRED',
  'TIMESHEET_APPROVE_PERMISSION_REQUIRED',
  'PROCUREMENT_APPROVE_PERMISSION_REQUIRED',
  'perform app.assert_entity_transition_permission'
]) assert.ok(migration.includes(marker),`Missing DB transition guard: ${marker}`);
assert.ok(schema.includes('SOURCE: 051_deep_audit_transition_permissions_v4521.sql'),'Consolidated schema must include migration 051');
assert.ok(schema.includes(migration.trim()),'Consolidated schema must retain exact migration 051 source');
assert.ok(schema.includes(migration52.trim())&&schema.includes(migration53.trim())&&schema.includes(migration54.trim())&&schema.includes(migration55.trim())&&schema.includes(migration56.trim())&&schema.includes(migration57.trim())&&schema.includes(migration58.trim())&&schema.includes(migration59.trim())&&schema.includes(migration60.trim())&&schema.includes(migration61.trim())&&schema.includes(migration62.trim())&&schema.includes(migration63.trim())&&schema.includes(migration64.trim())&&schema.includes(migration65.trim())&&schema.includes(migration66.trim())&&schema.includes(migration67.trim())&&schema.includes(migration68.trim())&&schema.includes(migration69.trim())&&schema.includes(migration70.trim())&&schema.includes(migration71.trim())&&schema.includes(migration72.trim())&&schema.includes(migration73.trim())&&schema.includes(migration74.trim())&&schema.includes('SOURCE: 075_deep_qa_autoheal_v4567.sql'),'Consolidated schema must preserve migrations 052-073 and include migration 074 before current migration 075');
console.log('PASS v4.5.21 transition-specific authorization, immutable Posted journals and auditable period controls');
