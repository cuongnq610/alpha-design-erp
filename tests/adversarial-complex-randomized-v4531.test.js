'use strict';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {performance}=require('node:perf_hooks');
const C=require('../calculation-core.js');
let seed=0x4531C0DE;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32};
const int=(a,b)=>Math.floor(rnd()*(b-a+1))+a;const pick=a=>a[int(0,a.length-1)];
const roundRat=(num,den)=>{let q=num/den,r=num%den;return Number(r*2n>=den?q+1n:q)};
const counts={};let checks=0;const section=(k,n)=>{counts[k]=n;checks+=n};
const t0=performance.now();

// A. 120,000 timesheets, mixed ID types and exact rational payroll cost.
{
 const HOURS=176,BPS=2350,DEN=BigInt(4*HOURS*10000),people=[],timesheets=[],expectedByProject=Array(80).fill(0n);
 for(let i=0;i<400;i++) people.push(i%5===0?{id:i,type:'CTV',hourly_rate:50_000+(i%37)*7_777}:{id:i,type:'Fixed',monthly_salary:7_000_003+(i%73)*987_653});
 for(let i=0;i<120000;i++){
  const p=i%400,pr=(i*31)%80,quarters=1+(i%64),approved=i%17!==0;
  timesheets.push(i%2?{id:`T${i}`,date:`2026-${String(1+i%12).padStart(2,'0')}-${String(1+i%28).padStart(2,'0')}`,project_id:String(pr),person_id:String(p),hours:quarters/4,status:approved?'Approved':'Draft'}:{id:`T${i}`,date:`2026-${String(1+i%12).padStart(2,'0')}-${String(1+i%28).padStart(2,'0')}`,projectId:pr,personId:p,hours:quarters/4,status:approved?'Approved':'Draft'});
  if(approved){const person=people[p];let numerator;if(person.type==='CTV')numerator=BigInt(person.hourly_rate)*BigInt(quarters)*BigInt(HOURS*10000);else numerator=BigInt(person.monthly_salary)*BigInt(10000+BPS)*BigInt(quarters);expectedByProject[pr]+=numerator;}
 }
 const db={meta:{revision:1},settings:{monthly_working_hours:HOURS,employer_burden_rate:BPS/100},people,timesheets};
 let expectedTotalNum=0n;for(let pr=0;pr<80;pr++){expectedTotalNum+=expectedByProject[pr];assert.equal(C.laborCost(db,{projectId:pr,from:'2026-01-01',to:'2026-12-31'}),roundRat(expectedByProject[pr],DEN));}
 assert.equal(C.laborCost(db,{from:'2026-01-01',to:'2026-12-31'}),roundRat(expectedTotalNum,DEN));
 section('exact_rational_labor_rows',120081);
}

// B. 50,000 VAT invoices with imported boolean variants.
{
 const variantsTrue=[true,1,'1','true','TRUE','yes','on','deductible'];const variantsFalse=[false,0,'0','false','FALSE','no','off',''];
 const rows=[];let out=0,input=0,ded=0;
 for(let i=0;i<50000;i++){const direction=i%3?'Input':'Output',valid=i%19!==0,vat=1+(i*99991)%999_999_937,isDed=i%4!==0;const flag=pick(isDed?variantsTrue:variantsFalse);const row={id:`I${i}`,date:'2026-03-15',direction,status:valid?'Valid':'Draft',vat_amount:vat};if(i%2)row.deductible=flag;else row.is_deductible=flag;rows.push(row);if(valid&&direction==='Output')out+=vat;if(valid&&direction==='Input'){input+=vat;if(isDed)ded+=vat;}}
 const r=C.vatRegisterSummary({taxInvoices:rows},{from:'2026-03-01',to:'2026-03-31'});assert.deepEqual(r,{output:C.vnd(out),inputAll:C.vnd(input),inputDeductible:C.vnd(ded),payable:Math.max(0,C.vnd(out)-C.vnd(ded)),creditCarry:Math.max(0,C.vnd(ded)-C.vnd(out))});
 section('vat_boolean_import_rows',50005);
}

// C. 30,000 multi-style journal entries including reversals.
{
 const accounts=[{code:'1111',type:'Asset',normalSide:'Debit'},{code:'5111',type:'Revenue',normalSide:'Credit'},{code:'6422',type:'Expense',normalSide:'Debit'}];const journalEntries=[];let revenue=0,expense=0,debit=0;
 for(let i=0;i<30000;i++){const amount=1+(i*123457)%2_000_000_000,rev=i%2===0,reversal=i%23===0,snake=i%3===0;let lines;if(rev){revenue+=reversal?-amount:amount;lines=reversal?[{account_code:'5111',debit:amount,credit:0},{account_code:'1111',debit:0,credit:amount}]:[{account_code:'1111',debit:amount,credit:0},{account_code:'5111',debit:0,credit:amount}];}else{expense+=reversal?-amount:amount;lines=reversal?[{account_code:'1111',debit:amount,credit:0},{account_code:'6422',debit:0,credit:amount}]:[{account_code:'6422',debit:amount,credit:0},{account_code:'1111',debit:0,credit:amount}];}if(!snake)lines=lines.map(x=>({accountCode:x.account_code,debit:x.debit,credit:x.credit}));journalEntries.push({id:`J${i}`,date:'2026-04-15',documentNo:`D${i}`,status:'Posted',cashFlowCode:'01',lines});debit+=amount;}
 const db={accounts,journalEntries,openingBalances:[]};const p=C.profitAndLoss(db,{from:'2026-04-01',to:'2026-04-30'});assert.equal(p.revenue,revenue);assert.equal(p.expenseBeforeTax,expense);assert.equal(p.profitBeforeTax,revenue-expense);const tb=C.trialBalance(db,{from:'2026-04-01',to:'2026-04-30'});assert.equal(tb.totals.debit,debit);assert.equal(tb.totals.credit,debit);assert.equal(tb.balanced,true);
 section('mixed_journal_lines',30006);
}

