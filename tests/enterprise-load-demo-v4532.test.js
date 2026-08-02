'use strict';
const assert = require('node:assert/strict');
const C = require('../calculation-core.js');
const Demo = require('../demo-enterprise-seed.js');

const accounts = [
  ['1121','Asset','Debit'],['131','Asset','Debit'],['1331','Asset','Debit'],['154','Asset','Debit'],
  ['331','Liability','Credit'],['33311','Liability','Credit'],['5113','Revenue','Credit'],['632','Expense','Debit']
].map(([code,type,normalSide])=>({id:`a-${code}`,code,name:code,type,normalSide,active:true,postable:true}));
const base = {
  version:'4.5.32',
  settings:{monthlyWorkingHours:176,employerBurdenRate:0,defaultVatRate:10,corporateTaxRate:20,targetMargin:30,overheadMonthly:0},
  people:[],clients:[],vendors:[
    {id:'v1',code:'V1',name:'CTV Demo',taxCode:'001206012345',type:'Individual',status:'Active'},
    {id:'v2',code:'V2',name:'Nhà cung cấp Demo',taxCode:'0101234567',type:'Company',status:'Active'}
  ],accounts,openingBalances:[],accountingPeriods:[],projects:[],tasks:[],timesheets:[],contracts:[],journalEntries:[],finance:[],quotes:[],approvals:[],documents:[],taxInvoices:[],pitWithholdings:[],citAdjustments:[],taxFilings:[],billingMilestones:[],paymentAllocations:[],projectBudgetVersions:[],projectBudgetLines:[],resourcePlans:[],commitments:[],projectStages:[],purchaseRequests:[],purchaseOrders:[],tools:[],fixedAssets:[],toolAllocationSchedules:[],depreciationSchedules:[],financialForecastScenarios:[]
};
const db = Demo.createEnterpriseDemo(base,{peopleCount:100,projectCount:48,committedProjectCount:40});
const r={from:'2026-01-01',to:'2026-12-31'};

assert.equal(db.people.length,100,'must generate exactly 100 people');
assert.equal(db.projects.length,48,'must generate exactly 48 projects');
assert.equal(db.projects.filter(x=>x.contractValue>10_000_000_000).length,48,'all generated projects must exceed 10B VND');
assert.equal(db.timesheets.length,576,'12 timesheets per project');
assert.equal(db.tasks.length,192,'4 tasks per project');
assert.equal(db.contracts.length,48,'one customer contract per project');
assert.equal(db.projectBudgetVersions.length,48,'one approved baseline per project');
assert.equal(db.projectBudgetLines.length,240,'five budget lines per project');
assert.equal(db.projectStages.length,192,'four stages per project');
assert.equal(db.resourcePlans.length,192,'four resource plans per project');
assert.equal(db.commitments.length,96,'two commitments per project');

const expected=db.demoScenario.expected;
const portfolio=C.portfolioHealth(db,{to:r.to});
assert.equal(portfolio.activeProjectCount,40,'committed project count');
assert.equal(portfolio.pipelineCount,8,'pipeline project count');
assert.equal(portfolio.contractValue,expected.addedContractValue,'portfolio committed contract value');
assert.equal(portfolio.pipelineValue,expected.addedPipelineValue,'portfolio pipeline value');

const vat=C.vatRegisterSummary(db,r);
assert.equal(vat.output,expected.addedOutputVat,'output VAT');
assert.equal(vat.inputDeductible,expected.addedInputVat,'deductible input VAT');
assert.equal(vat.payable,Math.max(0,expected.addedOutputVat-expected.addedInputVat),'VAT payable');

const cash=C.cashFlow(db,r);
assert.equal(cash.cashIn,expected.addedCashIn,'cash in');
assert.equal(cash.cashOut,expected.addedCashOut,'cash out');
assert.equal(cash.net,expected.addedCashIn-expected.addedCashOut,'net cash');

const pnl=C.profitAndLoss(db,r);
assert.equal(pnl.revenue,expected.addedRevenue,'recognized revenue');
assert.equal(pnl.expenseBeforeTax,expected.addedRecognizedCost,'recognized direct cost');
assert.equal(pnl.profitBeforeTax,expected.addedRevenue-expected.addedRecognizedCost,'profit before tax');

