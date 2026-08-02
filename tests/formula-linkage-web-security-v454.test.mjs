import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const C=require('../calculation-core.js');

const range={from:'2026-01-01',to:'2026-01-31'};
const finance=[
  {id:'paid',date:'2026-01-05',type:'Income',status:'Paid',amount:100},
  {id:'posted',date:'2026-01-06',type:'Income',status:'Posted',amount:200},
  {id:'completed',date:'2026-01-07',type:'Expense',status:'Completed',amount:300},
  {id:'pending',date:'2026-01-08',type:'Expense',status:'Pending',amount:400}
];
assert.equal(C.financePaid(finance[0]),true);
assert.equal(C.financePaid(finance[1]),false,'Posted is an accounting state and must not become cash actual');
assert.equal(C.financePaid(finance[2]),false,'Completed is not evidence of cash settlement');
assert.deepEqual(C.cashFlow({finance},range),{cashIn:100,cashOut:0,net:100});

for(const status of ['Valid','Adjusted','Issued','Posted','Approved','Accepted','Active','Completed','']){
  assert.equal(C.activeInvoice({status}),true,`${status||'blank legacy'} invoice should be recognized`);
}
for(const status of ['Draft','Pending','Review','Replaced','Cancelled','Deleted','Void']){
  assert.equal(C.activeInvoice({status}),false,`${status} invoice must stay outside AR and VAT`);
}

