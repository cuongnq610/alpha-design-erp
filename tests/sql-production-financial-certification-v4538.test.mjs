import assert from 'node:assert/strict';
import fs from 'node:fs';
const sql=fs.readFileSync(new URL('../supabase/migrations/056_production_financial_certification_v4538.sql',import.meta.url),'utf8');
assert.match(sql,/\('4\.5\.38','Production financial certification/);
for(const permission of ['b09.prepare','b09.review','b09.approve','financial_reports.certify'])assert.ok(sql.includes(permission),`missing ${permission}`);
assert.match(sql,/reviewer must differ from preparer/i);
assert.match(sql,/approver must differ from preparer and reviewer/i);
assert.match(sql,/MFA AAL2 required to approve B09/i);
assert.match(sql,/create table if not exists public\.statutory_report_certifications/i);
assert.match(sql,/create or replace function app\.certify_tt133_release/i);
assert.match(sql,/browser and Supabase report hashes differ/i);
assert.match(sql,/create or replace function app\.revoke_statutory_certifications/i);
for(const fn of ['report_b01a_dnn','report_b02_dnn','report_b03_dnn','report_b09_certification','validate_tt133_report_set','certify_tt133_release']){
  assert.match(sql,new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${fn}`,'i'),`missing public RPC wrapper ${fn}`);
}
assert.match(sql,/insert into public\.schema_versions[\s\S]*\('4\.5\.38','Production financial certification/i,'migration 056 must register the Cloud schema version');

assert.match(sql,/\('financial_statutory','BCTC Cloud khớp và B09 đủ ba cấp phê duyệt'/);
assert.match(sql,/B09_WORKFLOW/);
assert.match(sql,/with access as \(select app\.assert_company_access\(app\.current_company_id\(\)\)\)/i,'B09 report wrapper must assert active company membership');
assert.ok(sql.indexOf('Backfill historical rows before installing') < sql.indexOf('create trigger trg_b09_workflow_v4538'),'historical B09 hash backfill must run before the authenticated trigger is installed');
assert.match(sql,/revoke all on function app\.report_b09_certification\(date,date\) from public,anon,authenticated/i,'app B09 implementation must remain private');
assert.match(sql,/p_formula_version<>'ALPHA-FINANCIAL-INTELLIGENCE-4\.3\.8'/,'certification must require the exact formula version');
assert.match(sql,/cash_flow_codes'[\s\S]*companies'/,'certification invalidation must cover shared cash-flow mappings and company fiscal-year settings');
assert.match(sql,/B01_BALANCE',coalesce\(a=s,false\)/,'missing report rows must fail closed');

assert.doesNotMatch(sql,/where status='approved'\s*;\s*$/m,'legacy status-only completeness must not remain');
console.log('PASS v4.5.38 SQL production financial certification guards');
