'use strict';
const assert=require('node:assert/strict');
const C=require('../calculation-core.js');

const account=(code,type='Asset',normalSide='Debit')=>({code,type,normalSide,active:true,postable:true});
const je=(id,date,code,lines)=>({id,date,documentNo:id,status:'Posted',cashFlowCode:code,description:id,lines});
const row=(report,code)=>report.rows.find(x=>x.code===code);

// B03-DNN: codes 31-36 must retain their statutory meaning; FX must be actual, not a balancing plug.
const cashDb={settings:{fiscalYearStart:'01-01'},accounts:[account('1111'),account('1121'),account('411','Equity','Credit'),account('419','Equity','Debit'),account('421','Equity','Credit'),account('341','Liability','Credit'),account('3412','Liability','Credit'),account('228'),account('413','Equity','Credit')],openingBalances:[],journalEntries:[
  je('CF25','2026-01-01','25',[{accountCode:'228',debit:7,credit:0},{accountCode:'1111',debit:0,credit:7}]),
  je('CF26','2026-01-01','26',[{accountCode:'1111',debit:2,credit:0},{accountCode:'228',debit:0,credit:2}]),
  je('CF31','2026-01-01','31',[{accountCode:'1111',debit:100,credit:0},{accountCode:'411',debit:0,credit:100}]),
  je('CF32','2026-01-02','32',[{accountCode:'411',debit:10,credit:0},{accountCode:'1111',debit:0,credit:10}]),
  je('CF33','2026-01-03','33',[{accountCode:'1111',debit:50,credit:0},{accountCode:'341',debit:0,credit:50}]),
  je('CF34','2026-01-04','34',[{accountCode:'341',debit:20,credit:0},{accountCode:'1111',debit:0,credit:20}]),
  je('CF35','2026-01-05','35',[{accountCode:'3412',debit:5,credit:0},{accountCode:'1111',debit:0,credit:5}]),
  je('CF36','2026-01-06','36',[{accountCode:'421',debit:8,credit:0},{accountCode:'1111',debit:0,credit:8}]),
  // Internal transfer must not inflate gross cash flows and does not require a B03 code.
  je('TRANSFER','2026-01-07','',[{accountCode:'1121',debit:30,credit:0},{accountCode:'1111',debit:0,credit:30}]),
  // Actual FX cash effect is reported on line 61.
  je('FX','2026-01-08','',[{accountCode:'1111',debit:3,credit:0},{accountCode:'413',debit:0,credit:3}])
]};
const b03=C.tt133B03Direct(cashDb,{from:'2026-01-01',to:'2026-01-31'});
assert.equal(row(b03,'25').value,-7);assert.equal(row(b03,'26').value,2);
assert.equal(row(b03,'31').value,100);assert.equal(row(b03,'32').value,-10);
assert.equal(row(b03,'33').value,50);assert.equal(row(b03,'34').value,-20);
assert.equal(row(b03,'35').value,-5);assert.equal(row(b03,'36').value,-8);
assert.equal(b03.net,102);assert.equal(b03.fx,3);assert.equal(b03.closing,105);assert.equal(b03.reconciled,true);
assert.deepEqual(C.ledgerCashFlow(cashDb,{from:'2026-01-01',to:'2026-01-31'}),{inflow:155,outflow:50,net:105});
assert.equal(C.entryValidation(cashDb,cashDb.journalEntries.find(x=>x.id==='TRANSFER'),'TRANSFER').valid,true);
assert.equal(C.entryValidation(cashDb,cashDb.journalEntries.find(x=>x.id==='FX'),'FX').valid,true);

// B01a-DNN: 242 and 244 must not be counted in both current and non-current assets.
const balanceDb={settings:{fiscalYearStart:'01-01'},accounts:[account('242'),account('244'),account('411','Equity','Credit')],openingBalances:[{accountCode:'242',debit:20,credit:0},{accountCode:'244',debit:30,credit:0},{accountCode:'411',debit:0,credit:50}],journalEntries:[]};
const b01=C.tt133B01a(balanceDb,{from:'2026-01-01',to:'2026-06-30'});
assert.equal(b01.totalAssets,50);assert.equal(row(b01,'150').end,0);assert.equal(row(b01,'260').end,50);assert.equal(b01.balanced,true);

