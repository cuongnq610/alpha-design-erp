import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const C=require('../calculation-core.js');
const css=fs.readFileSync(new URL('../alpha-design-system.css',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const migration=fs.readFileSync(new URL('../supabase/migrations/035_ui_formula_deep_audit_v455.sql',import.meta.url),'utf8');

assert.match(css,/--ux-section-gap:18px/);
assert.match(css,/\.content>\*\+\*\{margin-top:var\(--ux-section-gap\)\}/);
assert.match(css,/\.nav-group\.is-open\{/);
assert.match(css,/\.nav-item\.active \.nav-svg/);
assert.match(app,/class="note tax-legal-note"/);
assert.match(app,/Calc\.pitRegisterSummary\(db/);
assert.match(app,/aria-current','page'/);

const pitSettings={
  pitWithholdingRate:10,
  pitWithholdingThreshold:5000000,
  pitWithholdingThresholdPrevious:2000000,
  pitWithholdingThresholdEffectiveDate:'2026-07-01'
};
assert.equal(C.pitWithholdingThresholdForDate({date:'2026-06-30'},pitSettings),2000000);
assert.equal(C.pitWithholdingThresholdForDate({date:'2026-07-01'},pitSettings),5000000);
assert.equal(C.pitWithholding({date:'2026-06-30',grossIncome:3000000,withholdingMethod:'Khấu trừ tỷ lệ'},pitSettings).tax,300000);
assert.equal(C.pitWithholding({date:'2026-07-01',grossIncome:3000000,withholdingMethod:'Khấu trừ tỷ lệ'},pitSettings).tax,0);
assert.equal(C.pitWithholding({date:'2026-07-01',grossIncome:5000000,withholdingMethod:'Khấu trừ tỷ lệ'},pitSettings).tax,500000);
assert.equal(C.pitWithholding({date:'2026-07-01',grossIncome:5000000,withholdingMethod:'Khấu trừ tỷ lệ',rate:120},pitSettings).tax,5000000);

const pitSummary=C.pitRegisterSummary({pitWithholdings:[
  {date:'2026-07-05',status:'Pending',grossIncome:5000000,taxableIncome:5000000,taxWithheld:500000,netPaid:4500000},
  {date:'2026-07-06',status:'Withheld',grossIncome:5000000,taxableIncome:5000000,taxWithheld:500000,netPaid:4500000},
  {date:'2026-07-07',status:'Cancelled',grossIncome:8000000,taxableIncome:8000000,taxWithheld:800000,netPaid:7200000}
]},{from:'2026-07-01',to:'2026-07-31'});
assert.equal(pitSummary.rows.length,1);
assert.equal(pitSummary.tax,500000);

const citSettings={citRateMode:'Auto by revenue',citReducedRateEligibility:'Approved',citExemptionEligibility:'Not eligible'};
assert.equal(C.citRate({...citSettings,previousYearTaxRevenueBasis:3000000000}),15);
assert.equal(C.citRate({...citSettings,previousYearTaxRevenueBasis:50000000000}),17);
assert.equal(C.citRate({...citSettings,previousYearTaxRevenueBasis:50000000001}),20);
assert.equal(C.citRate({citRateMode:'Manual',corporateTaxRate:140}),100);

const draftCostDb={
  settings:{monthlyWorkingHours:176},
  accounts:[{code:'154',type:'Asset'},{code:'1121',type:'Asset'}],
  projects:[{id:'P'}],people:[],timesheets:[],
  journalEntries:[{id:'J-DRAFT',date:'2026-07-01',status:'Draft',projectId:'P',lines:[{accountCode:'154',debit:100,credit:0},{accountCode:'1121',debit:0,credit:100}]}],
  finance:[{id:'F',date:'2026-07-01',type:'Expense',status:'Paid',projectId:'P',amount:100,costNature:'DirectNonLabor',journalEntryId:'J-DRAFT'}]
};
const draftCost=C.projectActualCost(draftCostDb,'P',{to:'2026-07-31'});
assert.equal(draftCost.unpostedDirectFinanceCost,100);
assert.equal(draftCost.actualCost,100);

const invoice={id:'I',direction:'Output',date:'2026-07-01',status:'Valid',projectId:'P',taxBase:100,vatAmount:10,totalAmount:110};
const allocation={id:'A',invoiceId:'I',paymentId:'F',date:'2026-07-10',status:'Posted',amount:110};
const allocationDb={taxInvoices:[invoice],paymentAllocations:[allocation],finance:[{id:'F',projectId:'P',date:'2026-07-10',type:'Income',status:'Pending',amount:110}]};
assert.equal(C.invoiceAllocatedAmount(allocationDb,invoice),0);
allocationDb.finance[0].status='Paid';
allocationDb.finance[0].date='2026-07-11';
assert.equal(C.invoiceAllocatedAmount(allocationDb,invoice),0);
allocationDb.finance[0].date='2026-07-10';
assert.equal(C.invoiceAllocatedAmount(allocationDb,invoice),110);
const overSourceDb={
  taxInvoices:[{...invoice,totalAmount:200,taxBase:200,vatAmount:0}],
  finance:[{id:'F',projectId:'P',date:'2026-07-10',type:'Income',status:'Paid',amount:100}],
  paymentAllocations:[
    {id:'A1',invoiceId:'I',paymentId:'F',date:'2026-07-10',status:'Posted',amount:60},
    {id:'A2',invoiceId:'I',paymentId:'F',date:'2026-07-10',status:'Posted',amount:50}
  ]
};
assert.equal(C.invoiceAllocatedAmount(overSourceDb,overSourceDb.taxInvoices[0]),60,'Allocation exceeding the Paid source cap must fail closed');
assert.equal(C.integrityChecks(overSourceDb,{from:'2026-07-01',to:'2026-07-31'}).checks.find((x)=>x.code==='INVOICE_ALLOCATION').pass,false);

const legacyMixed={
  taxInvoices:[{...invoice,totalAmount:225,taxBase:225,vatAmount:0}],
  paymentAllocations:[{id:'LEGACY',invoiceId:'I',date:'2026-07-10',status:'Posted',amount:225}],
  finance:[{id:'OTHER',projectId:'P',date:'2026-07-11',type:'Income',status:'Paid',amount:75}]
};
const mixed=C.projectCommercials(legacyMixed,'P',{to:'2026-07-31'});
assert.equal(mixed.allocatedGross,225);
assert.equal(mixed.cashReceivedGross,300);
assert.equal(mixed.unappliedCashGross,75);

const sameDay={
  taxInvoices:[invoice],
  paymentAllocations:[{id:'LEGACY',invoiceId:'I',date:'2026-07-10',status:'Posted',amount:110}],
  finance:[{id:'F',projectId:'P',date:'2026-07-10',type:'Income',status:'Paid',amount:150}]
};
const sameDayCommercials=C.projectCommercials(sameDay,'P',{to:'2026-07-31'});
assert.equal(sameDayCommercials.cashReceivedGross,150);
assert.equal(sameDayCommercials.unappliedCashGross,40);

const vatDb={journalEntries:[
  {id:'VAT-OUT',date:'2026-07-01',status:'Posted',lines:[{accountCode:'33311',debit:0,credit:100}]},
  {id:'VAT-OUT-ADJ',date:'2026-07-02',status:'Posted',lines:[{accountCode:'33311',debit:20,credit:0}]},
  {id:'VAT-IN',date:'2026-07-03',status:'Posted',lines:[{accountCode:'1331',debit:50,credit:0}]},
  {id:'VAT-IN-ADJ',date:'2026-07-04',status:'Posted',lines:[{accountCode:'1331',debit:0,credit:5}]}
]};
const vat=C.vatLedgerSummary(vatDb,{from:'2026-07-01',to:'2026-07-31'});
assert.deepEqual(vat,{output:80,outputGross:100,outputAdjustments:20,input:45,inputGross:50,inputAdjustments:5});

assert.match(migration,/recognized allocation requires Paid Income finance/);
assert.match(migration,/recognized PIT requires Posted journal entry/);
assert.match(migration,/allocation date must not precede payment date/);

console.log('PASS v4.5.5 UI rhythm and deep formula/linkage regressions');
