'use strict';
const assert=require('assert/strict');
const C=require('../calculation-core.js');
const account=(code,type,normalSide)=>({id:`a-${code}`,code,name:code,type,normalSide:normalSide||(type==='Asset'||type==='Expense'?'Debit':'Credit')});
const entry=(id,date,lines,extra={})=>({id,date,documentNo:id,status:'Posted',postingHash:'',allowLegacyHash:true,lines,...extra});
const accounts=[
  account('1111','Asset'),account('1121','Asset'),account('131','Asset'),account('1331','Asset'),account('154','Asset'),
  account('2112','Asset'),account('2141','Asset','Credit'),account('242','Asset'),
  account('331','Liability'),account('33311','Liability'),account('334','Liability'),account('3411','Liability'),
  account('4111','Equity'),account('5113','Revenue'),account('632','Expense'),account('635','Expense'),account('6422','Expense'),account('821','Expense')
];
const db={
  settings:{fiscalYearStart:'01-01',targetMargin:30,targetNetMargin:12,overheadMonthly:0,employerBurdenRate:0,defaultVatRate:10,corporateTaxRate:20,minimumCashBuffer:50},
  accounts,
  openingBalances:[
    {accountCode:'1121',debit:100,credit:0,asOfDate:'2026-01-01'},
    {accountCode:'131',debit:100,credit:0,asOfDate:'2026-01-01'},
    {accountCode:'154',debit:100,credit:0,asOfDate:'2026-01-01'},
    {accountCode:'2112',debit:200,credit:0,asOfDate:'2026-01-01'},
    {accountCode:'2141',debit:0,credit:50,asOfDate:'2026-01-01'},
    {accountCode:'331',debit:0,credit:100,asOfDate:'2026-01-01'},
    {accountCode:'4111',debit:0,credit:350,asOfDate:'2026-01-01'}
  ],
  journalEntries:[
    entry('rev','2026-03-01',[{accountCode:'131',debit:120,credit:0},{accountCode:'5113',debit:0,credit:120}],{projectId:'p1',partnerType:'client',partnerId:'c1'}),
    entry('cogs','2026-03-02',[{accountCode:'632',debit:60,credit:0},{accountCode:'154',debit:0,credit:60}],{projectId:'p1'}),
    entry('collect','2026-03-10',[{accountCode:'1121',debit:80,credit:0},{accountCode:'131',debit:0,credit:80}],{projectId:'p1',partnerType:'client',partnerId:'c1',cashFlowCode:'01'}),
    entry('pay','2026-03-12',[{accountCode:'331',debit:40,credit:0},{accountCode:'1121',debit:0,credit:40}],{cashFlowCode:'02'}),
    entry('admin','2026-03-15',[{accountCode:'6422',debit:20,credit:0},{accountCode:'331',debit:0,credit:20}]),
    entry('interest','2026-03-20',[{accountCode:'635',debit:5,credit:0},{accountCode:'331',debit:0,credit:5}])
  ],
  people:[],projects:[],contracts:[],billingMilestones:[],taxInvoices:[],paymentAllocations:[],finance:[],quotes:[],tasks:[],timesheets:[],clients:[],vendors:[],purchaseOrders:[],tools:[],fixedAssets:[],toolAllocationSchedules:[],depreciationSchedules:[],commitments:[],projectBudgetVersions:[],projectBudgetLines:[],projectStages:[]
};
const pos=C.financialPosition(db,'2026-12-31');
assert.equal(pos.cash,140);
assert.equal(pos.receivables,140);
assert.equal(pos.inventoryAndWip,40);
assert.equal(pos.totalAssets,470);
assert.equal(pos.currentLiabilities,85);
assert.equal(pos.totalEquity,385);
assert.equal(pos.balanceGap,0);
assert.equal(pos.balanced,true);
const b03=C.tt133B03Direct(db,{from:'2026-01-01',to:'2026-12-31'});
assert.equal(b03.opening,100,'B03 opening cash must include balances effective on the first day of the period');
assert.equal(b03.net,40);assert.equal(b03.closing,140);assert.equal(b03.reconciled,true);
const b01=C.tt133B01a(db,{from:'2026-01-01',to:'2026-12-31'});
assert.equal(b01.rows.find(x=>x.code==='270').start,450,'B01 opening position must include first-day opening balances without first-day journal movement');
const before=C.financialPosition(db,'2025-12-31');
assert.equal(before.totalAssets,0,'future-dated opening balances must not leak into earlier periods');
const ratios=C.financialRatios(db,{from:'2026-01-01',to:'2026-12-31'});
const metric=id=>ratios.metrics.find(x=>x.id===id);
assert(Math.abs(metric('currentRatio').value-320/85)<1e-9);
assert(Math.abs(metric('grossMargin').value-50)<1e-9);
assert(Math.abs(metric('interestCoverage').value-8)<1e-9);
assert(Math.abs(metric('operatingCashRatio').value-40/85)<1e-9,'operating cash ratio must use CFO, not total net cash');
assert(Math.abs(metric('roa').value-35/460*100)<1e-9,'ROA must use average opening/closing assets');
assert(Math.abs(metric('roe').value-35/367.5*100)<1e-9,'ROE must use average opening/closing equity');
assert.equal(metric('inventoryTurnover').value,60/70);
assert.equal(metric('cashConversionCycle').unit,'ngày');
const firstDayPayableDb={...db,journalEntries:[entry('opening-day-ap','2026-01-01',[{accountCode:'6422',debit:30,credit:0},{accountCode:'331',debit:0,credit:30}]),...db.journalEntries]};
const firstDayRatios=C.financialRatios(firstDayPayableDb,{from:'2026-01-01',to:'2026-12-31'});
const expectedDpo=((100+115)/2)/60*365;
assert(Math.abs(firstDayRatios.metrics.find(x=>x.id==='dpo').value-expectedDpo)<1e-9,'DPO opening payables must include first-day opening balances but exclude first-day journal movement');
assert.equal(C.financialRatios({...db,openingBalances:[],journalEntries:[]},{from:'2026-01-01',to:'2026-12-31'}).metrics.find(x=>x.id==='currentRatio').value,null,'zero denominator must be N/A');

