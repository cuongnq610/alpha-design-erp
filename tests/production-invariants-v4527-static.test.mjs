import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(name)=>fs.readFileSync(path.join(root,name),'utf8');
const app=read('app.js');
const core=read('calculation-core.js');
const backend=read('backend/security.mjs');
const migration=read('supabase/migrations/054_production_invariants_v4527.sql');

for(const marker of [
  'FINANCE_JOURNAL_REQUIRED','FINANCE_JOURNAL_AMOUNT_MISMATCH','DUPLICATE_FINANCE_JOURNAL_LINK',
  'ALLOCATED_PAYMENT_IMMUTABLE','ALLOCATED_PAYMENT_AMOUNT','ALLOCATED_INVOICE_IMMUTABLE',
  'ALLOCATED_INVOICE_AMOUNT','POSTED_SCHEDULE_IMMUTABLE','POSTED_SCHEDULE_ROW_IMMUTABLE',
  'SCHEDULE_JOURNAL_MISMATCH','SCHEDULE_POSTING_MISMATCH','POSTED_SCHEDULE_DELETE'
]) assert.ok(migration.includes(marker),`Migration 054 is missing ${marker}`);

assert.ok(migration.includes("||'|finance-journal|'||journal_id"),'Paid journal uniqueness must use an advisory transaction lock.');
assert.ok(migration.includes("||'|invoice-allocation|'||p_record_id"),'Invoice parent updates must share the allocation lock.');
assert.ok(migration.includes("||'|payment-allocation|'||p_record_id"),'Payment parent updates must share the allocation lock.');
assert.ok(migration.includes("'|asset-schedule|'"),'Schedule posting and parent edits must share a source lock.');
assert.ok(migration.includes('jsonb_array_elements')&&migration.includes("'^(111|112)'"),'Server must derive Paid cash evidence from journal lines.');
assert.ok(migration.includes('assert_entity_delete_safe_v453')&&migration.includes("collection='journalEntries'"),'Delete hardening must preserve the original guard and add journal dependencies.');
assert.ok(migration.includes("active_release_version='4.5.27'")&&migration.includes("('4.5.27','Production invariant hardening"),'Migration 054 must mark release 4.5.27.');

assert.ok(core.includes('function financeJournalMatch')&&core.includes('function scheduleRebuildPlan')&&core.includes('function entityDeletionPlan'),'Core production invariant helpers are missing.');
assert.ok(core.includes("make('412','Thặng dư vốn cổ phần'")&&core.includes("make('414','Cổ phiếu quỹ'"),'B01a-DNN statutory equity detail is incomplete.');
assert.ok(core.includes("code:'TT133_B01_EQUITY'"),'B01a-DNN equity roll-up control is missing.');
assert.ok(app.includes("field('journalEntryId','Chứng từ tiền Posted'"),'Finance UI does not expose Posted journal evidence.');
assert.ok(app.includes('Calc.paymentAllocationConstraint')&&app.includes('Calc.invoiceAllocationConstraint'),'UI parent allocation mutation guards are missing.');
assert.ok(app.includes('Calc.scheduleRebuildPlan')&&app.includes('draftJournalIds'),'Schedule rebuild does not remove stale Draft auto-journals safely.');
assert.ok(app.includes('Calc.entityDeletionPlan(db,type,id)'), 'Client deletion does not mirror dependency-safe server behavior.');
assert.ok(backend.includes("db[row.collection].push({...payload,id:String(row.record_id)})"),'Authoritative loader must normalize record_id into payload id.');

// The bundled demo is a release fixture; duplicate IDs/codes would invalidate
// integrity results before any user interaction.
const marker='const demoData = ';
const start=app.indexOf(marker)+marker.length;
let depth=0,quote='',escaped=false,end=-1;
for(let index=start;index<app.length;index+=1){
  const char=app[index];
  if(quote){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char===quote)quote='';continue;}
  if(char==='"'||char==="'"||char==='`'){quote=char;continue;}
  if(char==='{')depth+=1;
  else if(char==='}'&&--depth===0){end=index+1;break;}
}
assert.ok(end>start,'Cannot extract demoData.');
const demo=vm.runInNewContext(`(${app.slice(start,end)})`,{});
for(const [name,rows] of Object.entries(demo)){
  if(!Array.isArray(rows))continue;
  const ids=rows.map(row=>row?.id).filter(Boolean);
  assert.equal(new Set(ids).size,ids.length,`Demo collection ${name} contains duplicate IDs.`);
}
assert.equal(new Set(demo.accounts.map(row=>String(row.code))).size,demo.accounts.length,'Demo chart of accounts contains duplicate codes.');
for(const row of demo.finance.filter(row=>row.status==='Paid')){
  assert.ok(row.journalEntryId,`Paid demo finance ${row.id} is missing journal evidence.`);
}

console.log('PASS v4.5.27 static production invariant wiring, migration locks, authoritative identity and clean demo fixture');
