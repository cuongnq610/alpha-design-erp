import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';

const require=createRequire(import.meta.url);
globalThis.window=globalThis;
const C=require('../calculation-core.js');
globalThis.AlphaCalc=C;
await import('../payroll-detail.js');
const Payroll=globalThis.AlphaPayrollDetail;

// CIT: Law 09/2026/QH16 makes the 17% band includes revenue exactly equal to VND 50 billion.
const citSettings={
  citRateMode:'Auto by revenue',citStandardRate:20,citReducedRateEligibility:'Approved',
  citExemptionEligibility:'Unreviewed',citReducedRateEffectiveYear:2025,citExemptionEffectiveYear:2026
};
assert.equal(C.citRate({...citSettings,previousYearTaxRevenueBasis:3_000_000_000},{taxYear:2026}),15);
assert.equal(C.citRate({...citSettings,previousYearTaxRevenueBasis:3_000_000_001},{taxYear:2026}),17);
assert.equal(C.citRate({...citSettings,previousYearTaxRevenueBasis:49_999_999_999},{taxYear:2026}),17);
assert.equal(C.citRate({...citSettings,previousYearTaxRevenueBasis:50_000_000_000},{taxYear:2026}),17);
assert.equal(C.citRate({...citSettings,previousYearTaxRevenueBasis:50_000_000_001},{taxYear:2026}),20);
const exact50=C.citEstimate({settings:{...citSettings,previousYearTaxRevenueBasis:50_000_000_000},accounts:[],openingBalances:[],journalEntries:[],citAdjustments:[]},{from:'2026-01-01',to:'2026-12-31'});
assert.equal(exact50.rate,17);
assert.equal(exact50.requiresEligibilityReview,false,'Exactly VND 50 billion is outside the reduced-rate review band');

// PIT: the 2026 deductions and five-bracket salary schedule apply from tax period 2026.
assert.equal(Payroll.FORMULA_VERSION,'ALPHA-PAYROLL-4.5.61');
const pitSettings={
  personalDeduction:15_500_000,dependentDeduction:6_200_000,
  personalDeductionPrevious:11_000_000,dependentDeductionPrevious:4_400_000,
  fixedPitScheduleEffectiveDate:'2026-01-01'
};
const oldPit=Payroll.fixedPitPolicy('2025-12-31',pitSettings);
const newPit=Payroll.fixedPitPolicy('2026-01-01',pitSettings);
assert.equal(oldPit.personalDeduction,11_000_000);
assert.equal(oldPit.dependentDeduction,4_400_000);
assert.equal(oldPit.brackets.length,7);
assert.equal(newPit.personalDeduction,15_500_000);
assert.equal(newPit.dependentDeduction,6_200_000);
assert.equal(newPit.brackets.length,5);
assert.equal(Payroll.progressiveTax(10_000_000,newPit.brackets),500_000);
assert.equal(Payroll.progressiveTax(110_000_000,newPit.brackets),24_000_000);

const invoice=(overrides={})=>({
  id:'invoice',direction:'Input',date:'2026-07-10',serial:'AA',invoiceNo:'1',taxCode:'0101234567',
  partnerType:'vendor',partnerId:'vendor-1',status:'Valid',taxBase:4_500_000,vatRate:11.111111,
  vatAmount:500_000,totalAmount:5_000_000,deductible:true,paymentMethod:'Cash',paymentStatus:'Paid',...overrides
});
const assess=(rows,range={from:'2026-07-01',to:'2026-07-31',asOf:'2026-07-31'},extra={})=>C.vatInputDeductionAssessment({settings:{vatNonCashPaymentThreshold:5_000_000},taxInvoices:rows,...extra},range);

// VAT: exact threshold is inclusive; cash is excluded.
let result=assess([invoice()]);
assert.equal(result.deductibleVat,0);
assert.equal(result.blockedVat,500_000);
assert.equal(result.blockedRows.length,1);

// One VND below the threshold remains outside this payment-evidence control.
result=assess([invoice({taxBase:4_499_999,vatAmount:500_000,totalAmount:4_999_999})]);
assert.equal(result.deductibleVat,500_000);