const forecastDb={
  ...db,
  settings:{...db.settings,overheadMonthly:0},openingBalances:[{accountCode:'1121',debit:1000,credit:0,asOfDate:'2026-01-01'},{accountCode:'4111',debit:0,credit:1000,asOfDate:'2026-01-01'}],journalEntries:[],
  people:[],clients:[{id:'c1'}],vendors:[],
  projects:[{id:'p1',code:'P1',name:'P1',status:'In Progress',startDate:'2026-01-01',endDate:'2026-12-31',contractValue:600,directBudget:300,progress:20}],
  contracts:[{id:'ct1',projectId:'p1',clientId:'c1',status:'Active',valueExclVat:600}],
  billingMilestones:[{id:'m1',contractId:'ct1',projectId:'p1',amountExclVat:300,dueDate:'2026-09-30',status:'Active',invoiceStatus:'Not invoiced'}],
  quotes:[{id:'q1',projectId:'p2',amount:100,probability:50,status:'Proposal'}],
  taxInvoices:[],paymentAllocations:[],finance:[],commitments:[],purchaseOrders:[],depreciationSchedules:[{sourceId:'a1',kind:'asset',period:'2026-07',amount:10,journalEntryId:'d1'}],toolAllocationSchedules:[],fixedAssets:[],tools:[],tasks:[],timesheets:[],projectBudgetVersions:[{id:'b1',projectId:'p1',status:'Approved',effectiveFrom:'2026-01-01',directBudget:300}],projectBudgetLines:[],projectStages:[]
};
const scenario={collectionRatePercent:100,directCostRatioPercent:50,pipelineFactorPercent:100,pipelineLagMonths:0,pipelineDeliveryMonths:2,recurringRevenueShare:0,payrollGrowthPercent:0,overheadGrowthPercent:0,taxRatePercent:0,minimumCashBuffer:0};
const f=C.financialForecast(forecastDb,{asOf:'2026-06-30',months:6,scenario});
assert.equal(f.keys.length,6);
assert.equal(C.vnd(f.backlogRevenue.reduce((a,b)=>a+b,0)),600,'backlog beyond first forecast month must spread through project end/horizon');
assert.equal(C.vnd(f.pipelineRevenue.reduce((a,b)=>a+b,0)),50);
assert.equal(f.nonCashExpense[0],10);
assert.equal(f.operatingCost[0]-f.cashOperatingCost[0],10,'depreciation/allocation must affect P&L but not cash out');
assert.equal(f.cashOut[0],f.cashOperatingCost[0],'non-cash depreciation must not inflate cash out');
assert.equal(f.closingCash.length,6);
assert.equal(f.lineage.cashOut.includes('non-cash depreciation excluded'),true);
const conservative=C.financialForecast(forecastDb,{asOf:'2026-06-30',months:6,scenario:{...scenario,pipelineFactorPercent:0,directCostRatioPercent:70}});
assert(conservative.totalRevenue<f.totalRevenue);
assert(conservative.totalProfit<f.totalProfit);

