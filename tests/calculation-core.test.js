'use strict';
const assert = require('assert');
const C = require('../calculation-core.js');

const db = {
  settings:{monthlyWorkingHours:176,employerBurdenRate:10,pitWithholdingRate:10,pitWithholdingThreshold:2000000,citRateMode:'Auto by revenue',citReducedRateEligibility:'Approved',previousYearTaxRevenueBasis:4200000000},
  accounts:[
    ['1111','Asset','Debit'],['1121','Asset','Debit'],['131','Asset','Debit'],['1331','Asset','Debit'],['331','Liability','Credit'],['33311','Liability','Credit'],['3335','Liability','Credit'],['5113','Revenue','Credit'],['632','Expense','Debit'],['6422','Expense','Debit'],['8211','Expense','Debit']
  ].map(([code,type,normalSide])=>({code,type,normalSide,active:true,postable:true})),
  openingBalances:[{accountCode:'1121',debit:100000000,credit:0},{accountCode:'331',debit:0,credit:100000000}],
  accountingPeriods:[],
  people:[{id:'p1',type:'Fixed',status:'Active',department:'Kiến trúc',monthlySalary:17600000,billingRate:250000},{id:'p2',type:'CTV',status:'Active',department:'Kiến trúc',hourlyRate:150000,billingRate:300000}],
  timesheets:[
    {id:'t1',date:'2026-01-10',projectId:'pr1',personId:'p1',hours:8,approved:true,billable:true},
    {id:'t2',date:'2026-01-10',projectId:'pr1',personId:'p2',hours:4,approved:true,billable:false},
    {id:'t3',date:'2026-01-11',projectId:'pr1',personId:'p1',hours:8,approved:false,billable:true}
  ],
  finance:[
    {date:'2026-01-15',type:'Income',status:'Paid',amount:110000000,projectId:'pr1',category:'Thu khách hàng'},
    {id:'fin-in1',date:'2026-01-16',type:'Expense',status:'Paid',amount:10000000,projectId:'pr1',category:'In ấn',costNature:'DirectNonLabor',vendorId:'v1',invoiceId:'in1',journalEntryId:'j3'},
    {date:'2026-01-17',type:'Expense',status:'Paid',amount:5000000,projectId:'pr1',category:'CTV'},
    {date:'2026-01-18',type:'Expense',status:'Pending',amount:9000000,projectId:'pr1',category:'Khác'}
  ],
  journalEntries:[
    {id:'j1',date:'2026-01-05',documentNo:'HD01',status:'Posted',description:'Doanh thu',projectId:'pr1',partnerType:'client',partnerId:'c1',lines:[{accountCode:'131',debit:110000000,credit:0},{accountCode:'5113',debit:0,credit:100000000},{accountCode:'33311',debit:0,credit:10000000}]},
    {id:'j2',date:'2026-01-15',documentNo:'BC01',cashFlowCode:'01',status:'Posted',description:'Thu tiền',projectId:'pr1',partnerType:'client',partnerId:'c1',lines:[{accountCode:'1121',debit:110000000,credit:0},{accountCode:'131',debit:0,credit:110000000}]},
    {id:'j3',date:'2026-01-16',documentNo:'PC01',cashFlowCode:'02',status:'Posted',description:'Chi phí',projectId:'pr1',partnerType:'vendor',partnerId:'v1',lines:[{accountCode:'6422',debit:10000000,credit:0},{accountCode:'1121',debit:0,credit:10000000}]}
  ],
  taxInvoices:[
    {direction:'Output',date:'2026-01-05',serial:'A',invoiceNo:'1',taxCode:'0101',status:'Valid',taxBase:100000000,vatRate:10,vatAmount:10000000,totalAmount:110000000,deductible:false},
    {id:'in1',direction:'Input',date:'2026-01-16',serial:'B',invoiceNo:'2',taxCode:'0102',partnerType:'vendor',partnerId:'v1',status:'Valid',taxBase:9090909,vatRate:10,vatAmount:909091,totalAmount:10000000,deductible:true,paymentMethod:'Bank',paymentStatus:'Paid'}
  ],
  pitWithholdings:[{date:'2026-01-20',grossIncome:5000000,taxableIncome:5000000,taxWithheld:500000,netPaid:4500000}],
  citAdjustments:[{date:'2026-01-31',status:'Reviewed',type:'Increase',amount:1000000}],
  clients:[{id:'c1',name:'Khách hàng A'}],
  vendors:[{id:'v1',name:'Nhà cung cấp A',taxCode:'0102'}],
  projects:[{id:'pr1',pmId:'p1',type:'Hotel',stage:'TKCS'}]
};
for(const j of db.journalEntries) j.postingHash=C.postingHash(j);

