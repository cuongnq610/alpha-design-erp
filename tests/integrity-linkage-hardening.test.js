const assert=require('node:assert/strict');
const Calc=require('../calculation-core.js');

const db={
  people:[{id:'p1',code:'E001'}],clients:[{id:'c1',code:'C001',taxCode:'0101'}],vendors:[{id:'v1',code:'V001',taxCode:'0202'}],
  accounts:[{id:'a1',code:'1111'},{id:'a2',code:'5113'},{id:'a3',code:'6422'},{id:'a4',code:'242'},{id:'a5',code:'2141'},{id:'a6',code:'2112'}],
  projects:[{id:'pr1',code:'PR001',clientId:'c1',pmId:'p1',startDate:'2026-01-01',endDate:'2026-12-31'}],
  tasks:[{id:'t1',projectId:'pr1',assigneeId:'p1',startDate:'2026-01-02',dueDate:'2026-01-03'}],
  timesheets:[{id:'ts1',projectId:'pr1',personId:'p1',date:'2026-01-03',hours:8}],
  finance:[{id:'f1',projectId:'pr1',date:'2026-01-05',amount:110,status:'Paid',type:'Income',journalEntryId:'je1'}],
  quotes:[{id:'q1',clientId:'c1',projectId:'pr1',date:'2026-01-01'}],
  approvals:[{id:'ap1',requesterId:'p1',projectId:'pr1',date:'2026-01-01'}],
  documents:[{id:'d1',projectId:'pr1',ownerId:'p1',date:'2026-01-01'}],
  openingBalances:[{id:'ob1',accountCode:'1111',asOfDate:'2026-01-01'}],
  journalEntries:[{id:'je1',date:'2026-01-05',projectId:'pr1',partnerType:'client',partnerId:'c1',lines:[{id:'jl1',accountCode:'1111',debit:110,credit:0,projectId:'pr1'},{id:'jl2',accountCode:'5113',debit:0,credit:110,partnerType:'client',partnerId:'c1'}]}],
  contracts:[{id:'ct1',contractNo:'CT001',projectId:'pr1',clientId:'c1',ownerId:'p1',signedDate:'2026-01-01',effectiveDate:'2026-01-01',expiryDate:'2026-12-31',valueExclVat:100,vatRate:10,status:'Active'}],
  taxInvoices:[{id:'i1',date:'2026-01-05',dueDate:'2026-02-05',projectId:'pr1',contractId:'ct1',journalEntryId:'je1',partnerType:'client',partnerId:'c1',direction:'Output',invoiceNo:'1',taxCode:'0101',taxBase:100,vatRate:10,vatAmount:10,totalAmount:110,status:'Valid'}],
  pitWithholdings:[{id:'pit1',date:'2026-01-05',recipientType:'vendor',recipientId:'v1',journalEntryId:'je1'}],
  citAdjustments:[{id:'cit1',date:'2026-01-05',projectId:'pr1'}],
  taxFilings:[{id:'tf1',dueDate:'2026-01-31'}],
  billingMilestones:[{id:'bm1',contractId:'ct1',projectId:'pr1',invoiceId:'i1',dueDate:'2026-01-05',percentage:100,amountExclVat:100}],
  paymentAllocations:[{id:'pa1',paymentId:'f1',invoiceId:'i1',date:'2026-01-05',amount:110,status:'Posted'}],
  projectBudgetVersions:[{id:'bv1',projectId:'pr1',effectiveFrom:'2026-01-01'}],
  projectBudgetLines:[{id:'bl1',budgetVersionId:'bv1',quantity:1,unitRate:100,amount:100}],
  resourcePlans:[{id:'rp1',projectId:'pr1',personId:'p1',month:'2026-01'}],
  commitments:[{id:'cm1',projectId:'pr1',dueDate:'2026-01-30',amount:10,recognizedAmount:0}],
  projectStages:[{id:'ps1',projectId:'pr1',plannedStart:'2026-01-01',plannedEnd:'2026-01-31'}],
  purchaseRequests:[{id:'req1',requestNo:'REQ1',requesterId:'p1',projectId:'pr1',date:'2026-01-01',quantity:1,unitPrice:10,vatRate:10}],
  purchaseOrders:[{id:'po1',poNo:'PO1',purchaseRequestId:'req1',vendorId:'v1',projectId:'pr1',custodianId:'p1',journalEntryId:'je1',orderDate:'2026-01-02',invoiceDate:'2026-01-03',quantity:1,unitPrice:10,vatRate:10,toolId:'tool1'}],
  tools:[{id:'tool1',toolCode:'TOOL1',purchaseOrderId:'po1',projectId:'pr1',custodianId:'p1',expenseAccountCode:'6422',startDate:'2026-01-03',originalCost:10,allocationMonths:1}],
  fixedAssets:[{id:'fa1',assetCode:'FA1',purchaseOrderId:'po1',projectId:'pr1',custodianId:'p1',assetAccountCode:'2112',depreciationAccountCode:'2141',expenseAccountCode:'6422',acquisitionDate:'2026-01-03',inServiceDate:'2026-01-04',originalCost:100,residualValue:1,usefulLifeMonths:13}],
  toolAllocationSchedules:[{id:'sch1',sourceId:'tool1',journalEntryId:'je1',period:'2026-01',amount:10}],
  depreciationSchedules:[{id:'sch2',sourceId:'fa1',journalEntryId:'je1',period:'2026-01',amount:99}],
  accountingPeriods:[{id:'per1',from:'2026-01-01',to:'2026-12-31'}],
  financialForecastScenarios:[],financialAnalysisSnapshots:[],financialLinkAuditRuns:[],exportLogs:[],importLogs:[]
};
assert.deepEqual(Calc.dataLinkAudit(db),[],'Valid cross-module links must pass');
const broken=structuredClone(db);broken.billingMilestones[0].projectId='missing';broken.journalEntries[0].lines[0].accountCode='9999';broken.purchaseOrders[0].vendorId='missing';broken.fixedAssets[0].inServiceDate='2026-02-30';
const issues=Calc.dataLinkAudit(broken);
assert.ok(issues.some(x=>x.collection==='billingMilestones'&&x.field==='projectId'));
assert.ok(issues.some(x=>x.collection==='journalEntries'&&x.field==='accountCode'));
assert.ok(issues.some(x=>x.collection==='purchaseOrders'&&x.field==='vendorId'));
assert.ok(issues.some(x=>x.collection==='fixedAssets'&&x.reason==='invalid_date'));

