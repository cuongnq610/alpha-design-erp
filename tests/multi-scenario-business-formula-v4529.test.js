'use strict';
const assert = require('node:assert/strict');
const C = require('../calculation-core.js');

let seed = 0x4529A11;
const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
const int = (min, max) => Math.floor(rnd() * (max - min + 1)) + min;
const pick = (rows) => rows[int(0, rows.length - 1)];
const roundVnd = (value) => {
  const number = Number.isFinite(Number(value)) ? Number(value) : 0;
  if (!number) return 0;
  if (Number.isInteger(number)) return Object.is(number, -0) ? 0 : number;
  const absolute = Math.abs(number), whole = Math.floor(absolute), fraction = absolute - whole;
  const tolerance = Math.min(0.00025, Number.EPSILON * Math.max(1, absolute) * 2);
  const rounded = fraction > 0.5 || Math.abs(fraction - 0.5) <= tolerance ? whole + 1 : whole;
  return number < 0 ? -rounded : rounded;
};
const daysBetween = (from, to) => Math.floor((new Date(`${to}T12:00:00`) - new Date(`${from}T12:00:00`)) / 86400000);
const accountingAccounts = [
  {code:'1111',type:'Asset',normalSide:'Debit'},
  {code:'5111',type:'Revenue',normalSide:'Credit'},
  {code:'6422',type:'Expense',normalSide:'Debit'},
  {code:'8211',type:'Expense',normalSide:'Debit'}
];
let scenarios = 0;
const counts = {};
const section = (name, amount) => { counts[name] = amount; scenarios += amount; };

// 1) Nhân sự cố định/CTV, burden, giờ chuẩn, giờ thực tế và hai kiểu field name.
for (let i = 0; i < 12000; i += 1) {
  const snake = i % 2 === 1;
  const ctv = i % 3 === 0;
  const salary = int(5_000_000, 90_000_000);
  const hourlyRate = int(40_000, 1_200_000);
  const burden = int(0, 4000) / 100;
  const standardHours = int(150, 220);
  const hours = int(1, 96) / 4;
  const person = snake
    ? {id:'P1', type:ctv ? 'CTV' : 'Fixed', monthly_salary:salary, hourly_rate:hourlyRate}
    : {id:'P1', type:ctv ? 'CTV' : 'Fixed', monthlySalary:salary, hourlyRate};
  const settings = snake
    ? {monthly_working_hours:standardHours, employer_burden_rate:burden}
    : {monthlyWorkingHours:standardHours, employerBurdenRate:burden};
  const timesheet = snake
    ? {id:'T1', date:'2026-07-15', project_id:'PR1', person_id:'P1', hours, status:'Approved'}
    : {id:'T1', date:'2026-07-15', projectId:'PR1', personId:'P1', hours, status:'Approved'};
  const expectedRate = ctv ? hourlyRate : salary * (1 + burden / 100) / standardHours;
  const expected = roundVnd(hours * expectedRate);
  const db = {settings, people:[person], timesheets:[timesheet]};
  assert.equal(C.laborCost(db, {from:'2026-07-01', to:'2026-07-31', projectId:'PR1'}), expected);
  assert.equal(roundVnd(C.costPerHour(person, settings) * hours), expected);
}
section('labor_and_staff_cost', 12000);

