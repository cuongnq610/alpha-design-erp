'use strict';
const assert=require('assert/strict');
const C=require('../calculation-core.js');

const db={
 settings:{monthlyWorkingHours:176,employerBurdenRate:20,targetMargin:30},
 accounts:[
  ['1121','Asset','Debit'],['131','Asset','Debit'],['1331','Asset','Debit'],['154','Asset','Debit'],['331','Liability','Credit'],
  ['334','Liability','Credit'],['33311','Liability','Credit'],['5113','Revenue','Credit']
 ].map(([code,type,normalSide])=>({code,type,normalSide,active:true,postable:true})),
 openingBalances:[],accountingPeriods:[],clients:[{id:'cl1',code:'CL-01',name:'Client'}],pitWithholdings:[],citAdjustments:[],
 people:[{id:'p1',type:'Fixed',monthlySalary:17600000,status:'Active'}],
 projects:[{id:'pr1',code:'AD-2601',name:'Hotel',clientId:'cl1',pmId:'p1',startDate:'2026-01-01',endDate:'2026-06-30',contractValue:450000000,directBudget:180000000,progress:35,expectedRiskCost:5000000}],
 contracts:[{id:'c1',projectId:'pr1',contractNo:'HD-01',contractType:'Customer',valueExclVat:500000000,status:'Active'}],
 billingMilestones:[
  {id:'m1',contractId:'c1',projectId:'pr1',percentage:40,amountExclVat:200000000,status:'Active'},
  {id:'m2',contractId:'c1',projectId:'pr1',percentage:60,amountExclVat:300000000,status:'Active'}
 ],
 projectBudgetVersions:[{id:'bv1',projectId:'pr1',versionNo:1,versionName:'Baseline 1',status:'Approved',directBudget:200000000,expectedRiskCost:5000000}],
 projectBudgetLines:[
  {id:'bl1',budgetVersionId:'bv1',amount:120000000},
  {id:'bl2',budgetVersionId:'bv1',amount:80000000}
 ],
 projectStages:[
  {id:'s1',projectId:'pr1',weightPercent:40,progress:100,plannedStart:'2026-01-01',plannedEnd:'2026-02-28',status:'Completed'},
  {id:'s2',projectId:'pr1',weightPercent:60,progress:0,plannedStart:'2026-03-01',plannedEnd:'2026-06-30',status:'In progress'}
 ],
 timesheets:[1,2,3,4].map(i=>({id:`t${i}`,date:`2026-03-0${i}`,projectId:'pr1',personId:'p1',hours:20,approved:true,billable:true,description:'Design'})),
 resourcePlans:[
  {id:'rp1',projectId:'pr1',personId:'p1',month:'2026-03',plannedHours:100,costRate:120000,status:'Approved'},
  {id:'rp2',projectId:'pr1',personId:'p1',month:'2026-04',plannedHours:100,costRate:120000,status:'Approved'}
 ],
 commitments:[{id:'cm1',projectId:'pr1',amount:20000000,recognizedAmount:5000000,dueDate:'2026-04-15',status:'Approved'}],
 journalEntries:[
  {id:'j1',date:'2026-03-10',documentNo:'DT-01',status:'Posted',projectId:'pr1',description:'Doanh thu',lines:[{accountCode:'131',debit:220000000,credit:0},{accountCode:'5113',debit:0,credit:200000000},{accountCode:'33311',debit:0,credit:20000000}]},
  {id:'j2',date:'2026-03-12',documentNo:'CP-01',status:'Posted',projectId:'pr1',description:'Chi phí khảo sát trực tiếp',lines:[{accountCode:'154',debit:30000000,credit:0},{accountCode:'1331',debit:3000000,credit:0},{accountCode:'331',debit:0,credit:33000000}]},
  {id:'j3',date:'2026-03-20',documentNo:'LC-01',status:'Posted',projectId:'pr1',sourceType:'payroll',description:'Lương dự án từ timesheet',lines:[{accountCode:'154',debit:4800000,credit:0},{accountCode:'334',debit:0,credit:4800000}]},
  {id:'j4',date:'2026-03-15',documentNo:'BC-01',cashFlowCode:'01',status:'Posted',projectId:'pr1',description:'Thu tiền khách hàng',lines:[{accountCode:'1121',debit:110000000,credit:0},{accountCode:'131',debit:0,credit:110000000}]},
  {id:'j5',date:'2026-03-20',documentNo:'UNC-01',cashFlowCode:'02',status:'Posted',projectId:'pr1',description:'Thanh toán chi phí khảo sát',lines:[{accountCode:'331',debit:33000000,credit:0},{accountCode:'1121',debit:0,credit:33000000}]}
 ],
 taxInvoices:[{id:'inv1',direction:'Output',date:'2026-03-10',dueDate:'2026-03-20',serial:'AA',invoiceNo:'0001',taxCode:'0101',projectId:'pr1',status:'Valid',taxBase:200000000,vatRate:10,vatAmount:20000000,totalAmount:220000000,deductible:false}],
 paymentAllocations:[{id:'pa1',invoiceId:'inv1',date:'2026-03-15',amount:110000000,status:'Posted'}],
 finance:[
  {id:'f1',date:'2026-03-15',type:'Income',status:'Paid',projectId:'pr1',amount:110000000,journalEntryId:'j4'},
  {id:'f2',date:'2026-03-20',type:'Expense',status:'Paid',projectId:'pr1',amount:33000000,journalEntryId:'j5'}
 ]
};
for(const entry of db.journalEntries) entry.postingHash=C.postingHash(entry);

