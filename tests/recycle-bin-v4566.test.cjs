'use strict';
const assert=require('node:assert/strict');
const RecycleBin=require('../recycle-bin.js');

const deletedAt='2026-08-02T00:00:00.000Z';
const db={
  projects:[{id:'p1',name:'Một'},{id:'p2',name:'Hai'},{id:'p3',name:'Ba'}],
  contracts:[{id:'c1',contractNo:'HD-01'}],
  billingMilestones:[{id:'m1',contractId:'c1'},{id:'m2',contractId:'c1'},{id:'m3',contractId:'c2'}],
  trashEntries:[]
};

const projectEntry=RecycleBin.move(db,'projects','p2',{deletedAt,sourceView:'projects',sourceLabel:'Dự án',sourceContext:{tab:'portfolio'},displayName:'Hai',deletedBy:'Giám đốc Demo',deletedByUserId:'demo'});
assert.deepEqual(db.projects.map(x=>x.id),['p1','p3']);
assert.equal(db.trashEntries.length,1);
assert.equal(projectEntry.originalIndex,1);
assert.equal(projectEntry.expiresAt,'2026-09-01T00:00:00.000Z');
assert.equal(RecycleBin.daysRemaining(projectEntry,'2026-08-25T00:00:00.000Z'),7);
assert.equal(RecycleBin.expiredEntries(db,'2026-08-31T23:59:59.999Z').length,0);
assert.equal(RecycleBin.expiredEntries(db,'2026-09-01T00:00:00.000Z').length,1);

RecycleBin.restore(db,projectEntry.id);
assert.deepEqual(db.projects.map(x=>x.id),['p1','p2','p3'],'Restore must preserve the original list position');
assert.equal(db.trashEntries.length,0);

const contractEntry=RecycleBin.move(db,'contracts','c1',{deletedAt,sourceView:'commercial',sourceLabel:'Hợp đồng',relatedRecords:[{entityType:'billingMilestones',record:db.billingMilestones[0]},{entityType:'billingMilestones',record:db.billingMilestones[1]}]});
assert.deepEqual(db.billingMilestones.map(x=>x.id),['m3'],'Every related draft milestone must move as one bundle');
RecycleBin.restore(db,contractEntry.id);
assert.deepEqual(db.contracts.map(x=>x.id),['c1']);
assert.deepEqual(db.billingMilestones.map(x=>x.id),['m1','m2','m3'],'Bundle restore must preserve every related index');

const conflictEntry=RecycleBin.move(db,'projects','p2',{deletedAt,sourceView:'projects'});
db.projects.splice(1,0,{id:'p2',name:'Trùng mã'});
const beforeConflict=structuredClone(db);
assert.throws(()=>RecycleBin.restore(db,conflictEntry.id),/RESTORE_CONFLICT:projects:p2/);
assert.deepEqual(db,beforeConflict,'A restore conflict must not mutate live or trash data');
db.projects.splice(1,1);
assert.equal(RecycleBin.removeEntry(db,conflictEntry.id).recordId,'p2');

const external=RecycleBin.addExternal(db,{entityType:'documents',record:{id:'file-1',title:'Ho so.pdf'},deletedAt,sourceView:'documents',externalSource:'cloud-local-file'});
assert.equal(external.external,true);
assert.throws(()=>RecycleBin.restore(db,external.id),/EXTERNAL_TRASH_HANDLER_REQUIRED/);
assert.equal(RecycleBin.removeEntry(db,external.id).record.title,'Ho so.pdf');

assert.equal(RecycleBin.RETENTION_DAYS,30);
console.log('PASS v4.5.67 recycle bin move, exact-position restore, bundle integrity, conflict safety, external files and 30-day expiry');
