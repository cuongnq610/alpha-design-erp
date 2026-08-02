import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');

const app=read('app.js');
const sync=read('alpha-sync.bundle.js');
const guard=read('production-guard.js');
const migration=read('supabase/migrations/032_deep_security_offline_sync_v452.sql');
const migration33=read('supabase/migrations/033_entity_payload_integrity_v453.sql');
const migration34=read('supabase/migrations/034_formula_linkage_web_security_v454.sql');
const migration06=read('supabase/migrations/006_tt133_complete_reports.sql');
const migration55=read('supabase/migrations/055_financial_reporting_integrity_v4536.sql');
const migration60=read('supabase/migrations/060_detailed_employee_payroll_v4542.sql');
const migration63=read('supabase/migrations/063_annual_bonus_travel_fund_v4545.sql');
const migration74=read('supabase/migrations/074_recycle_bin_restore_v4566.sql');
const schema=read('SUPABASE_PRODUCTION_SCHEMA.sql');

const modelMatch=app.match(/\['people','clients','vendors','accounts','projects'.+?'trashEntries'\]/);
assert.ok(modelMatch,'Cannot locate the authoritative browser collection model');
const model=[...modelMatch[0].matchAll(/'([^']+)'/g)].map(x=>x[1]);
const syncMatch=sync.match(/s=\[("people".+?"trashEntries")\],n=\[("settings","notificationReads")\]/);
assert.ok(syncMatch,'Cloud sync collection/singleton declarations are missing');
const syncCollections=[...syncMatch[1].matchAll(/"([^"]+)"/g)].map(x=>x[1]);
const syncSingletons=[...syncMatch[2].matchAll(/"([^"]+)"/g)].map(x=>x[1]);
const expectedCollections=model.filter(x=>!['notificationReads','reportNotesTT133','reportNotesTT99','statutoryReportTemplates','taxCompliancePackages'].includes(x));
assert.deepEqual(syncCollections,expectedCollections,'Every array collection in app.js must be synchronized to entity_records');
assert.deepEqual(syncSingletons,['settings','notificationReads'],'Settings and notification read-state must be synchronized as singleton records');
assert.equal(syncCollections.includes('reportNotesTT133'),false,'TT133 B09 notes use the dedicated report_notes_tt133 table, not generic entity_records');
assert.equal(syncCollections.includes('reportNotesTT99'),false,'TT99 B09 notes remain outside generic entity_records until a dedicated TT99 Cloud certification contract is deployed');
assert.equal(syncCollections.includes('statutoryReportTemplates'),false,'Statutory templates use the dedicated statutory_report_templates table, not generic entity_records');
assert.equal(syncCollections.includes('taxCompliancePackages'),false,'Tax compliance packages use the dedicated tax_compliance_packages table, not generic entity_records');
assert.ok(app.includes("from('tax_compliance_packages')")&&app.includes('activate_tax_compliance_package'),'Dedicated tax compliance package Cloud persistence is missing');
assert.ok(app.includes('persistStatutoryTemplateCloud')&&app.includes('loadStatutoryTemplatesCloud')&&app.includes('activateStatutoryTemplateCloud'),'Dedicated statutory template Cloud persistence is missing');
assert.ok(migration06.includes('report_notes_tt133')&&migration55.includes('B09_COMPLETENESS')&&app.includes('persistReportNoteCloud'),'Dedicated B09 cloud persistence is missing');
assert.equal(new Set(syncCollections).size,syncCollections.length,'Duplicate Cloud collection mapping');

for(const name of [...syncCollections,...syncSingletons]){
  assert.ok(migration.includes(`'${name}'`)||migration60.includes(`'${name}'`)||migration63.includes(`'${name}'`)||migration74.includes(`'${name}'`)||name==='settings',`Permission mapping missing for ${name}`);
}
for(const name of ['purchaseRequests','purchaseOrders','tools','fixedAssets','toolAllocationSchedules','depreciationSchedules']){
  assert.ok(migration.includes(name)&&migration.includes('procurement.write'),`Procurement mapping missing for ${name}`);
}
for(const name of ['financialForecastScenarios','financialAnalysisSnapshots','financialLinkAuditRuns']){
  assert.ok(migration.includes(name)&&migration.includes('financial_analytics.write'),`Financial analytics mapping missing for ${name}`);
}
assert.ok(schema.includes('SOURCE: 032_deep_security_offline_sync_v452.sql'),'Consolidated schema must include migration 032');
assert.ok(schema.includes("('4.5.2','Deep security and offline audit"),'Consolidated schema must retain the historical v4.5.2 marker');
assert.ok(schema.includes('SOURCE: 033_entity_payload_integrity_v453.sql'),'Consolidated schema must include migration 033');
assert.ok(schema.includes("('4.5.3','Integrity and security hardening"),'Consolidated schema must carry the v4.5.3 schema marker');
assert.ok(schema.includes('SOURCE: 034_formula_linkage_web_security_v454.sql'),'Consolidated schema must include migration 034');
assert.ok(schema.includes("('4.5.4','Formula and linkage security hardening"),'Consolidated schema must carry the v4.5.4 schema marker');
for(const required of ['validate_entity_payload','entity_record_guard','PAYLOAD_TOO_LARGE','INVALID_REFERENCE'])assert.ok(migration33.includes(required),`Migration 033 is missing ${required}`);
assert.ok(migration33.includes("notificationReads payload must be a JSON array"),'Cloud singleton RPC must accept notificationReads arrays');
assert.ok(migration33.includes('revoke insert,update,delete on public.entity_records from authenticated'),'Cloud writes must be RPC-only to preserve row-version conflict handling');
assert.ok(migration34.includes('OVER_ALLOCATION')&&migration34.includes('pg_advisory_xact_lock'),'Cross-module allocation caps must be atomic at database level');
assert.ok(migration.includes("'release.approve'"),'Release approval must be treated as an MFA-privileged permission');
for(const permission of ['accounting.period.lock','users.manage','roles.manage','reports.import','backup.restore','security.manage','release.approve']){
  assert.ok(migration.includes(`app.permission_is_privileged(rp.permission_code)`)&&migration.includes(`app.permission_is_privileged(p.code)`),`Privileged permission lookup must cover direct role arrays and role_permissions rows (${permission})`);
}
assert.ok(schema.includes('Keep the database MFA boundary aligned'),'Consolidated schema must include the v4.5.3 MFA privilege alignment patch');

assert.ok(guard.includes("navigator.onLine!==false&&syncStatus.status==='online'"),'Production write guard must check real browser connectivity and Cloud sync status');
assert.ok(guard.includes('Mất kết nối máy chủ; hệ thống đang ở chế độ chỉ đọc'),'Offline reason must explicitly describe read-only behavior');
assert.ok(guard.includes('networkFailure')&&guard.includes('return context'),'A transient network failure must preserve the last verified in-memory context while writes remain blocked');
assert.ok(sync.includes('h\\u1EC7 th\\u1ED1ng chuy\\u1EC3n sang ch\\u1EC9 \\u0111\\u1ECDc'),'Sync UI must not claim changes are queued when production offline writes are disabled');
assert.ok(sync.includes('allowOfflineWritesInProduction===true'),'Offline queue wording must only appear when explicitly enabled');

console.log(`PASS v4.5.4 Cloud sync covers ${syncCollections.length} collections + ${syncSingletons.length} singletons; offline writes and allocation races are fail-closed`);
