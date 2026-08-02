import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
globalThis.window=globalThis;
globalThis.AlphaCalc=require('../calculation-core.js');
await import('../payroll-detail.js');
const Payroll=globalThis.AlphaPayrollDetail;
assert.equal(Payroll.FORMULA_VERSION,'ALPHA-PAYROLL-4.5.61');

const settings={
  monthlyWorkingHours:176,dailyWorkingHours:8,overtimeMultiplier:1.5,
  employeeInsuranceRate:10.5,employerInsuranceRate:21.5,
  personalDeduction:15500000,dependentDeduction:6200000,
  personalDeductionPrevious:11000000,dependentDeductionPrevious:4400000,
  fixedPitScheduleEffectiveDate:'2026-01-01',
  pitWithholdingRate:10,pitWithholdingThreshold:5000000,pitWithholdingThresholdPrevious:2000000,pitWithholdingThresholdEffectiveDate:'2026-07-01'
};
const people=[
 {id:'fixed',code:'AD-100',name:'Nhân viên tự động',department:'Kiến trúc',role:'KTS',type:'Fixed',monthlySalary:30000000,monthlyAllowance:2000000,insuranceSalary:30000000,insuranceEnabled:true,dependentCount:1,pitResidence:'Resident',billingRate:500000,startDate:'2026-01-01',status:'Active'},
 {id:'ctv',code:'CTV-100',name:'CTV tự động',department:'3D',role:'Visualizer',type:'CTV',hourlyRate:200000,billingRate:350000,startDate:'2026-01-01',status:'Active'}
];
const period={id:'period',periodCode:'PAY-2026-07',month:'2026-07',dateFrom:'2026-07-01',dateTo:'2026-07-31',status:'Draft'};
const db={settings,people,payrollPeriods:[period],payrollItems:[
 {id:'fi',payrollPeriodId:'period',personId:'fixed',unpaidLeaveDays:0,allowanceMode:'Auto profile',overtimeMode:'Auto timesheet',bonus:1000000,insuranceMode:'Auto policy',employeeInsurance:0,employerInsurance:0,pitMode:'Auto progressive'},
 {id:'ci',payrollPeriodId:'period',personId:'ctv',pitMode:'Auto CTV'}
],timesheets:[
 {id:'f1',date:'2026-07-06',personId:'fixed',projectId:'pr1',hours:10,billable:true,approved:true},
 {id:'f2',date:'2026-07-07',personId:'fixed',projectId:'pr1',hours:8,billable:false,approved:true},
 {id:'f3',date:'2026-07-08',personId:'fixed',projectId:'pr1',hours:9,billable:true,approved:false},
 {id:'c1',date:'2026-07-10',personId:'ctv',projectId:'pr1',hours:30,billable:true,approved:true}
]};
const rows=Payroll.calculatePeriod(db,'2026-07');
const fixed=rows.find(row=>row.personId==='fixed');
const ctv=rows.find(row=>row.personId==='ctv');
assert.equal(fixed.standardWorkdays,23);
assert.equal(fixed.payableWorkdays,23);
assert.equal(fixed.baseSalary,30000000);
assert.equal(fixed.allowances,2000000,'Recurring allowance must come from employee profile');
assert.equal(fixed.approvedHours,18,'Only approved timesheets count');
assert.equal(fixed.overtimeHours,2,'Daily hours above the configured norm become overtime');
assert.equal(fixed.overtimePay,489130);
assert.equal(fixed.grossIncome,33489130);
assert.equal(fixed.insuranceBase,30000000);
assert.equal(fixed.employeeInsurance,3150000,'Stored legacy zero must not block automatic employee insurance');
assert.equal(fixed.employerInsurance,6450000,'Stored legacy zero must not block automatic employer insurance');
assert.equal(fixed.personalDeduction,15500000);
assert.equal(fixed.dependentDeduction,6200000);
assert.equal(fixed.taxableIncome,8639130);
assert.equal(fixed.personalIncomeTax,431957);
assert.equal(fixed.netPay,29907173);
assert.equal(fixed.totalEmployerCost,39939130);
assert.equal(fixed.allowanceMode,'Auto profile');
assert.equal(fixed.insuranceMode,'Auto policy');
assert.equal(fixed.pitMode,'Auto progressive');
assert.ok(fixed.sourceSignature.includes('monthlyAllowance'));
assert.equal(ctv.baseSalary,6000000);
assert.equal(ctv.personalIncomeTax,600000);
assert.equal(ctv.netPay,5400000);

const manual=Payroll.calculateItem(db,people[0],'2026-07',{
  payrollPeriodId:'period',personId:'fixed',unpaidLeaveDays:0,
  allowanceMode:'Manual',allowances:777777,
  overtimeMode:'Manual',overtimePay:888888,
  insuranceMode:'Manual',employeeInsurance:111111,employerInsurance:222222,
  pitMode:'Manual review',personalIncomeTax:333333
},period);
assert.equal(manual.allowances,777777);
assert.equal(manual.overtimePay,888888);
assert.equal(manual.employeeInsurance,111111);
assert.equal(manual.employerInsurance,222222);
assert.equal(manual.personalIncomeTax,333333);

const generated={settings,people,timesheets:db.timesheets,payrollPeriods:[],payrollItems:[]};
let seq=0;
const first=Payroll.ensurePeriod(generated,'2026-07',prefix=>`${prefix}-${++seq}`);
assert.equal(first.created,2);
assert.equal(first.updated,2);
assert.ok(generated.payrollItems.every(item=>String(item.allowanceMode).startsWith('Auto')));
const generatedFixed=generated.payrollItems.find(item=>item.personId==='fixed');
assert.equal(generatedFixed.employeeInsurance,3150000);
assert.equal(generatedFixed.calculationVersion,'ALPHA-PAYROLL-4.5.61');
people[0].monthlyAllowance=3000000;
const refreshed=Payroll.refreshDraftPeriods(generated,prefix=>`${prefix}-${++seq}`,['2026-07']);
assert.equal(refreshed.length,1);
assert.equal(generated.payrollItems.find(item=>item.personId==='fixed').allowances,3000000,'Draft period must recalculate after source changes');
generated.payrollPeriods[0].status='Locked';
people[0].monthlyAllowance=4000000;
const lockedResult=Payroll.ensurePeriod(generated,'2026-07',prefix=>`${prefix}-${++seq}`);
assert.equal(lockedResult.locked,true);
assert.equal(generated.payrollItems.find(item=>item.personId==='fixed').allowances,3000000,'Locked period must remain immutable');
console.log('PASS v4.5.61 fully automated payroll sources, 2026 PIT effective date, insurance, overtime, manual overrides and draft refresh');