// 2) Chi phí dự án: không cộng trùng payroll/overhead/draft; hỗ trợ cost_nature từ database.
for (let i = 0; i < 6000; i += 1) {
  const snake = i % 2 === 0;
  const hourlyRate = int(50_000, 800_000), hours = int(1, 24), direct = int(0, 500_000_000);
  const person = snake ? {id:'P1',type:'CTV',hourly_rate:hourlyRate} : {id:'P1',type:'CTV',hourlyRate};
  const timesheet = snake
    ? {id:'T1',date:'2026-07-08',project_id:'PR1',person_id:'P1',hours,status:'Approved'}
    : {id:'T1',date:'2026-07-08',projectId:'PR1',personId:'P1',hours,status:'Approved'};
  const natureField = snake ? 'cost_nature' : 'costNature';
  const projectField = snake ? 'project_id' : 'projectId';
  const finance = [
    {id:'F1',date:'2026-07-09',type:'Expense',status:'Paid',amount:direct,[projectField]:'PR1',[natureField]:snake ? 'direct_non_labor' : 'DirectNonLabor'},
    {id:'F2',date:'2026-07-10',type:'Expense',status:'Paid',amount:int(1,100_000_000),[projectField]:'PR1',[natureField]:snake ? 'labor_already_costed' : 'LaborAlreadyCosted'},
    {id:'F3',date:'2026-07-11',type:'Expense',status:'Paid',amount:int(1,100_000_000),[projectField]:'PR1',[natureField]:snake ? 'overhead' : 'Overhead'},
    {id:'F4',date:'2026-07-12',type:'Expense',status:'Draft',amount:int(1,100_000_000),[projectField]:'PR1',[natureField]:snake ? 'direct_non_labor' : 'DirectNonLabor'}
  ];
  const db = {people:[person], timesheets:[timesheet], finance, accounts:[], journalEntries:[]};
  const expectedLabor = roundVnd(hourlyRate * hours);
  const result = C.projectCost(db, 'PR1', {from:'2026-07-01',to:'2026-07-31'});
  assert.deepEqual(result, {labor:expectedLabor, directNonLabor:direct, total:expectedLabor + direct});
  assert.equal(C.projectActualCost(db, 'PR1', {to:'2026-07-31'}).actualCost, expectedLabor + direct);
}
section('project_cost_and_double_counting', 6000);

// 3) Payroll tháng, CTV và recoverable revenue với payload camelCase/snake_case tương đương.
for (let i = 0; i < 2500; i += 1) {
  const salary = int(6_000_000, 80_000_000), burden = int(0, 3500) / 100;
  const ctvRate = int(50_000, 900_000), fixedBilling = int(100_000, 1_500_000), ctvBilling = int(100_000, 1_500_000);
  const fixedHours = int(1, 20), ctvHours = int(1, 20);
  const camel = {
    settings:{monthlyWorkingHours:176,employerBurdenRate:burden},
    people:[
      {id:'PF',type:'Fixed',department:'Architecture',monthlySalary:salary,billingRate:fixedBilling,startDate:'2026-01-01'},
      {id:'PC',type:'CTV',department:'Structure',hourlyRate:ctvRate,billingRate:ctvBilling,startDate:'2026-01-01'}
    ],
    timesheets:[
      {id:'TF',date:'2026-07-10',personId:'PF',projectId:'PR1',hours:fixedHours,billable:true,status:'Approved'},
      {id:'TC',date:'2026-07-11',personId:'PC',projectId:'PR1',hours:ctvHours,billable:true,status:'Approved'}
    ], accounts:[], journalEntries:[], finance:[]
  };
  const snake = {
    settings:{monthly_working_hours:176,employer_burden_rate:burden},
    people:[
      {id:'PF',type:'Fixed',department:'Architecture',monthly_salary:salary,billing_rate:fixedBilling,start_date:'2026-01-01'},
      {id:'PC',type:'CTV',department:'Structure',hourly_rate:ctvRate,billing_rate:ctvBilling,start_date:'2026-01-01'}
    ],
    timesheets:[
      {id:'TF',date:'2026-07-10',person_id:'PF',project_id:'PR1',hours:fixedHours,billable:true,status:'Approved'},
      {id:'TC',date:'2026-07-11',person_id:'PC',project_id:'PR1',hours:ctvHours,billable:true,status:'Approved'}
    ], accounts:[], journalEntries:[], finance:[]
  };
  const a = C.monthlySeries(camel,{from:'2026-07-01',to:'2026-07-31'}), b = C.monthlySeries(snake,{from:'2026-07-01',to:'2026-07-31'});
  for (const key of ['payrollFixed','payrollCtv','recovered','billable','nonBillable']) assert.deepEqual(b[key], a[key]);
  assert.equal(a.payrollFixed[0], roundVnd(salary * (1 + burden / 100)) / 1e6);
  assert.equal(a.payrollCtv[0], roundVnd(ctvRate * ctvHours) / 1e6);
  assert.equal(a.recovered[0], roundVnd(fixedHours * fixedBilling + ctvHours * ctvBilling) / 1e6);
  assert.deepEqual(C.payrollByDepartment(snake,{from:'2026-07-01',to:'2026-07-31'}).map(x=>[x.name,x.value]), C.payrollByDepartment(camel,{from:'2026-07-01',to:'2026-07-31'}).map(x=>[x.name,x.value]));
}
section('monthly_payroll_and_recovery', 2500);