const projectCheck=C.validateProject(db.projects[0]);
assert.equal(projectCheck.valid,true);
assert.equal(C.validateProject({...db.projects[0],endDate:'2025-01-01'}).valid,false);
const tsCheck=C.validateTimesheet(db,{date:'2026-03-01',personId:'p1',projectId:'pr1',hours:5,description:'Extra'});
assert.equal(tsCheck.valid,false); assert.equal(tsCheck.dailyHours,25);

const actual=C.projectActualCost(db,'pr1',{to:'2026-03-31'});
assert.equal(actual.postedCost,34800000);
assert.equal(actual.postedLaborCost,4800000);
assert.equal(actual.timesheetLaborCost,9600000);
assert.equal(actual.unpostedLaborCost,4800000);
assert.equal(actual.actualCost,39600000);

const aging=C.invoiceAging(db,{direction:'Output',projectId:'pr1',asOf:'2026-03-31',to:'2026-03-31'});
assert.equal(aging.totals.original,220000000);
assert.equal(aging.totals.allocated,110000000);
assert.equal(aging.totals.outstanding,110000000);
assert.equal(aging.rows[0].daysOverdue,11);
assert.equal(aging.rows[0].bucket,'1-30');

const result=C.projectFinancials(db,'pr1',{from:'2026-01-01',to:'2026-03-31'});
assert.equal(result.valid,true);
assert.equal(result.contractValue,500000000);
assert.equal(result.directBudget,200000000);
assert.equal(result.progress,40);
assert.equal(result.progressSource,'weighted-stages');
assert.equal(result.laborCost,9600000);
assert.equal(result.directNonLabor,30000000);
assert.equal(result.actualCost,39600000);
assert.equal(result.earnedValue,80000000);
assert.equal(result.remainingLaborCost,14400000);
assert.equal(result.committedCostToComplete,15000000);
assert.equal(result.expectedRiskCost,5000000);
assert.equal(result.planBasedEAC,74000000);
assert.equal(result.estimateAtCompletion,200000000);
assert.equal(result.eacMethod,'Hybrid conservative forecast');
assert.equal(result.eacConfidence,'Low');
assert.equal(result.forecastProfit,300000000);
assert.equal(result.recognizedRevenue,200000000);
assert.equal(result.actualProfit,160400000);
assert.equal(result.invoicedNet,200000000);
assert.equal(result.invoicedGross,220000000);
assert.equal(result.collectedGross,110000000);
assert.equal(result.collectedNet,100000000);
assert.equal(result.receivableGross,110000000);
assert.equal(result.receivableNet,100000000);
assert.equal(result.backlog,300000000);
assert.equal(result.netProjectCash,77000000);
assert.equal(Math.round(result.contractCollectionRate),20);
assert.equal(Math.round(result.invoiceCollectionRate),50);
assert.equal(Math.round(result.cpi*100)/100,2.02);
assert.equal(result.warnings.some(x=>x.includes('thu trên hóa đơn')),true);

