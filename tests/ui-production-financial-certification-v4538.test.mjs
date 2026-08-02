import assert from 'node:assert/strict';
import fs from 'node:fs';
const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const exp=fs.readFileSync(new URL('../export-center.js',import.meta.url),'utf8');
const sec=fs.readFileSync(new URL('../backend/security.mjs',import.meta.url),'utf8');
assert.ok(app.includes("statutoryCloudAudit=null")&&app.includes("statutoryCloudNotes=[]"),'data writes must invalidate statutory evidence');
assert.ok(app.includes("report_b09_certification")&&app.includes("validate_tt133_report_set"),'cloud audit must use server B09 workflow and validator');
assert.ok(app.includes("certify_tt133_release")&&app.includes("financial_reports.certify"),'AAL2 certification RPC is not wired');
assert.ok(app.includes("releaseVersion:'4.5.55'")&&app.includes('migrationVersion:68'),'audit evidence version binding missing');
assert.ok(exp.includes("cert.status !== 'active'")&&exp.includes("cert.migration_version")&&exp.includes("b09_approved_count"),'export gate does not require live server certification');
for(const p of ['b09.review','b09.approve','financial_reports.certify'])assert.ok(sec.includes(p),`backend AAL2 set missing ${p}`);

assert.match(app,/refreshStatutoryCertification/,'UI must re-fetch the active certification from Supabase');
assert.match(app,/statutory_report_certifications/,'UI must query the certification evidence table');
assert.doesNotMatch(app,/onclick="window\.print\(\)"/,'accounting view must not bypass the certified export gate with direct printing');
assert.match(exp,/statutoryCertificateHashErrors/,'export must verify B01/B02/B03/B09 hashes against the live certificate');
assert.match(exp,/certificationVerifiedAt/,'export must require a recent live Supabase verification');

console.log('PASS v4.5.49 UI/export fail-closed financial certification wiring');