const linkDb={
  settings:{},accounts:[account('1121','Asset'),account('131','Asset'),account('5113','Revenue'),account('4111','Equity')],openingBalances:[{accountCode:'1121',debit:100,credit:0},{accountCode:'4111',debit:0,credit:100}],
  people:[{id:'u1'}],clients:[{id:'c1'}],vendors:[],projects:[{id:'p1',code:'P',name:'P',status:'In Progress',startDate:'2026-01-01',endDate:'2026-12-31',contractValue:100,directBudget:50,progress:10}],
  contracts:[{id:'ct1',projectId:'p1',clientId:'c1',status:'Active',valueExclVat:100}],billingMilestones:[{id:'m1',contractId:'ct1',projectId:'p1',amountExclVat:100,status:'Active'}],quotes:[],
  journalEntries:[entry('j1','2026-02-01',[{accountCode:'131',debit:110,credit:0},{accountCode:'5113',debit:0,credit:100},{accountCode:'33311',debit:0,credit:10}],{projectId:'p1',partnerType:'client',partnerId:'c1'}),entry('j2','2026-02-10',[{accountCode:'1121',debit:110,credit:0},{accountCode:'131',debit:0,credit:110}],{projectId:'p1',partnerType:'client',partnerId:'c1',cashFlowCode:'01'})],
  taxInvoices:[{id:'i1',direction:'Output',date:'2026-02-01',status:'Valid',partnerType:'client',partnerId:'c1',projectId:'p1',contractId:'ct1',taxBase:100,vatAmount:10,totalAmount:110,paymentStatus:'Paid',journalEntryId:'j1'}],paymentAllocations:[{id:'pa1',invoiceId:'i1',date:'2026-02-10',amount:110,status:'Posted'}],finance:[{id:'f1',date:'2026-02-10',type:'Income',status:'Paid',amount:110,projectId:'p1'}],
  tasks:[{id:'t1',projectId:'p1',assigneeId:'u1'}],timesheets:[{id:'ts1',date:'2026-02-01',projectId:'p1',personId:'u1',hours:8,approved:true}],documents:[],purchaseOrders:[],tools:[],fixedAssets:[],toolAllocationSchedules:[],depreciationSchedules:[],projectBudgetVersions:[{id:'b1',projectId:'p1',status:'Approved',effectiveFrom:'2026-01-01',directBudget:50}],projectBudgetLines:[],projectStages:[],commitments:[]
};
const repair=C.repairExactLinks(linkDb);
assert.equal(repair.count,1);
assert.equal(linkDb.finance[0].journalEntryId,'j2');
assert.equal(C.repairExactLinks(linkDb).count,0,'repair must be idempotent');
const audit=C.financialLinkAudit(linkDb,{from:'2026-01-01',to:'2026-12-31'});
assert.equal(audit.rows.find(x=>x.id==='PROJECT_CONTRACT').pass,true);
assert.equal(audit.rows.find(x=>x.id==='FINANCE_JOURNAL').pass,true);
assert.equal(audit.rows.find(x=>x.id==='INVOICE_ALLOCATION').pass,true);
assert.equal(audit.rows.find(x=>x.id==='TASK_MASTER').pass,true);
const broken=JSON.parse(JSON.stringify(linkDb));broken.tasks[0].projectId='missing';
const brokenAudit=C.financialLinkAudit(broken,{from:'2026-01-01',to:'2026-12-31'});
assert.equal(brokenAudit.rows.find(x=>x.id==='TASK_MASTER').pass,false);
assert.equal(brokenAudit.passCritical,false);
console.log('PASS financial analytics, ratio, forecast and linkage assertions');
