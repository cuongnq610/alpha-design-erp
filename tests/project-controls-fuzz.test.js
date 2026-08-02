'use strict';
const assert=require('node:assert/strict');
const C=require('../calculation-core.js');
let seed=371;
const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/2**32;};
const money=max=>Math.round(rnd()*max);
for(let i=0;i<500;i++){
  const contract=1000000+money(1000000000),budget=money(contract),progress=Math.round(rnd()*10000)/100;
  const invoiceNet=money(contract*1.2),vat=Math.round(invoiceNet*0.1),invoiceGross=invoiceNet+vat;
  const allocation=money(invoiceGross*1.2),cash=money(invoiceGross*1.5),cashPaid=money(budget*1.2),actual=money(budget*1.2);
  const db={settings:{monthlyWorkingHours:176,targetMargin:30},accounts:[{code:'154',type:'Asset',normalSide:'Debit',active:true,postable:true},{code:'331',type:'Liability',normalSide:'Credit',active:true,postable:true}],openingBalances:[],people:[],accountingPeriods:[],pitWithholdings:[],citAdjustments:[],clients:[],projects:[{id:'p',code:`P${i}`,name:'Fuzz',startDate:'2026-01-01',endDate:'2026-12-31',contractValue:contract,directBudget:budget,progress,expectedRiskCost:0}],contracts:[],billingMilestones:[],projectStages:[],timesheets:[],resourcePlans:[],commitments:[],projectBudgetVersions:[{id:'b',projectId:'p',versionNo:1,status:'Approved',directBudget:budget,expectedRiskCost:1000}],projectBudgetLines:[],journalEntries:actual?[{id:'j',date:'2026-06-01',documentNo:`J${i}`,status:'Posted',projectId:'p',lines:[{accountCode:'154',debit:actual,credit:0},{accountCode:'331',debit:0,credit:actual}]}]:[],taxInvoices:invoiceGross?[{id:'inv',direction:'Output',date:'2026-05-01',dueDate:'2026-06-01',status:'Valid',projectId:'p',taxBase:invoiceNet,vatAmount:vat,totalAmount:invoiceGross}]:[],paymentAllocations:invoiceGross?[{id:'a',invoiceId:'inv',date:'2026-05-10',amount:allocation,status:'Posted'}]:[],finance:[{id:'in',date:'2026-05-10',projectId:'p',type:'Income',status:'Paid',amount:cash},{id:'out',date:'2026-05-20',projectId:'p',type:'Expense',status:'Paid',amount:cashPaid}]};
  for(const j of db.journalEntries)j.postingHash=C.postingHash(j);
  const r=C.projectFinancials(db,'p',{to:'2026-12-31'});
  for(const key of ['actualCost','estimateAtCompletion','receivableGross','receivableNet','backlog','netProjectCash','collectedGross','allocatedGross'])assert(Number.isFinite(r[key]),`${key} finite case ${i}`);
  assert(r.actualCost>=0);assert(r.estimateAtCompletion>=r.actualCost);assert(r.receivableGross>=0);assert(r.receivableNet>=0);assert(r.backlog>=0);assert(r.allocatedGross<=invoiceGross);assert(r.invoiceCollectionRate>=0&&r.invoiceCollectionRate<=100+1e-9);assert.equal(r.netProjectCash,r.cashReceivedGross-r.cashPaid);assert.equal(r.expectedRiskCost,1000);
}
console.log('PASS 500 deterministic project-control fuzz scenarios');