// Interim B01 must include profit/loss from fiscal-year start, not only the selected report sub-period.
const interimDb={settings:{fiscalYearStart:'01-01'},accounts:[account('1121'),account('131'),account('411','Equity','Credit'),account('511','Revenue','Credit')],openingBalances:[{accountCode:'1121',debit:100,credit:0},{accountCode:'411',debit:0,credit:100}],journalEntries:[je('REV','2026-02-10','',[{accountCode:'131',debit:30,credit:0},{accountCode:'511',debit:0,credit:30}])]};
const interim=C.tt133B01a(interimDb,{from:'2026-07-01',to:'2026-09-30'});
assert.equal(interim.totalAssets,130);assert.equal(interim.totalSources,130);assert.equal(interim.balanced,true);

// Project non-labor cost must subtract the higher reliable labor source, preventing posted labor double counting.
const projectDb={settings:{monthlyWorkingHours:1,employerBurdenRate:0},accounts:[account('6422','Expense'),account('331','Liability','Credit')],openingBalances:[],people:[{id:'P',type:'CTV',hourlyRate:10,status:'Active'}],projects:[{id:'PR',code:'PR',name:'Project',pmId:'P',contractValue:500,directBudget:200,progress:50,startDate:'2026-01-01',endDate:'2026-12-31'}],timesheets:[{id:'T',date:'2026-01-10',projectId:'PR',personId:'P',hours:5,approved:true}],journalEntries:[
  {...je('LAB','2026-01-10','',[{accountCode:'6422',debit:80,credit:0},{accountCode:'331',debit:0,credit:80}]),projectId:'PR',description:'Payroll labor'},
  {...je('NONLAB','2026-01-11','',[{accountCode:'6422',debit:20,credit:0},{accountCode:'331',debit:0,credit:20}]),projectId:'PR',description:'Printing'}
],finance:[],contracts:[],taxInvoices:[],paymentAllocations:[],projectBudgetVersions:[],projectBudgetLines:[],resourcePlans:[],commitments:[],projectStages:[]};
assert.equal(C.projectFinancials(projectDb,'PR',{to:'2026-01-31'}).directNonLabor,20);

// Negative payment allocation cannot reduce the allocated amount; commitment recognition is capped by commitment value.
const allocationDb={taxInvoices:[{id:'I',direction:'Output',date:'2026-01-01',status:'Valid',totalAmount:100,taxBase:100}],paymentAllocations:[{invoiceId:'I',date:'2026-01-02',amount:-10,status:'Posted'},{invoiceId:'I',date:'2026-01-02',amount:30,status:'Posted'}]};
assert.equal(C.invoiceAllocatedAmount(allocationDb,allocationDb.taxInvoices[0]),30);
const commitment=C.projectCommitments({commitments:[{projectId:'PR',amount:100,recognizedAmount:150,status:'Approved'}]},'PR',{to:'2026-01-31'});
assert.equal(commitment.recognized,100);assert.equal(commitment.outstanding,0);

// Strict calendar dates and posting hashes.
assert.equal(C.isISODate('2026-02-29'),false);assert.equal(C.isISODate('2024-02-29'),true);
assert.equal(C.localISODate('not-a-date'),'');assert.equal(C.inRange('2026-02-30','2026-01-01','2026-12-31'),false);
assert.equal(C.validateProject({code:'X',name:'X',contractValue:1,directBudget:0,progress:0,startDate:'2026-02-30',endDate:'2026-03-01'}).valid,false);
assert.equal(C.validateTimesheet({people:[{id:'P'}],projects:[{id:'PR'}],timesheets:[]},{date:'2026-02-30',personId:'P',projectId:'PR',hours:8}).valid,false);
const unhashed=je('NOHASH','2026-01-01','01',[{accountCode:'1111',debit:1,credit:0},{accountCode:'411',debit:0,credit:1}]);
assert.equal(C.verifyPostingHash(unhashed),false);unhashed.postingHash=C.postingHash(unhashed);assert.equal(C.verifyPostingHash(unhashed),true);

console.log('PASS deep-audit patch2 accounting, project controls, dates and integrity regressions');