// 4) Thuế TNCN: kiểm tra mốc 2 triệu trước 01/07/2026, 5 triệu từ 01/07/2026, rate và cam kết miễn.
for (let i = 0; i < 10000; i += 1) {
  const before = i % 2 === 0, snake = i % 3 === 0;
  const date = before ? '2026-06-30' : '2026-07-01';
  const threshold = before ? 2_000_000 : 5_000_000;
  const gross = i < 8 ? [threshold-1,threshold,threshold+1,0,1,threshold*2,threshold-500_000,threshold+500_000][i] : int(0, 100_000_000);
  const taxable = int(0, Math.max(0,gross));
  const rate = int(0, 3000) / 100;
  const exempt = i % 17 === 0;
  const input = snake
    ? {date,gross_income:gross,taxable_income:taxable,withholding_method:'Khấu trừ tỷ lệ',commitment_exempt:exempt,rate}
    : {date,grossIncome:gross,taxableIncome:taxable,withholdingMethod:'Khấu trừ tỷ lệ',commitmentExempt:exempt,rate};
  const settings = snake
    ? {pit_withholding_threshold:5_000_000,pit_withholding_threshold_previous:2_000_000,pit_withholding_threshold_effective_date:'2026-07-01',pit_withholding_rate:10}
    : {pitWithholdingThreshold:5_000_000,pitWithholdingThresholdPrevious:2_000_000,pitWithholdingThresholdEffectiveDate:'2026-07-01',pitWithholdingRate:10};
  const expectedTax = exempt || gross < threshold ? 0 : Math.min(gross, roundVnd(Math.min(gross,taxable) * rate / 100));
  const result = C.pitWithholding(input, settings);
  assert.equal(result.tax, expectedTax);
  assert.equal(result.net, Math.max(0,roundVnd(gross)) - expectedTax);
  assert.equal(C.pitWithholdingThresholdForDate(input,settings),threshold);
}
section('pit_effective_date_and_boundaries', 10000);

// 5) VAT đầu ra/đầu vào/khấu trừ với trạng thái hợp lệ và payload database.
for (let i = 0; i < 5000; i += 1) {
  const rows = [], finance = [], journalEntries = [];
  let output = 0, inputAll = 0, inputDeductible = 0;
  for (let j = 0; j < 7; j += 1) {
    const direction = j % 2 ? 'Input' : 'Output';
    const base = int(0, 2_000_000_000), rate = pick([0,5,8,10]), vat = roundVnd(base * rate / 100);
    const status = pick(['Valid','Issued','Draft','Cancelled']);
    const deductible = j % 3 !== 0;
    const recognized = ['valid','issued'].includes(status.toLowerCase());
    const snake = (i + j) % 2 === 0;
    rows.push(snake
      ? {id:`I${j}`,date:'2026-07-15',direction,status,partner_type:'vendor',partner_id:'V1',tax_base:base,vat_amount:vat,total_amount:base+vat,is_deductible:deductible,payment_method:'Bank',payment_status:'Paid'}
      : {id:`I${j}`,date:'2026-07-15',direction,status,partnerType:'vendor',partnerId:'V1',taxBase:base,vatAmount:vat,totalAmount:base+vat,deductible,paymentMethod:'Bank',paymentStatus:'Paid'});
    if (recognized && direction === 'Input' && deductible && base + vat > 0) {
      const paymentId=`F${j}`,journalId=`J${j}`,amount=base+vat;
      finance.push({id:paymentId,date:'2026-07-15',type:'Expense',status:'Paid',amount,vendorId:'V1',invoiceId:`I${j}`,journalEntryId:journalId});
      journalEntries.push({id:journalId,date:'2026-07-15',status:'Posted',partnerType:'vendor',partnerId:'V1',lines:[
        {accountCode:'331',debit:amount,credit:0},
        {accountCode:'1121',debit:0,credit:amount}
      ]});
    }
    if (recognized && direction === 'Output') output += vat;
    if (recognized && direction === 'Input') { inputAll += vat; if (deductible) inputDeductible += vat; }
  }
  const result = C.vatRegisterSummary({taxInvoices:rows,finance,journalEntries,vendors:[{id:'V1'}]},{from:'2026-07-01',to:'2026-07-31'});
  assert.deepEqual(result,{output:roundVnd(output),inputAll:roundVnd(inputAll),inputDeductible:roundVnd(inputDeductible),payable:Math.max(0,roundVnd(output-inputDeductible)),creditCarry:Math.max(0,roundVnd(inputDeductible-output))});
}
section('vat_register', 5000);