// Project-input hotfix: quick project edits must synchronize the authoritative contract/budget sources used by control KPIs.
const quickDb=JSON.parse(JSON.stringify(db));
quickDb.projects[0].contractValue=600000000;
quickDb.projects[0].directBudget=240000000;
quickDb.projects[0].progress=73;
quickDb.projects[0].progressMode='manual';
let quickId=0;
const sync=C.syncProjectQuickInputs(quickDb,'pr1',{progressMode:'manual',idFactory:(prefix)=>`${prefix}-test-${++quickId}`});
assert.equal(sync.ok,true);
assert.equal(quickDb.contracts[0].valueExclVat,600000000);
assert.equal(quickDb.billingMilestones.reduce((sum,x)=>sum+x.amountExclVat,0),600000000);
assert.equal(quickDb.projectBudgetVersions[0].directBudget,240000000);
assert.equal(quickDb.projectBudgetLines.reduce((sum,x)=>sum+x.amount,0),240000000);
const quickResult=C.projectFinancials(quickDb,'pr1',{from:'2026-01-01',to:'2026-03-31'});
assert.equal(quickResult.contractValue,600000000);
assert.equal(quickResult.directBudget,240000000);
assert.equal(quickResult.progress,73);
assert.equal(quickResult.progressSource,'project-master-manual');

const portfolio=C.portfolioHealth(db,{from:'2026-01-01',to:'2026-03-31'});
assert.equal(portfolio.rows.length,1);
assert.equal(portfolio.actualCost,39600000);
assert.equal(portfolio.estimateAtCompletion,200000000);
assert.equal(portfolio.forecastProfit,300000000);
assert.equal(portfolio.collectedNet,100000000);
assert.equal(Math.round(portfolio.contractCollectionRate),20);

const checks=C.integrityChecks(db,{from:'2026-01-01',to:'2026-03-31'});
assert.equal(checks.checks.find(x=>x.code==='INVOICE_ALLOCATION').pass,true);
assert.equal(checks.checks.find(x=>x.code==='CONTRACT_MILESTONES').pass,true);
assert.equal(checks.checks.find(x=>x.code==='BUDGET_LINES').pass,true);
assert.equal(checks.checks.find(x=>x.code==='PROJECT_EAC_CONFIDENCE').pass,false);


// Regression: approved budget risk reserve is authoritative over a stale project-master value.
const riskDb=JSON.parse(JSON.stringify(db));
riskDb.projects[0].expectedRiskCost=0;
riskDb.projectBudgetVersions[0].expectedRiskCost=9000000;
const riskResult=C.projectFinancials(riskDb,'pr1',{from:'2026-01-01',to:'2026-03-31'});
assert.equal(riskResult.expectedRiskCost,9000000);
assert.equal(riskResult.estimateAtCompletion,200000000);

// Regression: actual project cash must include unapplied receipts, while AR and invoice collection use allocations only.
const cashDb=JSON.parse(JSON.stringify(db));
cashDb.finance[0].amount=150000000;
const cashResult=C.projectFinancials(cashDb,'pr1',{from:'2026-01-01',to:'2026-03-31'});
assert.equal(cashResult.collectedGross,110000000);
assert.equal(cashResult.allocatedGross,110000000);
assert.equal(cashResult.unappliedCashGross,40000000);
assert.equal(cashResult.cashReceivedGross,150000000);
assert.equal(cashResult.receivableGross,110000000);
assert.equal(cashResult.netProjectCash,117000000);
assert.equal(Math.round(cashResult.invoiceCollectionRate),50);
assert.equal(cashResult.warnings.some(x=>x.includes('chưa phân bổ')),true);

// Regression: portfolio legacy collectionRate must not mix gross cash with net contract value.
const cashPortfolio=C.portfolioHealth(cashDb,{from:'2026-01-01',to:'2026-03-31'});
assert.equal(cashPortfolio.collectionRate,cashPortfolio.contractCollectionRate);

// Regression: snake_case contract records from PostgreSQL adapters are accepted.
const snakeDb=JSON.parse(JSON.stringify(db));
snakeDb.contracts=[{id:'c-snake',project_id:'pr1',contract_type:'customer',value_excl_vat:510000000,status:'active'}];
assert.equal(C.projectFinancials(snakeDb,'pr1',{from:'2026-01-01',to:'2026-03-31'}).contractValue,510000000);

console.log('PASS 65 algorithm-first project-control assertions');