assert.equal(C.vnd(1.6),2);
assert.equal(C.localISODate(new Date(2026,0,2)),'2026-01-02');
assert.equal(C.costPerHour(db.people[0],db.settings),110000);
assert.equal(C.costPerHour(db.people[1],db.settings),150000);
assert.equal(C.laborCost(db,{projectId:'pr1',from:'2026-01-01',to:'2026-01-31'}),1480000);
assert.equal(C.projectDirectExpenses(db,'pr1',{from:'2026-01-01',to:'2026-01-31'}),10000000);
assert.deepEqual(C.projectCost(db,'pr1',{from:'2026-01-01',to:'2026-01-31'}),{labor:1480000,directNonLabor:10000000,total:11480000});
assert.deepEqual(C.cashFlow(db,{from:'2026-01-01',to:'2026-01-31'}),{cashIn:110000000,cashOut:15000000,net:95000000});
assert.equal(C.accountMovement(db,'5113',{from:'2026-01-01',to:'2026-01-31'}).credit,100000000);
assert.equal(C.accountBalance(db,'1121',{from:'2026-01-01',to:'2026-01-31'}).endingDebit,200000000);
const tb=C.trialBalance(db,{from:'2026-01-01',to:'2026-01-31'}); assert.equal(tb.balanced,true); assert.equal(tb.totals.debit,tb.totals.credit);
const pnl=C.profitAndLoss(db,{from:'2026-01-01',to:'2026-01-31'}); assert.equal(pnl.revenue,100000000);assert.equal(pnl.expenseBeforeTax,10000000);assert.equal(pnl.profitBeforeTax,90000000);
assert.equal(C.accountBalance(db,'131',{from:'2026-01-01',to:'2026-01-31'}).endingDebit,0);
const vatReg=C.vatRegisterSummary(db,{from:'2026-01-01',to:'2026-01-31'});assert.equal(vatReg.output,10000000);assert.equal(vatReg.inputDeductible,909091);
const vatLed=C.vatLedgerSummary(db,{from:'2026-01-01',to:'2026-01-31'});assert.equal(vatLed.output,10000000);assert.equal(vatLed.input,0);
assert.equal(C.citRate(db.settings),17);
assert.equal(C.citRate({...db.settings,previousYearTaxRevenueBasis:3000000000}),15);
assert.equal(C.citRate({...db.settings,previousYearTaxRevenueBasis:49999999999}),17);
assert.equal(C.citRate({...db.settings,previousYearTaxRevenueBasis:50000000000}),17);
assert.equal(C.citRate({...db.settings,previousYearTaxRevenueBasis:50000000001}),20);
assert.equal(C.citRate({...db.settings,previousYearTaxRevenueBasis:1000000000,citExemptionEligibility:'Unreviewed'}),15);
assert.equal(C.citRate({...db.settings,previousYearTaxRevenueBasis:1000000000,citExemptionEligibility:'Approved'}),0);
assert.equal(C.citRate({...db.settings,citRateMode:'Manual',corporateTaxRate:0}),0,'Manual CIT rate 0% must not silently default to 20%');
assert.equal(C.citRate({...db.settings,citRateMode:'Manual',corporateTaxRate:''}),20,'Missing manual CIT rate falls back to 20%');
assert.equal(C.citRate({...db.settings,citRateMode:'Auto',citStandardRate:0,citReducedRateEligibility:'Rejected'}),0,'Explicit standard CIT rate 0% must be preserved');
const cit=C.citEstimate(db,{from:'2026-01-01',to:'2026-01-31'});assert.equal(cit.taxable,91000000);assert.equal(cit.tax,15470000);assert.equal(cit.exemptionApplied,false);
const exemptDb=JSON.parse(JSON.stringify(db));exemptDb.settings.previousYearTaxRevenueBasis=1000000000;exemptDb.settings.citExemptionEligibility='Approved';const exemptCit=C.citEstimate(exemptDb,{from:'2026-01-01',to:'2026-01-31'});assert.equal(exemptCit.tax,0);assert.equal(exemptCit.exemptionApplied,true);
const reviewDb=JSON.parse(JSON.stringify(exemptDb));reviewDb.settings.citExemptionEligibility='Unreviewed';const reviewCit=C.citEstimate(reviewDb,{from:'2026-01-01',to:'2026-01-31'});assert.equal(reviewCit.requiresExemptionReview,true);assert.equal(reviewCit.exemptionApplied,false);
assert.deepEqual(C.pitWithholding({grossIncome:5000000,taxableIncome:5000000,withholdingMethod:'Khấu trừ tỷ lệ',rate:10},db.settings),{gross:5000000,taxable:5000000,rate:10,tax:500000,net:4500000,requiresManualReview:false});
assert.equal(C.pitWithholding({grossIncome:1500000,taxableIncome:1500000,withholdingMethod:'Khấu trừ tỷ lệ',rate:10},db.settings).tax,0);
assert.equal(C.entryValidation(db,db.journalEntries[0],db.journalEntries[0].id).valid,true);
const bad={date:'2026-01-01',documentNo:'X',status:'Draft',lines:[{accountCode:'1111',debit:100,credit:0},{accountCode:'331',debit:0,credit:99}]};assert.equal(C.entryValidation(db,bad).valid,false);
assert.equal(C.verifyPostingHash(db.journalEntries[0]),true);db.journalEntries[0].description='changed';assert.equal(C.verifyPostingHash(db.journalEntries[0]),false);db.journalEntries[0].description='Doanh thu';
const series=C.monthlySeries(db,{from:'2026-01-01',to:'2026-01-31'});assert.equal(series.revenue[0],100);assert.equal(series.cashIn[0],110);assert.equal(series.cashOut[0],15);
const audit=C.integrityChecks(db,{from:'2026-01-01',to:'2026-01-31'});assert.equal(audit.checks.length>=10,true);assert.equal(audit.checks.find(x=>x.code==='JE_BALANCE').pass,true);

