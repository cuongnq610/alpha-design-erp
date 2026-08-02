import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
const require=createRequire(import.meta.url);const C=require('../calculation-core.js');
const approved={citRateMode:'Auto',citReducedRateEligibility:'Approved',citExemptionEligibility:'Rejected',citReducedRateEffectiveYear:2025,citStandardRate:20};
const boundaries=[[0,15],[3_000_000_000,15],[3_000_000_001,17],[49_999_999_999,17],[50_000_000_000,17],[50_000_000_001,20]];
for(const [revenue,expected] of boundaries)assert.equal(C.citRate({...approved,previousYearTaxRevenueBasis:revenue},{taxYear:2026}),expected,`CIT boundary ${revenue}`);
assert.equal(C.citRate({...approved,previousYearTaxRevenueBasis:50_000_000_000,citReducedRateEligibility:'Unreviewed'},{taxYear:2026}),20,'Reduced rate must fail closed without approval');
const accounts=[['1121','Asset','Debit'],['131','Asset','Debit'],['331','Liability','Credit'],['33311','Liability','Credit'],['5113','Revenue','Credit'],['6422','Expense','Debit'],['8211','Expense','Debit']].map(([code,type,normalSide])=>({code,type,normalSide,active:true,postable:true}));
const db={settings:{...approved,previousYearTaxRevenueBasis:50_000_000_000},accounts,openingBalances:[],journalEntries:[
{id:'r1',date:'2026-01-02',documentNo:'DT-001',status:'Posted',projectId:'p1',partnerType:'client',partnerId:'c1',lines:[{accountCode:'131',debit:110_000_000,credit:0},{accountCode:'5113',debit:0,credit:100_000_000},{accountCode:'33311',debit:0,credit:10_000_000}]},
{id:'e1',date:'2026-01-03',documentNo:'CP-001',status:'Posted',projectId:'p1',partnerType:'vendor',partnerId:'v1',lines:[{accountCode:'6422',debit:20_000_000,credit:0},{accountCode:'331',debit:0,credit:20_000_000}]}
],citAdjustments:[],projects:[],people:[],timesheets:[],finance:[],taxInvoices:[],paymentAllocations:[],clients:[{id:'c1'}],vendors:[{id:'v1'}],contracts:[],billingMilestones:[],quotes:[],tasks:[],purchaseOrders:[],tools:[],fixedAssets:[],toolAllocationSchedules:[],depreciationSchedules:[],commitments:[],projectBudgetVersions:[],projectBudgetLines:[],projectStages:[]};
for(const row of db.journalEntries)row.postingHash=C.postingHash(row);
const tb=C.trialBalance(db,{from:'2026-01-01',to:'2026-12-31'});assert.equal(tb.balanced,true);assert.equal(tb.totals.debit,tb.totals.credit);
const pnl=C.profitAndLoss(db,{from:'2026-01-01',to:'2026-12-31'});assert.equal(pnl.revenue,100_000_000);assert.equal(pnl.profitBeforeTax,80_000_000);
const cit=C.citEstimate(db,{from:'2026-01-01',to:'2026-12-31'});assert.equal(cit.rate,17);assert.equal(cit.tax,13_600_000);
const bad=structuredClone(db);bad.journalEntries[0].lines[0].debit+=1;assert.equal(C.entryValidation(bad,bad.journalEntries[0],bad.journalEntries[0].id).valid,false,'Unbalanced journal must fail');
const harness=fs.readFileSync(new URL('../scripts/ui-structural-browser-audit-v4525.py',import.meta.url),'utf8');assert.ok(harness.includes(".dashboard-core-grid>.kpi-card"));assert.ok(!harness.includes(".dashboard-kpi-grid>.kpi-card"));
const meta=JSON.parse(fs.readFileSync(new URL('../VERSION.json',import.meta.url),'utf8'));assert.equal(meta.version,'4.5.67');assert.equal(meta.databaseMigration,75);assert.equal(meta.productionApproval,false);
console.log(`PASS v4.5.67 deep accounting/finance regression: ${boundaries.length} CIT boundaries, double-entry, P&L, CIT estimate, fail-closed journal and QA-harness scope`);
