'use strict';
const assert=require('node:assert/strict');
const C=require('../calculation-core.js');

const posted=(entry)=>({...entry,status:'Posted'});
const cashEntry=({id='je1',date='2026-07-01',amount=100,type='Expense',projectId='p1',status='Posted'}={})=>({
  id,date,documentNo:`DOC-${id}`,status,projectId,
  lines:type==='Income'
    ? [{accountCode:'1121',debit:amount,credit:0,projectId},{accountCode:'131',debit:0,credit:amount,projectId}]
    : [{accountCode:'154',debit:amount,credit:0,projectId},{accountCode:'1121',debit:0,credit:amount,projectId}]
});

// Automatic document numbers are year-aware and advance from the maximum
// suffix, so deleting an earlier Draft cannot create a duplicate.
assert.equal(C.nextDocumentNumber([
  {documentNo:'AUTO-PB-2026-0001'},
  {documentNo:'AUTO-PB-2026-0003'},
  {documentNo:'AUTO-PB-2025-0099'}
],'AUTO-PB','2026-12-31'),'AUTO-PB-2026-0004');
assert.equal(C.nextDocumentNumber([{documentNo:'AUTO-PB-2026-9999'}],'AUTO-PB','2027-01-31'),'AUTO-PB-2027-0001');

// Paid finance evidence must match date, project, direction and net cash.
const exactJournal=cashEntry();
const finance={id:'f1',date:'2026-07-01',type:'Expense',status:'Paid',amount:100,projectId:'p1',journalEntryId:'je1',costNature:'DirectNonLabor'};
const financeDb={journalEntries:[exactJournal],finance:[finance]};
assert.equal(C.financeJournalMatch(financeDb,finance,exactJournal),true);
assert.equal(C.financeJournalMatch(financeDb,{...finance,amount:99},exactJournal),false);
assert.equal(C.financeJournalMatch(financeDb,{...finance,date:'2026-07-02'},exactJournal),false);
assert.equal(C.financeJournalMatch(financeDb,{...finance,projectId:'p2'},exactJournal),false);
assert.equal(C.financeJournalMatch(financeDb,finance,{...exactJournal,status:'Draft'}),false);
assert.deepEqual(C.financeJournalCandidates(financeDb,finance).map(x=>x.id),['je1']);

const actualDb={
  settings:{monthlyWorkingHours:176},
  accounts:[{code:'154',type:'Asset',active:true,postable:true},{code:'1121',type:'Asset',active:true,postable:true}],
  journalEntries:[exactJournal],finance:[finance],timesheets:[],people:[],projects:[{id:'p1'}]
};
assert.equal(C.projectActualCost(actualDb,'p1',{to:'2026-12-31'}).actualCost,100,'Exact link must prevent double counting.');
const staleLinkDb={...actualDb,finance:[{...finance,amount:90,postedToLedger:true}]};
assert.equal(C.projectActualCost(staleLinkDb,'p1',{to:'2026-12-31'}).actualCost,190,'A stale flag or mismatched explicit link must not suppress management cost.');

const repairDb={
  journalEntries:[cashEntry({id:'je-a'}),cashEntry({id:'je-b'})],
  finance:[
    {...finance,id:'fa',journalEntryId:'je-a'},
    {...finance,id:'fb',journalEntryId:''}
  ],
  taxInvoices:[],purchaseOrders:[],toolAllocationSchedules:[],depreciationSchedules:[],billingMilestones:[],contracts:[]
};
const repair=C.repairExactLinks(repairDb);
assert.equal(repairDb.finance[1].journalEntryId,'je-b','Repair must not reuse a journal already linked to another Paid row.');
assert.equal(repair.count,1);

// Parent records cannot be edited into a state that invalidates recognized allocations.
const allocationDb={
  taxInvoices:[{id:'i1',direction:'Output',status:'Valid',date:'2026-06-01',projectId:'p1',totalAmount:100}],
  finance:[{id:'pay1',type:'Income',status:'Paid',date:'2026-06-10',projectId:'p1',amount:100}],
  paymentAllocations:[{id:'a1',invoiceId:'i1',paymentId:'pay1',date:'2026-06-10',amount:80,status:'Posted'}]
};
assert.equal(C.invoiceAllocationConstraint(allocationDb,{...allocationDb.taxInvoices[0],totalAmount:100},'i1').valid,true);
assert.equal(C.invoiceAllocationConstraint(allocationDb,{...allocationDb.taxInvoices[0],totalAmount:70},'i1').valid,false);
assert.equal(C.invoiceAllocationConstraint(allocationDb,{...allocationDb.taxInvoices[0],status:'Cancelled'},'i1').valid,false);
assert.equal(C.invoiceAllocationConstraint(allocationDb,{...allocationDb.taxInvoices[0],projectId:'p2'},'i1').valid,false);
assert.equal(C.invoiceAllocationConstraint(allocationDb,{...allocationDb.taxInvoices[0],projectId:''},'i1').valid,false);
assert.equal(C.paymentAllocationConstraint(allocationDb,{...allocationDb.finance[0],amount:100},'pay1').valid,true);
assert.equal(C.paymentAllocationConstraint(allocationDb,{...allocationDb.finance[0],amount:70},'pay1').valid,false);
assert.equal(C.paymentAllocationConstraint(allocationDb,{...allocationDb.finance[0],status:'Pending'},'pay1').valid,false);
assert.equal(C.paymentAllocationConstraint(allocationDb,{...allocationDb.finance[0],date:'2026-06-11'},'pay1').valid,false);
assert.equal(C.paymentAllocationConstraint(allocationDb,{...allocationDb.finance[0],projectId:'p2'},'pay1').valid,false);
assert.equal(C.paymentAllocationConstraint(allocationDb,{...allocationDb.finance[0],projectId:''},'pay1').valid,false);

