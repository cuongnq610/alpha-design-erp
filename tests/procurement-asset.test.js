'use strict';
const assert=require('assert');
const Calc=require('../calculation-core.js');

const settings={fixedAssetThreshold:30000000,toolMaxAllocationMonths:36};
assert.equal(Calc.classifyPurchase({category:'Office supplies',quantity:1,unitPrice:6500000,usefulLifeMonths:1},settings).classification,'expense');
assert.equal(Calc.classifyPurchase({category:'Printer',quantity:1,unitPrice:24000000,usefulLifeMonths:36},settings).classification,'tool');
assert.equal(Calc.classifyPurchase({category:'Vehicle',quantity:1,unitPrice:850000000,usefulLifeMonths:96},settings).classification,'fixed_asset');

const schedule=Calc.straightLineSchedule({sourceId:'tool1',startDate:'2026-07-19',cost:24000001,residualValue:0,months:24,kind:'tool'});
assert.equal(schedule.length,24);
assert.equal(schedule[0].period,'2026-07');
assert.equal(schedule.at(-1).period,'2028-06');
assert.equal(schedule.reduce((s,x)=>s+x.amount,0),24000001);
assert.ok(schedule.every(x=>Number.isInteger(x.amount)));

const poTool=Calc.purchaseJournalBlueprint({itemName:'Máy in',category:'Printer',quantity:1,unitPrice:24000000,vatRate:10,usefulLifeMonths:36,paymentMethod:'Payable',vendorId:'v2'},settings);
assert.equal(poTool.classification,'tool');
assert.equal(poTool.lines.find(x=>x.accountCode==='242').debit,24000000);
assert.equal(poTool.lines.find(x=>x.accountCode==='1331').debit,2400000);
assert.equal(poTool.lines.find(x=>x.accountCode==='331').credit,26400000);

const poCar=Calc.purchaseJournalBlueprint({itemName:'Xe ô tô',category:'Vehicle',quantity:1,unitPrice:850000000,vatRate:10,usefulLifeMonths:96,paymentMethod:'Bank'},settings);
assert.equal(poCar.classification,'fixed_asset');
assert.equal(poCar.lines.find(x=>x.accountCode==='2113').debit,850000000);
assert.equal(poCar.lines.find(x=>x.accountCode==='1121').credit,935000000);

const alloc=Calc.periodicJournalBlueprint({date:'2026-08-28',amount:1000000,expenseAccountCode:'6422',creditAccountCode:'242',description:'Phân bổ máy in'});
assert.equal(alloc.lines[0].debit,1000000);
assert.equal(alloc.lines[1].credit,1000000);

const db={accounts:[],projects:[],people:[],clients:[],taxInvoices:[],journalEntries:[],timesheets:[],paymentAllocations:[],commitments:[],contracts:[],billingMilestones:[],projectBudgetVersions:[],projectBudgetLines:[],projectStages:[],finance:[],purchaseOrders:[{id:'po1'}],tools:[{id:'t1',purchaseOrderId:'po1',originalCost:24000001}],fixedAssets:[],toolAllocationSchedules:schedule.map(x=>({...x,sourceId:'t1'})),depreciationSchedules:[]};
const report=Calc.integrityChecks(db,{to:'2026-12-31'});
assert.ok(report.checks.find(x=>x.code==='ASSET_SCHEDULE_TOTAL').pass);
assert.ok(report.checks.find(x=>x.code==='PROCUREMENT_REFERENCES').pass);
console.log('PASS procurement and asset accounting assertions');