// D. 50,000 custom CIT-band boundary and 0%-rate cases.
{
 for(let i=0;i<50000;i++){const a=int(1_000_000,3_000_000_000),b=a+int(1,47_000_000_000),r1=pick([0,5,10,15,17]),r2=pick([0,12,17,20]),rev=pick([a-1,a,a+1,b-1,b,b+1]);const expected=rev<=a?r1:rev<=b?r2:20;const settings={cit_reduced_rate_eligibility:'Approved',cit_exemption_eligibility:'Unreviewed',previous_year_tax_revenue_basis:rev,cit_standard_rate:20,cit_rate_bands:[{max_revenue:a,rate:r1,inclusive:true},{max_revenue:b,rate:r2,inclusive:true}]};assert.equal(C.citRate(settings,{taxYear:2026}),expected);}
 section('cit_custom_bands',50000);
}

// E. 8,000 exact straight-line schedules with prime remainders.
{
 for(let i=0;i<8000;i++){const cost=1_000_000_007+(i*999983)%9_000_000_000_000,residual=(i*7919)%100_000_000,months=1+(i%479);const rows=C.straightLineSchedule({source_id:`A${i}`,kind:'asset',cost,residual_value:residual,months,start_date:`${2020+i%20}-${String(1+i%12).padStart(2,'0')}-01`});assert.equal(rows.length,months);assert.equal(rows.reduce((s,x)=>s+x.amount,0),C.vnd(cost)-C.vnd(residual));assert.equal(new Set(rows.map(x=>x.period)).size,months);assert.ok(rows.every(x=>Number.isSafeInteger(x.amount)&&x.amount>=0));}
 section('prime_remainder_schedules',32000);
}

// F. 1,000 forecasts must conserve backlog and weighted pipeline VND.
{
 for(let i=0;i<1000;i++){const contract=1+(i*104729)%1_000_000_000,endMonth=2+(i%11),quote=1+(i*130363)%900_000_000,prob=i%101,factor=(i%151);const end=`2026-${String(endMonth).padStart(2,'0')}-28`;const db={settings:{corporate_tax_rate:0,defaultVatRate:0},projects:[{id:'P',status:'Active',contract_value:contract,end_date:end}],quotes:[{id:'Q',status:'Open',amount:quote,probability:prob}],people:[],timesheets:[],finance:[],contracts:[],taxInvoices:[],paymentAllocations:[],journalEntries:[],accounts:[],openingBalances:[],commitments:[],purchaseOrders:[],billingMilestones:[],projectStages:[],projectBudgetVersions:[],projectBudgetLines:[],resourcePlans:[],depreciationSchedules:[],toolAllocationSchedules:[]};const f=C.financialForecast(db,{asOf:'2026-01-31',months:12,scenario:{recurringRevenueShare:0,pipelineFactorPercent:factor,pipelineLagMonths:0,pipelineDeliveryMonths:12,nonPayrollDirectCostRatioPercent:0,collectionRatePercent:0,taxRatePercent:0,minimumCashBuffer:0}});assert.equal(f.backlogRevenue.reduce((s,x)=>s+x,0),contract);const weighted=C.vnd(quote*prob/100*factor/100);assert.equal(f.pipelineRevenue.reduce((s,x)=>s+x,0),weighted);assert.equal(f.totalRevenue,contract+weighted);}
 section('forecast_vnd_conservation',3000);
}

// G. 10,000 purchase VAT rates outside normal ranges remain bounded and balanced.
{
 for(let i=0;i<10000;i++){const base=1+(i*65537)%2_000_000_000,rate=-50+(i%301);const bp=C.purchaseJournalBlueprint({quantity:1,total_excl_vat:base,vat_rate:rate,useful_life_months:1,payment_method:'bank'},{fixed_asset_threshold:30_000_000});const vat=C.vnd(base*Math.min(100,Math.max(0,rate))/100);const vatLine=bp.lines.find(x=>x.accountCode==='1331');assert.equal(vatLine?.debit||0,vat);assert.equal(bp.lines.reduce((s,x)=>s+x.debit,0),bp.lines.reduce((s,x)=>s+x.credit,0));}
 section('bounded_purchase_vat',20000);
}

// H. 5,000 cross-type project IDs across invoice aging and commitments.
{
 for(let i=1;i<=5000;i++){const total=100_000_000+i,recognized=i%total;const db={taxInvoices:[{id:`I${i}`,date:'2026-01-01',due_date:'2026-01-31',direction:'Output',status:'Valid',project_id:String(i),total_amount:total}],paymentAllocations:[],finance:[],commitments:[{id:`C${i}`,project_id:String(i),status:'Approved',amount:total,recognized_amount:recognized}]};assert.equal(C.invoiceAging(db,{projectId:i,asOf:'2026-02-28'}).rows.length,1);assert.equal(C.projectCommitments(db,i,{to:'2026-02-28'}).outstanding,total-recognized);}
 section('cross_type_project_ids',10000);
}

const result={status:'PASS',seed:'0x4531C0DE',checks,counts};
const runtime={...result,elapsedMs:Math.round(performance.now()-t0),memoryMb:Math.round(process.memoryUsage().heapUsed/1048576)};
fs.mkdirSync(path.join(__dirname,'..','quality'),{recursive:true});fs.writeFileSync(path.join(__dirname,'..','quality','adversarial-complex-v4531-result.json'),`${JSON.stringify(result,null,2)}\n`);console.log(JSON.stringify(runtime,null,2));