// Same supplier + same day must aggregate before testing the VND 5 million threshold.
const grouped=[
  invoice({id:'a',invoiceNo:'A',taxBase:2_700_000,vatAmount:300_000,totalAmount:3_000_000}),
  invoice({id:'b',invoiceNo:'B',taxBase:2_700_000,vatAmount:300_000,totalAmount:3_000_000})
];
result=assess(grouped);
assert.equal(result.blockedRows.length,2);
assert.equal(result.blockedVat,600_000);
assert.ok(result.rows.every(row=>row.groupTotal===6_000_000));

// Qualifying bank payment is deductible; deferred payment is provisional only until its due date.
const paidBankInvoice=invoice({id:'paid-bank',paymentMethod:'Bank',paymentStatus:'Paid'});
const paidBankJournal={id:'paid-bank-je',date:'2026-07-10',documentNo:'UNC-01',status:'Posted',partnerType:'vendor',partnerId:'vendor-1',lines:[
  {accountCode:'331',debit:5_000_000,credit:0},
  {accountCode:'1121',debit:0,credit:5_000_000}
]};
paidBankJournal.postingHash=C.postingHash(paidBankJournal);
result=assess([paidBankInvoice],undefined,{
  vendors:[{id:'vendor-1',taxCode:'0101234567'}],
  finance:[{id:'paid-bank-fin',date:'2026-07-10',type:'Expense',status:'Paid',amount:5_000_000,vendorId:'vendor-1',invoiceId:'paid-bank',journalEntryId:'paid-bank-je'}],
  journalEntries:[paidBankJournal]
});
assert.equal(result.deductibleVat,500_000);
result=assess([invoice({paymentMethod:'Bank',paymentStatus:'Pending',dueDate:'2026-08-15'})]);
assert.equal(result.deductibleVat,500_000);
assert.equal(result.reviewRows.length,1);
result=assess([invoice({paymentMethod:'Bank',paymentStatus:'Pending',dueDate:'2026-07-15'})]);
assert.equal(result.deductibleVat,0);

const vatDb={
  settings:{vatNonCashPaymentThreshold:5_000_000},accounts:[],openingBalances:[],journalEntries:[],taxInvoices:[
    {id:'out',direction:'Output',date:'2026-07-10',status:'Valid',taxBase:10_000_000,vatRate:10,vatAmount:1_000_000,totalAmount:11_000_000,deductible:false},
    invoice()
  ],citAdjustments:[]
};
assert.deepEqual(C.vatRegisterSummary(vatDb,{from:'2026-07-01',to:'2026-07-31'}),{output:1_000_000,inputAll:500_000,inputDeductible:0,payable:1_000_000,creditCarry:0});
assert.equal(C.integrityChecks(vatDb,{from:'2026-07-01',to:'2026-07-31'}).checks.find(row=>row.code==='VAT_DEDUCTION_EVIDENCE')?.pass,false);

// TT99 must fail closed until a native Appendix IV mapping replaces the TT133 compatibility preview.
const tt99=C.tt99ReportChecks({settings:{accountingRegime:'TT99/2025/TT-BTC'},accounts:[],openingBalances:[],journalEntries:[],citAdjustments:[],reportNotesTT99:[]},{from:'2026-01-01',to:'2026-12-31'});
assert.equal(tt99.mappingValidated,false);
assert.equal(tt99.pass,false);
assert.equal(tt99.checks.find(row=>row.code==='TT99_MAPPING_VALIDATED')?.severity,'critical');

const exportSource=readFileSync(new URL('../export-center.js',import.meta.url),'utf8');
assert.match(exportSource,/TT99 bị khóa phát hành/);
assert.match(exportSource,/String\(cert\.release_version \|\| ''\) !== releaseVersion\(\)/);
assert.match(exportSource,/DATABASE_MIGRATION_VERSION = 75/);

const appSource=readFileSync(new URL('../app.js',import.meta.url),'utf8');
assert.match(appSource,/recalculateDraftPayrollAfterPitMigration=true/);
assert.match(appSource,/if\(recalculateDraftPayrollAfterPitMigration\)Payroll\.refreshDraftPeriods\(out,uid\)/);

const migration=readFileSync(new URL('../supabase/migrations/069_accounting_tax_legal_hardening_v4561.sql',import.meta.url),'utf8');
assert.match(migration,/p_release_version<>'4\.5\.61' or p_migration_version<>69/);
assert.match(migration,/superseded by release 4\.5\.61/);

console.log('PASS inherited v4.5.61 CIT/PIT/VAT boundary calculations and v4.5.67 Cloud certification binding');