// 6) Thuế TNDN: năm hiệu lực, miễn/giảm, ba dải doanh thu, manual rate và snake_case settings.
for (let i = 0; i < 5000; i += 1) {
  const year = pick([2024,2025,2026]);
  const revenue = pick([0,999_999_999,1_000_000_000,1_000_000_001,3_000_000_000,3_000_000_001,50_000_000_000,50_000_000_001,int(0,80_000_000_000)]);
  const exemptionApproved = i % 3 !== 0, reducedApproved = i % 4 !== 0, manual = i % 19 === 0;
  const manualRate = int(0,3000)/100;
  let expected;
  if (manual) expected = Math.min(100,Math.max(0,manualRate));
  else if (year >= 2026 && exemptionApproved && revenue <= 1_000_000_000) expected = 0;
  else if (year < 2025 || !reducedApproved) expected = 20;
  else if (revenue <= 3_000_000_000) expected = 15;
  else if (revenue <= 50_000_000_000) expected = 17;
  else expected = 20;
  const snake = i % 2 === 0;
  const settings = snake ? {
    cit_rate_mode:manual?'Manual':'Auto by revenue', corporate_tax_rate:manualRate, cit_standard_rate:20,
    cit_reduced_rate_eligibility:reducedApproved?'Approved':'Unreviewed', cit_exemption_eligibility:exemptionApproved?'Approved':'Unreviewed',
    cit_exemption_revenue_threshold:1_000_000_000,cit_reduced_rate_effective_year:2025,cit_exemption_effective_year:2026,previous_year_tax_revenue_basis:revenue
  } : {
    citRateMode:manual?'Manual':'Auto by revenue', corporateTaxRate:manualRate, citStandardRate:20,
    citReducedRateEligibility:reducedApproved?'Approved':'Unreviewed', citExemptionEligibility:exemptionApproved?'Approved':'Unreviewed',
    citExemptionRevenueThreshold:1_000_000_000,citReducedRateEffectiveYear:2025,citExemptionEffectiveYear:2026,previousYearTaxRevenueBasis:revenue
  };
  assert.equal(C.citRate(settings,{taxYear:year}),expected);
}
section('cit_policy_bands', 5000);

// 7) Kế toán kép, P&L và cân đối thử với nhiều doanh thu/chi phí/thuế khác nhau.
for (let i = 0; i < 5000; i += 1) {
  const revenue = int(0,2_000_000_000), expense = int(0,1_500_000_000), incomeTax = int(0,500_000_000);
  const entries = [
    {id:'JR',date:'2026-07-05',status:'Posted',lines:[{accountCode:'1111',debit:revenue,credit:0},{accountCode:'5111',debit:0,credit:revenue}]},
    {id:'JE',date:'2026-07-10',status:'Posted',lines:[{accountCode:'6422',debit:expense,credit:0},{accountCode:'1111',debit:0,credit:expense}]},
    {id:'JT',date:'2026-07-20',status:'Posted',lines:[{accountCode:'8211',debit:incomeTax,credit:0},{accountCode:'1111',debit:0,credit:incomeTax}]}
  ];
  const db = {accounts:accountingAccounts,journalEntries:entries,openingBalances:[]};
  const pnl = C.profitAndLoss(db,{from:'2026-07-01',to:'2026-07-31'});
  assert.deepEqual(pnl,{revenue,expenseBeforeTax:expense,incomeTaxExpense:incomeTax,profitBeforeTax:revenue-expense,profitAfterTax:revenue-expense-incomeTax,marginBeforeTax:revenue?(revenue-expense)/revenue*100:0});
  const tb = C.trialBalance(db,{from:'2026-07-01',to:'2026-07-31'});
  assert.equal(tb.balanced,true);
  assert.equal(tb.totals.debit,tb.totals.credit);
  assert.equal(tb.totals.endingDebit,tb.totals.endingCredit);
}
section('double_entry_pnl_trial_balance', 5000);