const trial=C.trialBalance(db,r);
assert.equal(trial.balanced,true,'trial balance must be balanced');
assert.equal(trial.totals.debit,trial.totals.credit,'trial balance debit equals credit');

let projectChecks=0;
for(const project of db.projects){
  const committed=C.projectLifecycle(project)!=='pipeline';
  const ts=db.timesheets.filter(x=>x.projectId===project.id&&x.approved===true);
  const expectedLabor=C.vnd(ts.reduce((sum,row)=>{
    const person=db.people.find(p=>p.id===row.personId);
    return sum+Number(row.hours||0)*C.costPerHour(person,db.settings);
  },0));
  const financeExpense=db.finance.filter(x=>x.projectId===project.id&&x.type==='Expense'&&x.status==='Paid').reduce((s,x)=>s+C.vnd(x.amount),0);
  const lowLevel=C.projectCost(db,project.id,r);
  assert.equal(lowLevel.labor,expectedLabor,`labor ${project.id}`);
  assert.equal(lowLevel.directNonLabor,financeExpense,`direct finance ${project.id}`);
  assert.equal(lowLevel.total,expectedLabor+financeExpense,`project cost ${project.id}`);
  const pf=C.projectFinancials(db,project.id,{to:r.to});
  if(committed){
    const input=db.taxInvoices.find(x=>x.projectId===project.id&&x.direction==='Input');
    assert.equal(pf.contractValue,project.contractValue,`contract ${project.id}`);
    assert.equal(pf.actualCost,C.vnd(expectedLabor+Number(input.taxBase||0)),`actual cost ${project.id}`);
    const output=db.taxInvoices.find(x=>x.projectId===project.id&&x.direction==='Output');
    const allocation=db.paymentAllocations.find(x=>x.invoiceId===output.id);
    assert.equal(pf.receivable,C.vnd(output.totalAmount-allocation.amount),`receivable ${project.id}`);
  } else {
    assert.equal(pf.contractValue,0,`pipeline contract excluded ${project.id}`);
    assert.equal(pf.pipelineValue,project.contractValue,`pipeline value ${project.id}`);
  }
  projectChecks+=committed?7:5;
}

for(const entry of db.journalEntries){
  const validation=C.entryValidation(db,entry,entry.id);
  assert.equal(validation.valid,true,`journal ${entry.id}: ${(validation.errors||[]).join('; ')}`);
}

const aging=C.invoiceAging(db,{direction:'Output',from:r.from,to:r.to,asOf:r.to});
const expectedOutstanding=db.taxInvoices.filter(x=>x.direction==='Output').reduce((sum,invoice)=>{
  const allocated=db.paymentAllocations.filter(a=>a.invoiceId===invoice.id&&a.status==='Posted').reduce((s,a)=>s+C.vnd(a.amount),0);
  return sum+Math.max(0,C.vnd(invoice.totalAmount)-allocated);
},0);
assert.equal(aging.totals.outstanding,C.vnd(expectedOutstanding),'aging outstanding');

const utilization=C.peopleUtilization(db,r);
assert.equal(utilization.length,100,'utilization covers all 100 people');
assert.equal(C.vnd(utilization.reduce((s,x)=>s+x.hours,0)),C.vnd(db.timesheets.filter(x=>x.approved===true).reduce((s,x)=>s+Number(x.hours||0),0)),'approved utilization hours');

const result={
  status:'PASS',releaseVersion:'4.5.32',scenario:db.demoScenario.id,
  records:{people:db.people.length,projects:db.projects.length,projectsOver10B:db.demoScenario.projectsOver10B,tasks:db.tasks.length,timesheets:db.timesheets.length,journals:db.journalEntries.length,journalLines:db.journalEntries.reduce((s,x)=>s+x.lines.length,0),taxInvoices:db.taxInvoices.length,total:db.demoScenario.totalRecords},
  checks:{projectChecks,journalChecks:db.journalEntries.length,coreReconciliations:24,total:projectChecks+db.journalEntries.length+24},
  totals:{contractValue:portfolio.contractValue,pipelineValue:portfolio.pipelineValue,revenue:pnl.revenue,recognizedCost:pnl.expenseBeforeTax,cashIn:cash.cashIn,cashOut:cash.cashOut,vatOutput:vat.output,vatInput:vat.inputDeductible,receivable:aging.totals.outstanding}
};
console.log(JSON.stringify(result,null,2));
