import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
globalThis.window=globalThis;
globalThis.AlphaCalc=require('../calculation-core.js');
await import('../payroll-detail.js');
await import('../annual-benefits.js');
const Benefits=globalThis.AlphaAnnualBenefits;
assert.ok(Benefits,'Annual benefits module must initialize');
const db={settings:{monthlyWorkingHours:176,dailyWorkingHours:8},people:[
 {id:'p1',code:'AD-001',name:'A',department:'Kiến trúc',type:'Fixed',monthlySalary:24000000,status:'Active',startDate:'2026-01-01'},
 {id:'p2',code:'AD-002',name:'B',department:'Kết cấu',type:'Fixed',monthlySalary:18000000,status:'Active',startDate:'2026-07-01'},
 {id:'p3',code:'CTV-01',name:'C',department:'3D',type:'CTV',monthlySalary:0,status:'Active',startDate:'2026-01-01'}
],payrollPeriods:[],payrollItems:[],timesheets:[],annualBenefitBudgets:[]};
const plan={...Benefits.defaultPlan(2026),companyPerformanceFactor:0.9,defaultEmployeePerformanceFactor:1,employeePerformanceFactors:{p1:1.1},includeCTVBonus:false,travelParticipationRate:80,travelCostPerPerson:4000000,travelCommonCost:12000000,travelContingencyRate:5,otherWelfareSpent:1000000};
const result=Benefits.calculateAnnualBudget(db,2026,plan);
assert.equal(result.bonus.rows.length,2,'CTV must be excluded unless explicitly enabled');
const a=result.bonus.rows.find(x=>x.personId==='p1'),b=result.bonus.rows.find(x=>x.personId==='p2');
assert.equal(a.averageSalary,24000000);
assert.equal(a.serviceRatio,1);
assert.equal(a.grossBonus,23760000,'24m x 1.1 x 0.9');
assert.ok(b.serviceRatio>0.5&&b.serviceRatio<0.51,'Mid-year employee must be prorated by actual eligible days');
assert.equal(result.travel.eligibleCount,3,'Travel fund includes all employed people');
assert.equal(result.travel.expectedParticipants,3,'Expected participants use ceiling to avoid under-budgeting');
assert.equal(result.travel.perPersonTotal,12000000);
assert.equal(result.travel.subtotal,24000000);
assert.equal(result.travel.contingency,1200000);
assert.equal(result.travel.total,25200000);
assert.equal(result.total,result.bonus.total+result.travel.total);
assert.equal(result.monthlyAccrual,Math.round(result.total/12));
const created=Benefits.ensurePlan(db,2027,prefix=>`${prefix}-1`);
assert.equal(created.created,true);assert.equal(created.plan.year,2027);assert.equal(created.plan.status,'Draft');
assert.equal(Benefits.isLockedStatus('Approved'),true);assert.equal(Benefits.isLockedStatus('Draft'),false);
console.log('PASS v4.5.45 annual 13th-month bonus and travel welfare budget formulas');
