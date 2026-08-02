'use strict';
const assert=require('node:assert/strict');
const {performance}=require('node:perf_hooks');
const C=require('../calculation-core.js');
let seed=0x4530A11; const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32};
const int=(a,b)=>Math.floor(rnd()*(b-a+1))+a;
const v=(x)=>{x=Number(x)||0; return Math.round(x)};
const PROJECTS=1200, PEOPLE=240, TS=180000, FIN=90000, INV=36000, JRN=50000;
const db={meta:{revision:1},settings:{monthly_working_hours:176,employer_burden_rate:23.5},projects:[],people:[],timesheets:[],finance:[],taxInvoices:[],paymentAllocations:[],accounts:[
{id:'1111',code:'1111',type:'Asset',normalSide:'Debit'},{id:'1121',code:'1121',type:'Asset',normalSide:'Debit'},
{id:'1311',code:'1311',type:'Asset',normalSide:'Debit'},{id:'3311',code:'3311',type:'Liability',normalSide:'Credit'},
{id:'3331',code:'3331',type:'Liability',normalSide:'Credit'},{id:'5111',code:'5111',type:'Revenue',normalSide:'Credit'},
{id:'6422',code:'6422',type:'Expense',normalSide:'Debit'}],journalEntries:[]};
const expectedLabor=new Float64Array(PROJECTS), expectedDirect=new Float64Array(PROJECTS);
for(let i=0;i<PROJECTS;i++) db.projects.push({id:`PR${i}`,name:`Project ${i}`,status:'Active',contract_value:1_000_000_000+i});
for(let i=0;i<PEOPLE;i++) db.people.push(i%4===0?{id:`P${i}`,type:'CTV',hourly_rate:80000+(i%20)*15000}:{id:`P${i}`,type:'Fixed',monthly_salary:9000000+(i%40)*1000000});
for(let i=0;i<TS;i++){
 const p=i%PEOPLE, pr=(i*37)%PROJECTS, hours=((i%32)+1)/4;
 const row={id:`T${i}`,date:`2026-${String(1+(i%12)).padStart(2,'0')}-${String(1+(i%28)).padStart(2,'0')}`,project_id:`PR${pr}`,person_id:`P${p}`,hours,status:i%19===0?'Draft':'Approved',billable:i%7!==0};
 db.timesheets.push(row);
 if(row.status==='Approved'){
  const person=db.people[p]; const rate=person.type==='CTV'?person.hourly_rate:person.monthly_salary*1.235/176;
  expectedLabor[pr]+=hours*rate;
 }
}
let expectedCashIn=0,expectedCashOut=0;
for(let i=0;i<FIN;i++){
 const pr=(i*53)%PROJECTS, income=i%5===0, paid=i%11!==0, amount=50000+(i%1000)*12500;
 const nature=income?'revenue':(i%9===0?'labor_already_costed':i%13===0?'overhead':'direct_non_labor');
 const row={id:`F${i}`,date:`2026-${String(1+(i%12)).padStart(2,'0')}-${String(1+(i%28)).padStart(2,'0')}`,project_id:`PR${pr}`,type:income?'Income':'Expense',status:paid?'Paid':'Draft',amount,cost_nature:nature};
 db.finance.push(row);
 if(paid){if(income)expectedCashIn+=amount;else expectedCashOut+=amount;}
 if(paid&&!income&&nature==='direct_non_labor') expectedDirect[pr]+=amount;
}
let expVatOut=0,expVatIn=0;
for(let i=0;i<INV;i++){
 const output=i%3!==0, valid=i%17!==0, base=100000+(i%5000)*10000, rate=[0,5,8,10][i%4], vat=v(base*rate/100);
 const row={id:`I${i}`,date:`2026-${String(1+(i%12)).padStart(2,'0')}-${String(1+(i%28)).padStart(2,'0')}`,project_id:`PR${(i*17)%PROJECTS}`,direction:output?'Output':'Input',status:valid?'Valid':'Draft',tax_base:base,vat_amount:vat,total_amount:base+vat,is_deductible:i%7!==0,payment_method:'Bank',payment_status:'Paid'};
 db.taxInvoices.push(row);
 if(valid&&output)expVatOut+=vat;
 if(valid&&!output&&row.is_deductible)expVatIn+=vat;
}
let expRevenue=0,expExpense=0;
for(let i=0;i<JRN;i++){
 const revenue=i%4===0, amount=100000+(i%10000)*1000;
 const entry={id:`J${i}`,date:`2026-${String(1+(i%12)).padStart(2,'0')}-${String(1+(i%28)).padStart(2,'0')}`,status:i%31===0?'Draft':'Posted',lines:revenue?
 [{accountCode:'1111',debit:amount,credit:0},{accountCode:'5111',debit:0,credit:amount}]:
 [{accountCode:'6422',debit:amount,credit:0},{accountCode:'1121',debit:0,credit:amount}]};
 db.journalEntries.push(entry);
 if(entry.status==='Posted'){if(revenue)expRevenue+=amount;else expExpense+=amount;}
}
const t0=performance.now();
let laborSum=0,directSum=0;
for(let i=0;i<PROJECTS;i++){
 const x=C.projectCost(db,`PR${i}`,{from:'2026-01-01',to:'2026-12-31'});
 assert.equal(x.labor,v(expectedLabor[i]),`labor PR${i}`); assert.equal(x.directNonLabor,expectedDirect[i],`direct PR${i}`);
 laborSum+=x.labor;directSum+=x.directNonLabor;
}
const vat=C.vatRegisterSummary(db,{from:'2026-01-01',to:'2026-12-31'});
assert.equal(vat.output,v(expVatOut)); assert.equal(vat.inputDeductible,v(expVatIn));
const cf=C.cashFlow(db,{from:'2026-01-01',to:'2026-12-31'});
assert.equal(cf.cashIn,v(expectedCashIn)); assert.equal(cf.cashOut,v(expectedCashOut));
const pl=C.profitAndLoss(db,{from:'2026-01-01',to:'2026-12-31'});
assert.equal(pl.revenue,v(expRevenue)); assert.equal(pl.expenseBeforeTax,v(expExpense)); assert.equal(pl.profitBeforeTax,v(expRevenue-expExpense));
const tb=C.trialBalance(db,{to:'2026-12-31'});
assert.equal(tb.balanced,true); assert.equal(tb.totals.debit,tb.totals.credit);
const elapsed=performance.now()-t0;
const result={records:{projects:PROJECTS,people:PEOPLE,timesheets:TS,finance:FIN,invoices:INV,journals:JRN,journalLines:JRN*2,total:PROJECTS+PEOPLE+TS+FIN+INV+JRN*3},checks:{projectCost:PROJECTS*2,vat:2,cashFlow:2,pnl:3,trialBalance:1,total:PROJECTS*2+8},totals:{labor:v(laborSum),direct:v(directSum),vatOutput:v(expVatOut),vatInputDeductible:v(expVatIn),cashIn:v(expectedCashIn),cashOut:v(expectedCashOut),revenue:v(expRevenue),expense:v(expExpense)},elapsedMs:Math.round(elapsed),memoryMb:Math.round(process.memoryUsage().heapUsed/1048576)};
console.log(JSON.stringify(result,null,2));