// Rebuilding a schedule replaces Draft journals but can never rewrite Posted history.
const scheduleRow={id:'tool-t1-2026-07',sourceId:'t1',kind:'tool',period:'2026-07',amount:100,status:'Draft',journalEntryId:'sj1'};
const scheduleJournal={id:'sj1',date:'2026-07-28',documentNo:'AUTO-PB-2026-0001',status:'Draft',sourceType:'tool_allocation',sourceId:'t1:2026-07',lines:[
  {accountCode:'6422',debit:100,credit:0},{accountCode:'242',debit:0,credit:100}
]};
const scheduleDb={toolAllocationSchedules:[scheduleRow],depreciationSchedules:[],journalEntries:[scheduleJournal]};
assert.equal(C.scheduleRebuildPlan(scheduleDb,{kind:'tool',sourceId:'t1'}).allowed,true);
assert.deepEqual(C.scheduleRebuildPlan(scheduleDb,{kind:'tool',sourceId:'t1'}).draftJournalIds,['sj1']);
assert.equal(C.scheduleJournalMatch(scheduleDb,scheduleRow),true);
const postedScheduleDb={...scheduleDb,journalEntries:[{...scheduleJournal,status:'Posted'}]};
assert.equal(C.scheduleRebuildPlan(postedScheduleDb,{kind:'tool',sourceId:'t1'}).allowed,false);
assert.equal(C.scheduleJournalMatch({...scheduleDb,journalEntries:[{...scheduleJournal,date:'2026-08-28'}]},scheduleRow),false);

// Client deletion control mirrors database dependency guards, including nested journal links.
assert.equal(C.entityDeletionPlan({projects:[{id:'p1'}],journalEntries:[{id:'j',lines:[{projectId:'p1'}]}]},'projects','p1').allowed,false);
assert.equal(C.entityDeletionPlan({clients:[{id:'c1'}],taxInvoices:[{id:'i',partnerType:'client',partnerId:'c1'}]},'clients','c1').allowed,false);
assert.equal(C.entityDeletionPlan({vendors:[{id:'v1'}],journalEntries:[{id:'j',partnerType:'vendor',partnerId:'v1'}]},'vendors','v1').allowed,false);
assert.equal(C.entityDeletionPlan({taxInvoices:[{id:'i1'}],paymentAllocations:[{id:'a',invoiceId:'i1'}]},'taxInvoices','i1').allowed,false);
assert.equal(C.entityDeletionPlan({tools:[{id:'t1'}],toolAllocationSchedules:[{id:'s',sourceId:'t1'}]},'tools','t1').allowed,false);
assert.equal(C.entityDeletionPlan({quotes:[{id:'q1'}]},'quotes','q1').allowed,true);

// B01a-DNN row 400 must equal statutory detail rows 411–417, including
// share premium, other owner capital, treasury stock and unclosed current profit.
const equityDb={
  settings:{fiscalYearStart:'01-01'},
  accounts:[
    {code:'1111',type:'Asset'},{code:'4111',type:'Equity'},{code:'4112',type:'Equity'},
    {code:'4118',type:'Equity'},{code:'419',type:'Equity'},{code:'4212',type:'Equity'},{code:'5113',type:'Revenue'}
  ],
  openingBalances:[
    {asOfDate:'2026-01-01',accountCode:'1111',debit:1250,credit:0},
    {asOfDate:'2026-01-01',accountCode:'419',debit:50,credit:0},
    {asOfDate:'2026-01-01',accountCode:'4111',debit:0,credit:1000},
    {asOfDate:'2026-01-01',accountCode:'4112',debit:0,credit:200},
    {asOfDate:'2026-01-01',accountCode:'4118',debit:0,credit:100}
  ],
  journalEntries:[posted({id:'profit',date:'2026-06-30',documentNo:'REV-1',lines:[
    {accountCode:'1111',debit:100,credit:0},{accountCode:'5113',debit:0,credit:100}
  ]})]
};
const b01=C.tt133B01a(equityDb,{to:'2026-06-30'});
const b01Value=(code)=>b01.rows.find(row=>row.code===code).end;
assert.equal(b01Value('411'),1000);
assert.equal(b01Value('412'),200);
assert.equal(b01Value('413'),100);
assert.equal(b01Value('414'),-50);
assert.equal(b01Value('417'),100);
assert.equal(b01Value('400'),1350);
assert.equal(b01.equityDetailBalanced,true);
assert.equal(C.tt133ReportChecks(equityDb,{from:'2026-01-01',to:'2026-06-30'}).checks.find(row=>row.code==='TT133_B01_EQUITY').pass,true);

// Even individually safe lines must be rejected when their aggregate exceeds
// JavaScript's exact-integer boundary.
const huge=Math.floor(Number.MAX_SAFE_INTEGER/2)+1;
const unsafeDb={settings:{},accounts:[{code:'1111',active:true,postable:true},{code:'331',active:true,postable:true}],journalEntries:[],accountingPeriods:[]};
const unsafeEntry=C.entryValidation(unsafeDb,{date:'2026-07-01',documentNo:'BIG-1',status:'Draft',lines:[
  {accountCode:'1111',debit:huge,credit:0},{accountCode:'1111',debit:huge,credit:0},
  {accountCode:'331',debit:0,credit:huge},{accountCode:'331',debit:0,credit:huge}
]});
assert.equal(unsafeEntry.valid,false);
assert(unsafeEntry.errors.some(error=>error.includes('Tổng chứng từ vượt phạm vi số nguyên an toàn')));

console.log('PASS v4.5.27 production invariants: exact cash, immutable schedules, allocation parents, deletion parity and B01 equity roll-up');