const invoice={id:'invoice-valid',direction:'Output',date:'2026-01-02',dueDate:'2026-01-20',status:'Valid',taxBase:100,vatAmount:10,totalAmount:110};
const invoiceDb={
  taxInvoices:[
    invoice,
    {id:'invoice-draft',direction:'Output',date:'2026-01-02',status:'Draft',taxBase:500,vatAmount:50,totalAmount:550},
    {id:'invoice-replaced',direction:'Output',date:'2026-01-02',status:'Replaced',taxBase:700,vatAmount:70,totalAmount:770}
  ],
  paymentAllocations:[
    {id:'allocation-draft',invoiceId:invoice.id,date:'2026-01-03',status:'Draft',amount:50},
    {id:'allocation-posted',invoiceId:invoice.id,date:'2026-01-04',status:'Posted',amount:20}
  ]
};
assert.equal(C.invoiceAllocatedAmount(invoiceDb,invoice),20,'Draft allocation must not reduce AR');
const aging=C.invoiceAging(invoiceDb,{...range,direction:'Output',asOf:'2026-01-31'});
assert.equal(aging.rows.length,1,'Draft and replaced invoices must not enter aging');
assert.equal(aging.totals.original,110);
assert.equal(aging.totals.outstanding,90);
assert.equal(C.vatRegisterSummary(invoiceDb,range).output,10);

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const cloud=fs.readFileSync(new URL('../cloud-v2.js',import.meta.url),'utf8');
const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const security=fs.readFileSync(new URL('../backend/security.mjs',import.meta.url),'utf8');
const runtime=fs.readFileSync(new URL('../runtime-config.js',import.meta.url),'utf8');
const migration=fs.readFileSync(new URL('../supabase/migrations/034_formula_linkage_web_security_v454.sql',import.meta.url),'utf8');
const migration35=fs.readFileSync(new URL('../supabase/migrations/035_ui_formula_deep_audit_v455.sql',import.meta.url),'utf8');
const migration36=fs.readFileSync(new URL('../supabase/migrations/036_ui_balance_contrast_formula_simulation_v456.sql',import.meta.url),'utf8');
const migration37=fs.readFileSync(new URL('../supabase/migrations/037_ui_ux_workflow_formula_input_v457.sql',import.meta.url),'utf8');
const migration38=fs.readFileSync(new URL('../supabase/migrations/038_compact_kpi_runtime_hardening_v458.sql',import.meta.url),'utf8');
const migration39=fs.readFileSync(new URL('../supabase/migrations/039_full_table_layout_alignment_v459.sql',import.meta.url),'utf8');
const migration40=fs.readFileSync(new URL('../supabase/migrations/040_table_separation_action_usability_v4510.sql',import.meta.url),'utf8');
const migration41=fs.readFileSync(new URL('../supabase/migrations/041_action_edit_collision_fix_v4511.sql',import.meta.url),'utf8');
const migration42=fs.readFileSync(new URL('../supabase/migrations/042_final_ui_formula_linkage_closure_v4512.sql',import.meta.url),'utf8');
const migration43=fs.readFileSync(new URL('../supabase/migrations/043_modal_scroll_action_visibility_v4513.sql',import.meta.url),'utf8');
const migration44=fs.readFileSync(new URL('../supabase/migrations/044_final_release_candidate_v4514.sql',import.meta.url),'utf8');
const migration45=fs.readFileSync(new URL('../supabase/migrations/045_account_protection_mfa_runtime_fix_v4515.sql',import.meta.url),'utf8');
const migration46=fs.readFileSync(new URL('../supabase/migrations/046_release_claim_ui_mobile_security_formula_sql_audit_v4516.sql',import.meta.url),'utf8');
const migration47=fs.readFileSync(new URL('../supabase/migrations/047_accounting_report_table_fit_v4517.sql',import.meta.url),'utf8');
const migration48=fs.readFileSync(new URL('../supabase/migrations/048_tax_integration_typography_formula_linkage_v4518.sql',import.meta.url),'utf8');
const migration49=fs.readFileSync(new URL('../supabase/migrations/049_accessibility_table_fit_truthful_integrations_v4519.sql',import.meta.url),'utf8');
const migration50=fs.readFileSync(new URL('../supabase/migrations/050_global_table_column_action_alignment_v4520.sql',import.meta.url),'utf8');
const migration51=fs.readFileSync(new URL('../supabase/migrations/051_deep_audit_transition_permissions_v4521.sql',import.meta.url),'utf8');
const migration52=fs.readFileSync(new URL('../supabase/migrations/052_qa_closure_release_v4525.sql',import.meta.url),'utf8');
const migration53=fs.readFileSync(new URL('../supabase/migrations/053_effective_dated_tax_qa_portability_v4526.sql',import.meta.url),'utf8');
const migration54=fs.readFileSync(new URL('../supabase/migrations/054_production_invariants_v4527.sql',import.meta.url),'utf8');
const migration55=fs.readFileSync(new URL('../supabase/migrations/055_financial_reporting_integrity_v4536.sql',import.meta.url),'utf8');
const migration56=fs.readFileSync(new URL('../supabase/migrations/056_production_financial_certification_v4538.sql',import.meta.url),'utf8');
const migration57=fs.readFileSync(new URL('../supabase/migrations/057_company_profile_dynamic_reporting_period_v4539.sql',import.meta.url),'utf8');
const migration58=fs.readFileSync(new URL('../supabase/migrations/058_statutory_template_manager_filter_chart_tax_v4540.sql',import.meta.url),'utf8');
const migration59=fs.readFileSync(new URL('../supabase/migrations/059_stability_browser_qa_data_quality_v4541.sql',import.meta.url),'utf8');
const migration60=fs.readFileSync(new URL('../supabase/migrations/060_detailed_employee_payroll_v4542.sql',import.meta.url),'utf8');
const migration61=fs.readFileSync(new URL('../supabase/migrations/061_payroll_header_layout_refinement_v4543.sql',import.meta.url),'utf8');
const migration62=fs.readFileSync(new URL('../supabase/migrations/062_global_table_grid_alignment_v4544.sql',import.meta.url),'utf8');
const migration63=fs.readFileSync(new URL('../supabase/migrations/063_annual_bonus_travel_fund_v4545.sql',import.meta.url),'utf8');
const migration64=fs.readFileSync(new URL('../supabase/migrations/064_sticky_table_workflow_formula_hardened_v4546.sql',import.meta.url),'utf8');
const migration65=fs.readFileSync(new URL('../supabase/migrations/065_accounting_operations_tax_package_update_v4547.sql',import.meta.url),'utf8');
const migration66=fs.readFileSync(new URL('../supabase/migrations/066_responsive_sidebar_table_centering_v4548.sql',import.meta.url),'utf8');
const migration67=fs.readFileSync(new URL('../supabase/migrations/067_table_viewport_formula_linkage_hardened_v4549.sql',import.meta.url),'utf8');
const migration68=fs.readFileSync(new URL('../supabase/migrations/068_enterprise_data_alignment_operational_audit_v4550.sql',import.meta.url),'utf8');
const migration69=fs.readFileSync(new URL('../supabase/migrations/069_accounting_tax_legal_hardening_v4561.sql',import.meta.url),'utf8');
const migration70=fs.readFileSync(new URL('../supabase/migrations/070_vat_payment_evidence_tk242_parity_v4562.sql',import.meta.url),'utf8');
const migration71=fs.readFileSync(new URL('../supabase/migrations/071_table_scroll_continuity_release_v4563.sql',import.meta.url),'utf8');
const migration72=fs.readFileSync(new URL('../supabase/migrations/072_prepaint_table_viewport_release_v4564.sql',import.meta.url),'utf8');
const migration73=fs.readFileSync(new URL('../supabase/migrations/073_full_control_terminology_release_v4565.sql',import.meta.url),'utf8');
const migration74=fs.readFileSync(new URL('../supabase/migrations/074_recycle_bin_restore_v4566.sql',import.meta.url),'utf8');
const schema=fs.readFileSync(new URL('../SUPABASE_PRODUCTION_SCHEMA.sql',import.meta.url),'utf8');