// 8) Tuổi nợ: due_date, phân bổ một phần/toàn phần, bucket và giới hạn phân bổ không vượt hóa đơn.
for (let i = 0; i < 5000; i += 1) {
  const base = int(1,1_000_000_000), vat = roundVnd(base * pick([0,5,8,10]) / 100), original = base + vat;
  const allocatedRaw = int(0, Math.min(Number.MAX_SAFE_INTEGER, original * 2));
  // An over-allocation row is invalid evidence and must be rejected entirely, not silently clipped.
  const allocated = allocatedRaw <= original ? allocatedRaw : 0;
  const overdueDays = pick([0,1,15,30,31,45,60,61,90,91,180]);
  const asOf = '2026-07-31';
  const due = new Date('2026-07-31T12:00:00'); due.setDate(due.getDate()-overdueDays);
  const dueDate = `${due.getFullYear()}-${String(due.getMonth()+1).padStart(2,'0')}-${String(due.getDate()).padStart(2,'0')}`;
  const snake = i%2===0;
  const invoice = snake
    ? {id:'INV',date:'2026-06-01',due_date:dueDate,direction:'Output',status:'Valid',tax_base:base,vat_amount:vat,total_amount:original}
    : {id:'INV',date:'2026-06-01',dueDate,direction:'Output',status:'Valid',taxBase:base,vatAmount:vat,totalAmount:original};
  const allocation = snake
    ? {id:'A',invoice_id:'INV',date:'2026-07-15',amount:allocatedRaw,status:'Posted'}
    : {id:'A',invoiceId:'INV',date:'2026-07-15',amount:allocatedRaw,status:'Posted'};
  const result = C.invoiceAging({taxInvoices:[invoice],paymentAllocations:[allocation],finance:[]},{direction:'Output',asOf,to:asOf});
  const outstanding = Math.max(0,original-allocated);
  const days = outstanding>0 && dueDate<asOf ? daysBetween(dueDate,asOf) : 0;
  const bucket = outstanding<=0?'Paid':days<=0?'Current':days<=30?'1-30':days<=60?'31-60':days<=90?'61-90':'90+';
  assert.equal(result.rows[0].dueDate,dueDate);
  assert.equal(result.rows[0].allocated,allocated);
  assert.equal(result.rows[0].outstanding,outstanding);
  assert.equal(result.rows[0].daysOverdue,days);
  assert.equal(result.rows[0].bucket,bucket);
}
section('invoice_aging_and_allocations', 5000);

// 9) Khấu hao/phân bổ đường thẳng: tổng lịch luôn bằng nguyên giá trừ thu hồi và phần dư vào kỳ cuối.
for (let i = 0; i < 5000; i += 1) {
  const cost = int(0,2_000_000_000), residual = int(0,cost), months = int(1,480);
  const snake = i%2===0;
  const input = snake
    ? {source_id:`A${i}`,kind:'asset',cost,residual_value:residual,months,start_date:`2026-${String(int(1,12)).padStart(2,'0')}-01`}
    : {sourceId:`A${i}`,kind:'asset',cost,residualValue:residual,months,startDate:`2026-${String(int(1,12)).padStart(2,'0')}-01`};
  const schedule = C.straightLineSchedule(input);
  assert.equal(schedule.length,months);
  assert.equal(schedule.reduce((total,row)=>total+row.amount,0),roundVnd(cost)-roundVnd(residual));
  assert(schedule.every(row=>Number.isInteger(row.amount)&&row.amount>=0));
}
section('straight_line_schedules', 5000);

