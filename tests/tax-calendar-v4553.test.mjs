import assert from 'node:assert/strict';
import TaxCalendar from '../tax-calendar.js';

const quarterly=TaxCalendar.generateYear({year:2026,frequency:'Quarterly',generatedAt:'2026-01-01T00:00:00.000Z'});
assert.equal(quarterly.length,13,'Quarterly calendar has VAT/PIT x4, CIT x4 and annual finalization x1');
const find=(type,period,rows=quarterly)=>rows.find(row=>row.taxType===type&&row.period===period);
assert.equal(find('VAT','Q1/2026').dueDate,'2026-04-30');
assert.equal(find('PIT','Q2/2026').dueDate,'2026-07-31');
assert.equal(find('CIT provisional','Q2/2026').dueDate,'2026-07-30');
assert.equal(find('Annual finalization','FY2026').dueDate,'2027-03-31');

const monthly=TaxCalendar.generateYear({year:2026,frequency:'Monthly',generatedAt:'2026-01-01T00:00:00.000Z'});
assert.equal(monthly.length,29,'Monthly calendar has VAT/PIT x12, CIT x4 and annual x1');
assert.equal(find('VAT','T01/2026',monthly).dueDate,'2026-02-20');
assert.equal(find('VAT','T05/2026',monthly).dueDate,'2026-06-22','Weekend deadline moves to next working day');

const packageRules={manifest:{version:'2026.02-test'},calendarRules:[
  {id:'vat',taxType:'VAT',frequency:'Configured',monthlyDueRule:'day-20-next-month',quarterlyDueRule:'last-day-next-quarter-month',filingRequired:true}
]};
assert.equal(TaxCalendar.generateYear({year:2026,frequency:'Monthly',activePackage:packageRules,generatedAt:'x'}).length,12);
assert.equal(TaxCalendar.generateYear({year:2026,frequency:'Quarterly',activePackage:packageRules,generatedAt:'x'}).length,4);

const generated=quarterly;
const existing=[
  {...find('VAT','Q1/2026'),dueDate:'2026-05-05',dueDateMode:'Manual',filingStatus:'Filed',paymentStatus:'Paid',payableAmount:123},
  {id:'manual-other',taxType:'Other',period:'Event/2026',dueDate:'2026-08-01',filingStatus:'Preparing',paymentStatus:'Unpaid',payableAmount:50,source:'manual'},
  {id:'stale',calendarKey:'VAT::Q5/2026',taxType:'VAT',period:'Q5/2026',dueDate:'2026-12-31',filingStatus:'Not prepared',paymentStatus:'No payment',source:'auto-calendar'}
];
const merged=TaxCalendar.merge(existing,generated,[2026]);
const preserved=find('VAT','Q1/2026',merged);
assert.equal(preserved.dueDate,'2026-05-05','Manual due date must be preserved');
assert.equal(preserved.filingStatus,'Filed');
assert.equal(preserved.paymentStatus,'Paid');
assert.equal(preserved.payableAmount,123);
assert.ok(merged.some(row=>row.id==='manual-other'),'Manual event remains');
assert.ok(!merged.some(row=>row.id==='stale'),'Stale uncompleted automatic row is removed');

console.log('PASS v4.5.53 automatic tax calendar generation, package rules, working-day adjustment and safe merge');