assert.equal(Calc.classifyPurchase({quantity:0,unitPrice:5000,usefulLifeMonths:1,category:'paper'}).totalExclVat,0,'Explicit zero quantity must not silently become one');
assert.throws(()=>Calc.straightLineSchedule({sourceId:'x',startDate:'2026-13-01',cost:100,months:3}),/Ngày bắt đầu/);
assert.throws(()=>Calc.straightLineSchedule({sourceId:'x',startDate:'2026-01-01',cost:100,months:0}),/Số tháng/);
assert.throws(()=>Calc.straightLineSchedule({sourceId:'x',startDate:'2026-01-01',cost:100,residualValue:101,months:3}),/Giá trị thu hồi/);
const schedule=Calc.straightLineSchedule({sourceId:'x',startDate:'2026-12-31',cost:100,residualValue:1,months:7,kind:'asset'});
assert.equal(schedule.length,7);assert.equal(schedule.reduce((s,x)=>s+x.amount,0),99);assert.equal(schedule[0].period,'2026-12');assert.equal(schedule.at(-1).period,'2027-06');
assert.throws(()=>Calc.periodicJournalBlueprint({amount:0}),/lớn hơn 0/);
assert.equal(Calc.contractValueOutliers({contracts:[{id:'zero',valueExclVat:0}],settings:{}}).length,1,'Zero-value contracts must be rejected');
console.log(`PASS v4.5.4 comprehensive data-link audit (${Object.keys(db).length} data groups), strict schedule inputs and deterministic VND totals`);