// 10) Validation, tiến độ và forecast: payload Supabase phải cho kết quả số học tương đương camelCase.
for (let i = 0; i < 1000; i += 1) {
  const contractValue = int(100_000_000,2_000_000_000), directBudget = int(0,contractValue), progress = int(0,100);
  const salary = int(6_000_000,70_000_000), burden = int(0,3500)/100, overhead = int(0,200_000_000);
  const camelProject = {id:'PR1',code:'P-01',name:'Project',clientId:'CL1',pmId:'PM1',contractValue,directBudget,progress,progressMode:'manual',startDate:'2026-01-01',endDate:'2026-12-31',status:'Active'};
  const snakeProject = {id:'PR1',code:'P-01',name:'Project',client_id:'CL1',pm_id:'PM1',contract_value:contractValue,direct_budget:directBudget,progress,progress_mode:'manual',start_date:'2026-01-01',end_date:'2026-12-31',status:'Active'};
  assert.deepEqual(C.validateProject(snakeProject),C.validateProject(camelProject));
  assert.equal(C.projectScheduleProgress(snakeProject,'2026-07-01'),C.projectScheduleProgress(camelProject,'2026-07-01'));
  const camelDb = {settings:{employerBurdenRate:burden,overheadMonthly:overhead,corporateTaxRate:20,minimumCashBuffer:150_000_000},people:[{id:'PM1',type:'Fixed',department:'Architecture',monthlySalary:salary,startDate:'2026-01-01'}],projects:[camelProject],contracts:[{id:'CT1',projectId:'PR1',clientId:'CL1',contractType:'customer',status:'Active',valueExclVat:contractValue}],accounts:[],journalEntries:[],openingBalances:[],taxInvoices:[],finance:[],timesheets:[],quotes:[],commitments:[],purchaseOrders:[]};
  const snakeDb = {settings:{employer_burden_rate:burden,overhead_monthly:overhead,corporate_tax_rate:20,minimum_cash_buffer:150_000_000},people:[{id:'PM1',type:'Fixed',department:'Architecture',monthly_salary:salary,start_date:'2026-01-01'}],projects:[snakeProject],contracts:[{id:'CT1',project_id:'PR1',client_id:'CL1',contract_type:'customer',status:'Active',value_excl_vat:contractValue}],accounts:[],journalEntries:[],openingBalances:[],taxInvoices:[],finance:[],timesheets:[],quotes:[],commitments:[],purchaseOrders:[]};
  const pfCamel=C.projectFinancials(camelDb,'PR1',{to:'2026-07-31'}), pfSnake=C.projectFinancials(snakeDb,'PR1',{to:'2026-07-31'});
  for(const key of ['contractValue','directBudget','progress','scheduleProgress','laborCost','actualCost','earnedValue','plannedValue','forecastProfit']) assert.equal(pfSnake[key],pfCamel[key],key);
  const fcCamel=C.financialForecast(camelDb,{asOf:'2026-07-31',months:6,scenario:{recurringRevenueShare:0}}), fcSnake=C.financialForecast(snakeDb,{asOf:'2026-07-31',months:6,scenario:{recurringRevenueShare:0}});
  for(const key of ['revenue','payrollCost','overheadCost','operatingCost','profitBeforeTax','profitAfterTax','closingCash']) assert.deepEqual(fcSnake[key],fcCamel[key],key);
  assert.equal(fcCamel.payrollCost[0],roundVnd(salary*(1+burden/100)));
}
section('supabase_alias_project_financial_forecast',1000);

// Timesheet validation specifically checks person_id/project_id and daily aggregation across mixed aliases.
for(let i=0;i<1000;i+=1){
  const previous=int(0,12),current=int(1,12);
  const db={people:[{id:'P1'}],projects:[{id:'PR1'}],timesheets:[{id:'OLD',date:'2026-07-01',personId:'P1',projectId:'PR1',hours:previous}]};
  const row={id:'NEW',date:'2026-07-01',person_id:'P1',project_id:'PR1',hours:current,description:'Test'};
  const result=C.validateTimesheet(db,row);
  assert.equal(result.dailyHours,previous+current);
  assert.equal(result.valid,previous+current<=24);
}
section('timesheet_validation_aliases',1000);

console.log(`PASS ${scenarios.toLocaleString('en-US')} multi-scenario project, HR, tax, accounting and financial formula checks`);
console.log(JSON.stringify({scenarios,counts,seed:'0x4529A11'}));
