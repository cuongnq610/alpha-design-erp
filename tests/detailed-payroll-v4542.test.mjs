import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
globalThis.window=globalThis;
globalThis.AlphaCalc=require('../calculation-core.js');
await import('../payroll-detail.js');
const Payroll=globalThis.AlphaPayrollDetail,Calc=globalThis.AlphaCalc;
assert.ok(Payroll,'Payroll module must initialize');

const settings={monthlyWorkingHours:176,dailyWorkingHours:8,employeeInsuranceRate:0,employerInsuranceRate:0,pitWithholdingRate:10,pitWithholdingThreshold:5000000,pitWithholdingThresholdPrevious:2000000,pitWithholdingThresholdEffectiveDate:'2026-07-01'};
const people=[
 {id:'p1',code:'AD-001',name:'Nhân viên',department:'Kiến trúc',role:'KTS',type:'Fixed',monthlySalary:23000000,billingRate:400000,status:'Active'},
 {id:'p2',code:'CTV-01',name:'CTV',department:'3D',role:'Visualizer',type:'CTV',hourlyRate:150000,billingRate:300000,status:'Active'}
];
const db={settings,people,payrollPeriods:[{id:'period-jul',periodCode:'PAY-2026-07',month:'2026-07',dateFrom:'2026-07-01',dateTo:'2026-07-31',status:'Draft'}],payrollItems:[
 {id:'i1',payrollPeriodId:'period-jul',personId:'p1',unpaidLeaveDays:1,allowances:1000000,bonus:500000,personalIncomeTax:1000000,pitMode:'Manual review',advanceDeduction:500000,otherDeductions:0},
 {id:'i2',payrollPeriodId:'period-jul',personId:'p2',pitMode:'Auto CTV'}
],timesheets:[
 {id:'t1',date:'2026-07-10',personId:'p1',projectId:'pr1',hours:8,billable:true,approved:true},
 {id:'t2',date:'2026-07-11',personId:'p2',projectId:'pr1',hours:20,billable:true,approved:true}
]};
const rows=Payroll.calculatePeriod(db,'2026-07');
assert.equal(rows.length,2);
const fixed=rows.find(x=>x.personId==='p1'),ctv=rows.find(x=>x.personId==='p2');
assert.equal(fixed.standardWorkdays,23);
assert.equal(fixed.payableWorkdays,22);
assert.equal(fixed.baseSalary,22000000,'Fixed salary must prorate by payable workdays');
assert.equal(fixed.grossIncome,23500000);
assert.equal(fixed.netPay,22000000);
assert.equal(fixed.approvedHours,8);
assert.equal(fixed.billableHours,8);
assert.equal(fixed.recoverableRevenue,3200000);
assert.equal(ctv.baseSalary,3000000,'CTV fee must come from approved hours x hourly rate');
assert.equal(ctv.personalIncomeTax,0,'July 2026 threshold is VND 5,000,000');
assert.equal(ctv.netPay,3000000);

const june={...db,payrollPeriods:[{id:'period-jun',periodCode:'PAY-2026-06',month:'2026-06',dateFrom:'2026-06-01',dateTo:'2026-06-30',status:'Draft'}],payrollItems:[{id:'j2',payrollPeriodId:'period-jun',personId:'p2',pitMode:'Auto CTV'}],timesheets:[{id:'jts',date:'2026-06-15',personId:'p2',projectId:'pr1',hours:20,billable:true,approved:true}]};
const juneCtv=Payroll.calculatePeriod(june,'2026-06').find(x=>x.personId==='p2');
assert.equal(juneCtv.personalIncomeTax,300000,'June 2026 must preserve the previous VND 2,000,000 threshold');
assert.equal(juneCtv.netPay,2700000);

const invalid={...db,payrollItems:db.payrollItems.map(x=>x.personId==='p1'?{...x,personalIncomeTax:30000000}:x)};
const validation=Payroll.validatePeriod(invalid,'2026-07');
assert.equal(validation.valid,false);
assert.ok(validation.errors.some(x=>/Thực nhận âm/.test(x.message)));

const createdDb={settings,people,timesheets:db.timesheets,payrollPeriods:[],payrollItems:[]};
let seq=0;const generated=Payroll.ensurePeriod(createdDb,'2026-07',prefix=>`${prefix}-${++seq}`);
assert.equal(generated.created,2);
assert.equal(createdDb.payrollItems.length,2);
assert.equal(generated.period.calculationVersion,'ALPHA-PAYROLL-4.5.61');
generated.period.status='Locked';
assert.equal(Payroll.ensurePeriod(createdDb,'2026-07',prefix=>`${prefix}-${++seq}`).locked,true);
console.log('PASS backward-compatible detailed employee payroll formulas, effective-dated CTV PIT, validation and immutable periods');