assert.equal(app.includes("x.status!=='Cancelled'"),false,'UI charts must use the shared recognized-invoice predicate');
assert.ok(app.includes('Calc.activeInvoice(x)')&&app.includes('Calc.allocationIsRecognized(db,x'),'UI must share invoice/allocation status rules with calculation core');
assert.ok(index.includes('data-view="security-center"')&&cloud.includes("if(view==='security-center') renderSecurityCenter()"),'Security Center navigation is missing');
for(const marker of ['clearCloudSessionData','SYNC_SESSION_KEY','SESSION_IDLE_TIMEOUT_MS','SESSION_ABSOLUTE_TIMEOUT_MS','privacyShield']){
  assert.ok(cloud.includes(marker),`Clean-session protection is missing ${marker}`);
}
assert.ok(runtime.includes('sessionIdleTimeoutMs: 1800000')&&runtime.includes('sessionAbsoluteTimeoutMs: 28800000'),'Browser session policy defaults are missing');
assert.equal(security.includes('https://*.supabase.co'),false,'CSP must not allow every Supabase project');
for(const header of ['cross-origin-resource-policy','x-dns-prefetch-control','origin-agent-cluster','x-permitted-cross-domain-policies']){
  assert.ok(security.includes(`'${header}'`),`Missing security header ${header}`);
}
for(const marker of ['json_has_unsafe_key','pg_advisory_xact_lock','OVER_ALLOCATION','INVALID_LINK_STATUS','CROSS_PROJECT_REFERENCE',"active_release_version='4.5.4'"]){
  assert.ok(migration.includes(marker),`Migration 034 is missing ${marker}`);
}
assert.ok(schema.includes(migration.trim())&&schema.includes(migration35.trim())&&schema.includes(migration36.trim())&&schema.includes(migration37.trim())&&schema.includes(migration38.trim())&&schema.includes(migration39.trim())&&schema.includes(migration40.trim())&&schema.includes(migration41.trim())&&schema.includes(migration42.trim())&&schema.includes(migration43.trim())&&schema.includes(migration44.trim())&&schema.includes(migration45.trim())&&schema.includes(migration46.trim())&&schema.includes(migration47.trim())&&schema.includes(migration48.trim())&&schema.includes(migration49.trim())&&schema.includes(migration50.trim())&&schema.includes(migration51.trim())&&schema.includes(migration52.trim())&&schema.includes(migration53.trim())&&schema.includes(migration54.trim())&&schema.includes(migration55.trim())&&schema.includes(migration56.trim())&&schema.includes(migration57.trim())&&schema.includes(migration58.trim())&&schema.includes(migration59.trim())&&schema.includes(migration60.trim())&&schema.includes(migration61.trim())&&schema.includes(migration62.trim())&&schema.includes(migration63.trim())&&schema.includes(migration64.trim())&&schema.includes(migration65.trim())&&schema.includes(migration66.trim())&&schema.includes(migration67.trim())&&schema.includes(migration68.trim())&&schema.includes(migration69.trim())&&schema.includes(migration70.trim())&&schema.includes(migration71.trim())&&schema.includes(migration72.trim())&&schema.includes(migration73.trim())&&schema.includes(migration74.trim())&&schema.includes('SOURCE: 075_deep_qa_autoheal_v4567.sql'),'Consolidated schema must preserve migrations 034-073 and include migration 074 before current migration 075');

console.log('PASS v4.5.4 strict status formulas, atomic linkage caps and clean-session web security');
