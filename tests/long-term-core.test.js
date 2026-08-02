'use strict';
const assert = require('assert/strict');
const C = require('../calculation-core.js');

assert.equal(C.sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');

const accounts = [
  {code:'1111',type:'Asset',normalSide:'Debit',active:true,postable:true},
  {code:'1121',type:'Asset',normalSide:'Debit',active:true,postable:true},
  {code:'131',type:'Asset',normalSide:'Debit',active:true,postable:true},
  {code:'331',type:'Liability',normalSide:'Credit',active:true,postable:true},
  {code:'5113',type:'Revenue',normalSide:'Credit',active:true,postable:true}
];
const baseEntry = {
  id:'je-1', date:'2026-01-15', documentNo:'0001', bookCode:'GENERAL', sourceType:'Phiếu kế toán',
  status:'Posted', description:'Doanh thu dự án', lines:[
    {accountCode:'131',debit:1000000,credit:0,partnerType:'client',partnerId:'c1'},
    {accountCode:'5113',debit:0,credit:1000000,projectId:'p1'}
  ]
};
baseEntry.postingHash = C.postingHash(baseEntry);
const db = {
  meta:{revision:1}, settings:{documentNumberScope:'source-year',monthlyWorkingHours:176,employerBurdenRate:0,holidays:[]},
  accounts, accountingPeriods:[{from:'2026-01-01',to:'2026-01-31',locked:true}], journalEntries:[baseEntry],
  openingBalances:[], openingPartnerBalances:[{accountCode:'131',partnerType:'client',partnerId:'c1',debit:500000,credit:0}],
  clients:[{id:'c1',code:'C1',name:'Client 1'}],people:[],timesheets:[],finance:[],taxInvoices:[],paymentAllocations:[],projects:[{id:'p1',code:'P1',name:'Project 1',contractValue:1000000,directBudget:0,progress:0}],contracts:[],projectStages:[],projectBudgetVersions:[],projectBudgetLines:[],resourcePlans:[],commitments:[],citAdjustments:[],pitWithholdings:[]
};

assert.equal(C.verifyPostingHash(baseEntry), true);
assert.equal(C.entryValidation(db, baseEntry, baseEntry.id).valid, true, 'unchanged posted entry remains valid after period locking');
const edited = {...baseEntry, description:'Sửa trái phép'};
assert.equal(C.entryValidation(db, edited, baseEntry.id).valid, false, 'posted entry must be immutable');
const lockedNew = {...baseEntry,id:'je-new',documentNo:'0002',status:'Draft',postingHash:''};
assert.equal(C.entryValidation(db, lockedNew).valid, false, 'new entry in locked period must be rejected');

const sameNoDifferentSource = {...baseEntry,id:'je-2',bookCode:'BANK',sourceType:'Báo Có',status:'Draft',postingHash:''};
assert.equal(C.entryValidation(db, sameNoDifferentSource).valid, false, 'locked date still blocks candidate');
const openDb = {...db, accountingPeriods:[]};
assert.equal(C.entryValidation(openDb, sameNoDifferentSource).valid, true, 'same document number is allowed in another source book');
const sameNoSameSource = {...sameNoDifferentSource,id:'je-3',bookCode:'GENERAL',sourceType:'Phiếu kế toán'};
assert.equal(C.entryValidation(openDb, sameNoSameSource).valid, false, 'same document number in same source and year is rejected');

const legacy = {...baseEntry, postingHash:C.legacyPostingHash(baseEntry), allowLegacyHash:true};
assert.equal(C.verifyPostingHash(legacy), true);
assert.equal(C.verifyPostingHash({...legacy,allowLegacyHash:false}), false);
const upgradedLegacy = C.upgradePostingHash(legacy);
assert.equal(upgradedLegacy.postingHash.length, 64);
assert.equal(upgradedLegacy.allowLegacyHash, false);
assert.equal(C.verifyPostingHash(upgradedLegacy), true);

const invoiceDb = {...openDb,
  taxInvoices:[
    {id:'inv-active',direction:'Output',date:'2026-01-05',dueDate:'2026-01-20',status:'Valid',taxBase:1000000,vatAmount:100000,totalAmount:1100000,projectId:'p1'},
    {id:'inv-replaced',direction:'Output',date:'2026-01-06',status:'Replaced',taxBase:2000000,vatAmount:200000,totalAmount:2200000,projectId:'p1'}
  ],
  paymentAllocations:[
    {invoiceId:'inv-active',date:'2026-01-10',amount:300000,status:'Posted'},
    {invoiceId:'inv-active',date:'2026-02-10',amount:800000,status:'Posted'},
    {invoiceId:'inv-active',date:'2026-01-15',amount:100000,status:'Draft'},
    {invoiceId:'inv-active',amount:100000,status:'Posted'}
  ]
};
assert.equal(C.invoiceAllocatedAmount(invoiceDb,invoiceDb.taxInvoices[0],{asOf:'2026-01-31'}),300000);
assert.equal(C.invoiceAllocatedAmount(invoiceDb,invoiceDb.taxInvoices[0],{asOf:'2026-02-28'}),1100000);
const paidWithoutDate={id:'paid-no-date',direction:'Output',date:'2026-01-01',paymentStatus:'Paid',total_amount:550000};
assert.equal(C.invoiceAllocatedAmount({paymentAllocations:[]},paidWithoutDate,{asOf:'2026-01-31'}),0,'historical AR must not assume an undated Paid status occurred before the cut-off');
assert.equal(C.invoiceAllocatedAmount({paymentAllocations:[]},{...paidWithoutDate,paid_date:'2026-01-20'},{asOf:'2026-01-31'}),550000);
const agingJan=C.invoiceAging(invoiceDb,{direction:'Output',to:'2026-01-31',asOf:'2026-01-31'});
assert.equal(agingJan.rows.length,1,'replaced invoice must be excluded');
assert.equal(agingJan.totals.outstanding,800000,'future payment must not reduce historical AR');

const transferDb={...openDb,finance:[
  {date:'2026-01-08',type:'Expense',amount:5000000,status:'Paid',transactionNature:'Internal transfer'},
  {date:'2026-01-08',type:'Income',amount:5000000,status:'Paid',transactionNature:'Internal transfer'},
  {date:'2026-01-09',type:'Income',amount:2000000,status:'Paid',category:'Thu khách hàng'}
]};
assert.deepEqual(C.cashFlow(transferDb,{from:'2026-01-01',to:'2026-01-31'}),{cashIn:2000000,cashOut:0,net:2000000,internalTransfers:10000000});

assert.equal(C.workingDaysInRange({from:'2026-01-01',to:'2026-01-31'},{holidays:[]}),22);
assert.equal(C.workingDaysInRange({from:'2026-01-01',to:'2026-01-31'},{holidays:['2026-01-01']}),21);
const partialPerson={id:'e1',type:'Fixed',status:'Inactive',monthlySalary:22000000,startDate:'2026-01-16',endDate:'2026-01-31'};
assert.equal(C.monthlyEmploymentCost(partialPerson,'2026-01',{employerBurdenRate:0,holidays:[]}),11000000);
assert.equal(C.monthlyEmploymentCost(partialPerson,'2026-01',{employerBurdenRate:0,holidays:[]},{from:'2026-01-20',to:'2026-01-31'}),9000000);
const peopleDb={...openDb,settings:{monthlyWorkingHours:176,dailyWorkingHours:8,holidays:[]},people:[partialPerson],timesheets:[{personId:'e1',date:'2026-01-20',hours:8,billable:true,approved:true}]};
const util=C.peopleUtilization(peopleDb,{from:'2026-01-01',to:'2026-01-31'})[0];
assert.equal(util.capacity,88);
assert.equal(Math.round(util.utilization),9);
assert.equal(C.payrollByDepartment(peopleDb,{from:'2026-01-01',to:'2026-01-31'})[0].value,11000000);
assert.equal(C.headcountByDepartment(peopleDb,{to:'2026-01-20'})[0].value,1);
assert.equal(C.headcountByDepartment(peopleDb,{to:'2026-02-01'}).length,0);

const partnerDb={...openDb,journalEntries:[baseEntry,{id:'je-pay',date:'2026-01-20',documentNo:'PAY-1',bookCode:'BANK',status:'Posted',description:'Thu tiền',cashFlowCode:'01',lines:[{accountCode:'1121',debit:200000,credit:0},{accountCode:'131',debit:0,credit:200000,partnerType:'client',partnerId:'c1'}]}]};
partnerDb.journalEntries[1].postingHash=C.postingHash(partnerDb.journalEntries[1]);
const partner=C.partnerBalances(partnerDb,'131','client',{to:'2026-01-31'}).find(x=>x.partnerId==='c1');
assert.equal(partner.balance,1300000);

const dsoEntry={id:'dso-rev',date:'2026-01-31',documentNo:'DSO-1',bookCode:'GENERAL',sourceType:'Invoice',status:'Posted',description:'Revenue',lines:[{accountCode:'131',debit:100,credit:0,partnerType:'client',partnerId:'c1'},{accountCode:'5113',debit:0,credit:100}]};
dsoEntry.postingHash=C.postingHash(dsoEntry);
const dsoDb={...openDb,openingBalances:[{accountCode:'131',debit:100,credit:0}],journalEntries:[dsoEntry]};
assert.equal(C.dso(dsoDb,{from:'2026-01-01',to:'2026-01-31'}),46.5,'DSO uses average opening/ending receivables instead of only ending AR');

const audit=C.integrityChecks(invoiceDb,{from:'2026-01-01',to:'2026-01-31'});
assert.ok(audit.checks.find(x=>x.code==='VAT_UNIQUE'));
assert.equal(audit.checks.find(x=>x.code==='REFERENTIAL_INTEGRITY').pass,true);
const orphanAudit=C.integrityChecks({...invoiceDb,paymentAllocations:[...invoiceDb.paymentAllocations,{id:'bad-ref',invoiceId:'missing',date:'2026-01-10',amount:1,status:'Posted'}]},{from:'2026-01-01',to:'2026-01-31'});
assert.equal(orphanAudit.checks.find(x=>x.code==='REFERENTIAL_INTEGRITY').pass,false);
console.log('PASS long-term core accounting, workforce, AR, referential integrity, DSO and immutability assertions');
