'use strict';
const assert=require('node:assert/strict');
const C=require('../calculation-core.js');
const empty={settings:{maxContractValue:1_000_000_000_000},projects:[{id:'p1'},{id:'p2'}],clients:[{id:'c1'}],people:[],accounts:[],openingBalances:[],accountingPeriods:[],timesheets:[],commitments:[],projectBudgetVersions:[],projectBudgetLines:[],projectStages:[],purchaseOrders:[],tools:[],fixedAssets:[],toolAllocationSchedules:[],depreciationSchedules:[],journalEntries:[],finance:[],paymentAllocations:[]};
const db={...empty,contracts:[
 {id:'c-active',contractNo:'A',contractType:'customer',projectId:'p1',clientId:'c1',status:'Active',signedDate:'2026-01-01',effectiveDate:'2026-01-01',valueExclVat:750_000_000},
 {id:'c-draft',contractNo:'D',contractType:'customer',projectId:'p1',clientId:'c1',status:'Draft',valueExclVat:420_000_000},
 {id:'c-vendor',contractNo:'V',contractType:'vendor',projectId:'p1',status:'Active',valueExclVat:50_000_000},
 {id:'c-future',contractNo:'F',contractType:'customer',projectId:'p2',clientId:'c1',status:'Active',signedDate:'2027-01-01',effectiveDate:'2027-01-01',valueExclVat:200_000_000},
 {id:'c-outlier',contractNo:'BAD',contractType:'customer',projectId:'p2',clientId:'c1',status:'Active',signedDate:'2026-01-01',valueExclVat:111_111_111_111_111_100}
],billingMilestones:[{id:'m1',contractId:'c-active',projectId:'wrong',status:'Draft',acceptanceStatus:'Not started',invoiceStatus:'Not invoiced',paymentStatus:'Unpaid',amountExclVat:300_000_000}],taxInvoices:[{id:'i1',contractId:'c-active',projectId:'p1',direction:'Output',date:'2026-02-01',status:'Valid',taxBase:200_000_000,vatAmount:20_000_000,totalAmount:220_000_000}]};
const summary=C.contractRegisterSummary(db,{to:'2026-12-31'});
assert.equal(summary.contractValue,750_000_000,'Draft/vendor/future/outlier must not inflate committed contract value');
assert.equal(summary.invoicedNet,200_000_000);
assert.equal(summary.backlogNet,550_000_000);
assert.equal(summary.outliers.length,1);
assert.equal(C.contractDeletionPlan(db,'c-draft').allowed,true);
assert.equal(C.contractDeletionPlan(db,'c-active').mode,'cancel','linked invoice must protect contract history');
const repaired=C.repairExactLinks(db);
assert.equal(db.billingMilestones[0].projectId,'p1','milestone project must inherit exact contract project');
assert.ok(repaired.repairs.some(x=>x.type==='milestone-project'));
const integrity=C.integrityChecks(db,{to:'2026-12-31'});
assert.equal(integrity.checks.find(x=>x.code==='CONTRACT_VALUE_OUTLIER').pass,false);
console.log('PASS contract summary, safe deletion, outlier control and exact linkage repair');