assert.equal(series.payrollFixed[0],19.36);
assert.equal(series.payrollCtv[0],0.6);
assert.equal(C.rangeDays({from:'2026-01-01',to:'2026-01-31'}),31);
const mb=C.monthlyAccountBalance(db,'1121',{from:'2026-01-01',to:'2026-01-31'},'Debit');assert.equal(mb.values[0],200);
const inc=C.financeBreakdown(db,{from:'2026-01-01',to:'2026-01-31'},'Income');assert.equal(inc[0].value,110000000);
const expSeries=C.monthlyFinanceByCategory(db,{from:'2026-01-01',to:'2026-01-31'},'Expense');assert.equal(expSeries.reduce((z,x)=>z+x.values[0],0),15);
const hc=C.headcountByDepartment(db);assert.equal(hc[0].value,2);
const util=C.peopleUtilization(db,{from:'2026-01-01',to:'2026-01-31'});const p1Util=util.find(x=>x.id==='p1');assert.equal(Math.round(p1Util.utilization),5);assert.equal(Math.round(p1Util.chargeability),100);
const payDept=C.payrollByDepartment(db,{from:'2026-01-01',to:'2026-01-31'});assert.equal(payDept[0].value,19960000);
const byClient=C.revenueByClient(db,{from:'2026-01-01',to:'2026-01-31'});assert.equal(byClient[0].value,100000000);
const byStage=C.revenueByStage(db,{from:'2026-01-01',to:'2026-01-31'});assert.equal(byStage[0].name,'TKCS');
assert.equal(C.dso(db,{from:'2026-01-01',to:'2026-01-31'}),0);
const expenseGroups=C.expenseByGroup(db,{from:'2026-01-01',to:'2026-01-31'});assert.equal(expenseGroups[0].value,10000000);
const priorDb=JSON.parse(JSON.stringify(db));priorDb.journalEntries.push({id:'j0',date:'2025-12-20',documentNo:'PRIOR',cashFlowCode:'33',status:'Posted',description:'prior',lines:[{accountCode:'1121',debit:5000000,credit:0},{accountCode:'331',debit:0,credit:5000000}]});priorDb.journalEntries.at(-1).postingHash=C.postingHash(priorDb.journalEntries.at(-1));assert.equal(C.accountBalance(priorDb,'1121',{from:'2026-01-01',to:'2026-01-31'}).openingDebit,105000000);
const lossDb=JSON.parse(JSON.stringify(db));lossDb.journalEntries.push({id:'loss',date:'2026-01-25',documentNo:'LOSS',status:'Posted',description:'loss',lines:[{accountCode:'6422',debit:100000000,credit:0},{accountCode:'331',debit:0,credit:100000000}]});lossDb.journalEntries.at(-1).postingHash=C.postingHash(lossDb.journalEntries.at(-1));lossDb.citAdjustments=[{date:'2026-01-31',status:'Reviewed',type:'Increase',amount:20000000}];assert.equal(C.citEstimate(lossDb,{from:'2026-01-01',to:'2026-01-31'}).taxable,10000000);
console.log(`PASS ${40} calculation assertions`);
const b01=C.tt133B01a(db,{from:'2026-01-01',to:'2026-01-31'});
assert.equal(b01.form,'B01a-DNN');assert.equal(b01.balanced,true);assert.equal(b01.totalAssets,b01.totalSources);
const b02=C.tt133B02(db,{from:'2026-01-01',to:'2026-01-31'});
assert.equal(b02.form,'B02-DNN');assert.equal(b02.profitBeforeTax,90000000);assert.equal(b02.profitAfterTax,90000000);
const b03=C.tt133B03Direct(db,{from:'2026-01-01',to:'2026-01-31'});
assert.equal(b03.form,'B03-DNN');assert.equal(b03.opening,100000000);assert.equal(b03.net,100000000);assert.equal(b03.closing,200000000);assert.equal(b03.reconciled,true);
const f01=C.tt133F01(db,{from:'2026-01-01',to:'2026-01-31'});assert.equal(f01.form,'F01-DNN');assert.equal(f01.balanced,true);
const b09=C.tt133B09(db,{from:'2026-01-01',to:'2026-01-31'});assert.equal(b09.form,'B09-DNN');assert.equal(b09.sections.length>=8,true);
const rc=C.tt133ReportChecks(db,{from:'2026-01-01',to:'2026-01-31'});assert.equal(rc.pass,true);assert.equal(rc.checks.length,7);
console.log('PASS 56 calculation assertions including TT133 statutory reports and equity roll-up');
