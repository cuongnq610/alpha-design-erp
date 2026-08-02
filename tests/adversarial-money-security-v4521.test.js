'use strict';
const C=require('../calculation-core.js');
let seed=0x9e3779b9;const rnd=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296};
const int=(a,b)=>Math.floor(rnd()*(b-a+1))+a;
let checks=0;
function assert(x,m){checks++;if(!x)throw new Error(m)}
// Symmetric rounding and idempotence across safe business range.
const fracs=[0,0.000000001,0.1,0.499999999,0.5,0.500000001,0.9,0.999999999];
for(let i=0;i<100000;i++){
 const base=int(0,1_000_000);const f=fracs[int(0,fracs.length-1)];const sign=rnd()<.5?-1:1;const x=sign*(base+f);
 const expected=sign*(base+(f>=0.5?1:0));
 assert(C.vnd(x)===expected,`vnd ${x} ${C.vnd(x)} != ${expected}`);
 assert(C.vnd(C.vnd(x))===expected,'vnd idempotence');
 assert(Object.is(C.vnd(-0),-0)===false,'no negative zero');
}
// Straight-line schedules exact to last VND and monotonic periods.
for(let i=0;i<20000;i++){
 const cost=int(0,1_000_000_000_000),res=int(0,cost),months=int(1,1200),month=int(1,12),year=int(2000,2090);
 const rows=C.straightLineSchedule({sourceId:'x'+i,startDate:`${year}-${String(month).padStart(2,'0')}-01`,cost,residualValue:res,months,kind:'asset'});
 assert(rows.length===months,'schedule length');
 assert(rows.every(r=>Number.isSafeInteger(r.amount)&&r.amount>=0),'schedule safe integers');
 assert(rows.reduce((s,r)=>s+r.amount,0)===C.vnd(cost)-C.vnd(res),'schedule exact total');
 assert(new Set(rows.map(r=>r.period)).size===months,'schedule unique periods');
}
// PIT threshold/date/rate invariants.
for(let i=0;i<20000;i++){
 const gross=int(0,1_000_000_000),taxable=int(0,gross),rate=int(0,10000)/100;
 const before=rnd()<.5,date=before?'2026-06-30':'2026-07-01';const threshold=before?2_000_000:5_000_000;
 const got=C.pitWithholding({grossIncome:gross,taxableIncome:taxable,rate,date,withholdingMethod:'Khấu trừ tỷ lệ'},{pitWithholdingThreshold:5_000_000,pitWithholdingThresholdPrevious:2_000_000,pitWithholdingThresholdEffectiveDate:'2026-07-01'});
 const expected=gross>=threshold?Math.min(gross,C.vnd(taxable*rate/100)):0;
 assert(got.tax===expected,'pit tax');assert(got.net===gross-expected,'pit net');
}
// VAT register and ledger reconciliation in isolated exact journals.
for(let i=0;i<10000;i++){
 const out=int(0,1_000_000_000),input=int(0,1_000_000_000),nonded=int(0,1_000_000_000);
 const inputGross=input*11;
 const db={taxInvoices:[
  {id:'o',date:'2026-01-01',direction:'Output',status:'Valid',vatAmount:out,taxBase:out*10},
  {id:'i',date:'2026-01-01',direction:'Input',status:'Valid',partnerType:'vendor',partnerId:'v',deductible:true,vatAmount:input,taxBase:input*10,totalAmount:inputGross,paymentMethod:'Bank',paymentStatus:'Paid'},
  {id:'n',date:'2026-01-01',direction:'Input',status:'Valid',deductible:false,vatAmount:nonded,taxBase:nonded*10}
 ],vendors:[{id:'v'}],finance:inputGross>0?[{id:'f',date:'2026-01-01',type:'Expense',status:'Paid',amount:inputGross,vendorId:'v',invoiceId:'i',journalEntryId:'j'}]:[],journalEntries:inputGross>0?[{id:'j',date:'2026-01-01',status:'Posted',partnerType:'vendor',partnerId:'v',lines:[{accountCode:'331',debit:inputGross,credit:0},{accountCode:'1121',debit:0,credit:inputGross}]}]:[],accounts:[],openingBalances:[]};
 const v=C.vatRegisterSummary(db,{from:'2026-01-01',to:'2026-12-31'});
 assert(v.output===out&&v.inputAll===input+nonded&&v.inputDeductible===input,'vat components');
 assert(v.payable===Math.max(0,out-input)&&v.creditCarry===Math.max(0,input-out),'vat net');
}
// Journal hash sensitivity and double-entry validation.
for(let i=0;i<10000;i++){
 const amount=int(1,1_000_000_000_000);const e={id:'j'+i,date:'2026-07-01',documentNo:'D'+i,description:'x',status:'Posted',sourceType:'Phiếu kế toán',lines:[{accountCode:'6422',debit:amount,credit:0},{accountCode:'331',debit:0,credit:amount}]};
 e.postingHash=C.postingHash(e);assert(C.verifyPostingHash(e),'hash valid');
 const changed={...e,lines:e.lines.map((x,j)=>j?x:{...x,debit:x.debit+1})};assert(!C.verifyPostingHash(changed),'hash mutation');
 const db={accounts:[{code:'6422',active:true,postable:true},{code:'331',active:true,postable:true}],journalEntries:[],accountingPeriods:[]};assert(C.entryValidation(db,e,'').valid,'balanced validation');
}
console.log('PASS v4.5.21 adversarial money/hash/journal suite',JSON.stringify({status:'PASS',checks,scenarios:160000}));
