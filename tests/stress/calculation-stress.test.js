'use strict';
const assert=require('assert/strict');
const {performance}=require('perf_hooks');
require('../../calculation-core.js');
const C=global.AlphaCalc;
const ENTRY_COUNT=10000; // 100,000 journal lines
const db={
 settings:{standardMonthlyHours:160,monthlyWorkingHours:160,employerBurdenRate:0,previousYearTaxRevenueBasis:10000000000,citRateMode:'Auto'},
 accounts:[
  {code:'1121',name:'Tiền gửi ngân hàng',type:'Asset',normalSide:'Debit',active:true,postable:true},
  {code:'131',name:'Phải thu khách hàng',type:'Asset',normalSide:'Debit',active:true,postable:true},
  {code:'5113',name:'Doanh thu dịch vụ',type:'Revenue',normalSide:'Credit',active:true,postable:true},
  {code:'6422',name:'Chi phí quản lý',type:'Expense',normalSide:'Debit',active:true,postable:true},
  {code:'331',name:'Phải trả người bán',type:'Liability',normalSide:'Credit',active:true,postable:true},
  {code:'4111',name:'Vốn góp của chủ sở hữu',type:'Equity',normalSide:'Credit',active:true,postable:true}
 ], openingBalances:[{accountCode:'1121',debit:1000000000,credit:0},{accountCode:'4111',debit:0,credit:1000000000}], accountingPeriods:[], journalEntries:[], people:[],timesheets:[],finance:[],taxInvoices:[],pitWithholdings:[],citAdjustments:[],clients:[],projects:[]
};
for(let i=0;i<ENTRY_COUNT;i++){
 const revenue=i%2===0,amount=100000+(i%1000);
 db.journalEntries.push({id:`e${i}`,date:`2026-${String((i%12)+1).padStart(2,'0')}-${String((i%28)+1).padStart(2,'0')}`,documentNo:`ST-${String(i).padStart(7,'0')}`,status:'Posted',description:'stress',lines:revenue?[{accountCode:'131',debit:amount,credit:0},{accountCode:'5113',debit:0,credit:amount}]:[{accountCode:'6422',debit:amount,credit:0},{accountCode:'331',debit:0,credit:amount}]});
}
const t0=performance.now();
const tb=C.trialBalance(db,{from:'2026-01-01',to:'2026-12-31'});
const pnl=C.profitAndLoss(db,{from:'2026-01-01',to:'2026-12-31'});
const audit=C.integrityChecks(db,{from:'2026-01-01',to:'2026-12-31'});
const ms=performance.now()-t0;
assert.equal(tb.balanced,true);
assert.equal(tb.totals.debit,tb.totals.credit);
assert.equal(Number.isSafeInteger(pnl.revenue),true);
assert.equal(audit.checks.find(x=>x.code==='JE_BALANCE').pass,true);
console.log(JSON.stringify({status:'PASS',entries:ENTRY_COUNT,journalLines:ENTRY_COUNT*2,elapsedMs:Math.round(ms),balanced:tb.balanced}));
