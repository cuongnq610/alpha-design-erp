'use strict';
const C=require('../calculation-core.js');
const failures=[];let checks=0;
const eq=(a,b,msg)=>{checks++;if(a!==b)failures.push({msg,actual:a,expected:b});};
const ok=(v,msg)=>{checks++;if(!v)failures.push({msg,actual:v,expected:true});};
const close=(a,b,t,msg)=>{checks++;if(Math.abs(a-b)>t)failures.push({msg,actual:a,expected:b});};

// 1. Mixed numeric/string IDs must not zero out labor costs.
{
 const db={settings:{monthly_working_hours:176,employer_burden_rate:23.5},people:[{id:101,type:'CTV',hourly_rate:123456.7}],timesheets:[{id:'T1',date:'2026-02-10',project_id:'7',person_id:'101',hours:7.25,status:'Approved'}]};
 eq(C.laborCost(db,{projectId:7,from:'2026-02-01',to:'2026-02-28'}),C.vnd(7.25*123456.7),'mixed ID labor');
}
// 2. snake_case work week and holidays must drive salary proration.
{
 const settings={work_weekdays:[1,2,3,4,5,6],holidays:['2026-02-16'],employer_burden_rate:23.5};
 const person={id:'P',monthly_salary:31_000_003,start_date:'2026-02-10'};
 const all=C.workingDaysInRange({from:'2026-02-01',to:'2026-02-28'},{workWeekdays:[1,2,3,4,5,6],holidays:['2026-02-16']});
 const active=C.workingDaysInRange({from:'2026-02-01',to:'2026-02-28'},{workWeekdays:[1,2,3,4,5,6],holidays:['2026-02-16']},person);
 const expected=31_000_003*1.235*active/all;
 close(C.monthlyEmploymentCost(person,'2026-02',settings),expected,1e-6,'snake work calendar proration');
}
// 3. Imported boolean strings must not turn "false" into true.
{
 const rows=[
  {id:'I1',date:'2026-02-01',direction:'Input',status:'Valid',vat_amount:8_000_001,deductible:'false'},
  {id:'I2',date:'2026-02-01',direction:'Input',status:'Valid',vat_amount:5_000_001,is_deductible:'true'}
 ];
 const r=C.vatRegisterSummary({taxInvoices:rows},{from:'2026-02-01',to:'2026-02-28'});
 eq(r.inputDeductible,5_000_001,'string boolean VAT deductibility');
}
// 4. A configured 0% CIT band must remain 0%, not fall back to standard rate.
{
 const settings={cit_reduced_rate_eligibility:'Approved',cit_exemption_eligibility:'Unreviewed',cit_rate_bands:[{max_revenue:3_000_000_000,rate:0,inclusive:true},{max_revenue:50_000_000_000,rate:17}],previous_year_tax_revenue_basis:2_999_999_999,cit_standard_rate:20};
 eq(C.citRate(settings,{taxYear:2026}),0,'zero CIT custom band');
}
// 5. snake_case journal lines must feed P&L, trial balance and validation.
{
 const db={settings:{},accounts:[
  {code:'1111',type:'Asset',normalSide:'Debit',active:true,postable:true},
  {code:'5111',type:'Revenue',normalSide:'Credit',active:true,postable:true},
  {code:'6422',type:'Expense',normalSide:'Debit',active:true,postable:true}
 ],openingBalances:[],accountingPeriods:[],journalEntries:[
  {id:'J1',date:'2026-02-02',documentNo:'PT-1',status:'Posted',cashFlowCode:'01',lines:[{account_code:'1111',debit:1_000_000_001,credit:0},{account_code:'5111',debit:0,credit:1_000_000_001}]},
  {id:'J2',date:'2026-02-03',documentNo:'PC-1',status:'Posted',cashFlowCode:'02',lines:[{account_code:'6422',debit:333_333_337,credit:0},{account_code:'1111',debit:0,credit:333_333_337}]}
 ]};
 const p=C.profitAndLoss(db,{from:'2026-02-01',to:'2026-02-28'});
 eq(p.revenue,1_000_000_001,'snake journal revenue');eq(p.expenseBeforeTax,333_333_337,'snake journal expense');eq(p.profitBeforeTax,666_666_664,'snake journal profit');
 const tb=C.trialBalance(db,{from:'2026-02-01',to:'2026-02-28'});ok(tb.balanced,'snake journal trial balance');eq(tb.totals.debit,1_333_333_338,'snake journal debit total');
 const entry={id:'J3',date:'2026-02-04',document_no:'PT-2',status:'Posted',cash_flow_code:'01',lines:[{account_code:'1111',debit:99_999_937,credit:0},{account_code:'5111',debit:0,credit:99_999_937}]};
 ok(C.entryValidation(db,entry).valid,'snake journal validation');
}
// 6. snake_case opening balances must be recognized.
{
 const db={accounts:[{code:'1111',type:'Asset',normalSide:'Debit'}],openingBalances:[{account_code:'1111',debit:123_456_789,credit:0,as_of_date:'2026-01-01'}],journalEntries:[]};
 eq(C.accountBalance(db,'1111',{to:'2026-02-28'}).endingDebit,123_456_789,'snake opening balance');
}
// 7. Numeric/string project IDs must work across aging and commitments.
{
 const db={taxInvoices:[{id:'I',date:'2026-01-01',due_date:'2026-01-31',direction:'Output',status:'Valid',project_id:'7',total_amount:108_000_001}],paymentAllocations:[],finance:[],commitments:[{id:'C',project_id:'7',status:'Approved',approved:true,amount:77_777_777,recognized_amount:11_111_111,due_date:'2026-02-01'}]};
 eq(C.invoiceAging(db,{projectId:7,asOf:'2026-02-28'}).rows.length,1,'mixed project ID aging');
 eq(C.projectCommitments(db,7,{to:'2026-02-28'}).outstanding,66_666_666,'mixed project ID commitments');
}
// 8. Financial forecast must conserve indivisible VND backlog over months.
{
 const db={settings:{corporate_tax_rate:20,defaultVatRate:10},projects:[{id:'P1',status:'Active',contract_value:100,end_date:'2026-04-30'}],people:[],timesheets:[],finance:[],contracts:[],taxInvoices:[],paymentAllocations:[],journalEntries:[],accounts:[],openingBalances:[],quotes:[],commitments:[],purchaseOrders:[],billingMilestones:[],projectStages:[],projectBudgetVersions:[],projectBudgetLines:[],resourcePlans:[],depreciationSchedules:[],toolAllocationSchedules:[]};
 const f=C.financialForecast(db,{asOf:'2026-01-31',months:3,scenario:{recurringRevenueShare:0,pipelineFactorPercent:0,nonPayrollDirectCostRatioPercent:0,collectionRatePercent:0,taxRatePercent:0,minimumCashBuffer:0}});
 eq(f.backlogRevenue.reduce((s,x)=>s+C.vnd(x),0),100,'forecast backlog conservation');
 eq(f.totalRevenue,100,'forecast total revenue conservation');
}
// 9. VAT rate in purchase blueprint must be bounded to a valid percentage.
{
 const bp=C.purchaseJournalBlueprint({itemName:'X',quantity:1,unitPrice:1_000_000,vatRate:150,usefulLifeMonths:1,paymentMethod:'cash'},{fixedAssetThreshold:30_000_000});
 eq(bp.lines.find(x=>x.accountCode==='1331')?.debit,1_000_000,'purchase VAT rate bounded at 100%');
 eq(bp.lines.reduce((s,x)=>s+C.vnd(x.debit),0),bp.lines.reduce((s,x)=>s+C.vnd(x.credit),0),'purchase journal balanced');
}
// 10. Exact complex allocation matrix with caps and future cutoff.
{
 const db={taxInvoices:[
  {id:'I1',date:'2026-01-01',dueDate:'2026-01-31',direction:'Output',status:'Valid',projectId:'P',totalAmount:100_000_003},
  {id:'I2',date:'2026-01-02',dueDate:'2026-01-31',direction:'Output',status:'Valid',projectId:'P',totalAmount:200_000_007}
 ],finance:[
  {id:'F1',date:'2026-02-01',type:'Income',status:'Paid',projectId:'P',amount:150_000_005},
  {id:'F2',date:'2026-02-02',type:'Income',status:'Paid',projectId:'P',amount:150_000_005}
 ],paymentAllocations:[
  {id:'A1',invoiceId:'I1',paymentId:'F1',date:'2026-02-01',status:'Posted',amount:100_000_003},
  {id:'A2',invoiceId:'I2',paymentId:'F1',date:'2026-02-01',status:'Posted',amount:50_000_002},
  {id:'A3',invoiceId:'I2',paymentId:'F2',date:'2026-02-02',status:'Posted',amount:150_000_005}
 ]};
 const aged=C.invoiceAging(db,{asOf:'2026-02-01'});
 const i1=aged.rows.find(x=>x.id==='I1'),i2=aged.rows.find(x=>x.id==='I2');
 eq(i1.outstanding,0,'allocation exact invoice 1');eq(i2.outstanding,150_000_005,'future allocation excluded at cutoff');
 const aged2=C.invoiceAging(db,{asOf:'2026-02-28'});eq(aged2.rows.find(x=>x.id==='I2').outstanding,0,'allocation exact invoice 2');
}
console.log(JSON.stringify({checks,failures},null,2));
if(failures.length)process.exit(1);
