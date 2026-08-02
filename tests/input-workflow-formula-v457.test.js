'use strict';
const assert = require('node:assert/strict');
const C = require('../calculation-core.js');

let seed = 0xA1F457;
const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
const int = (min, max) => Math.floor(rnd() * (max - min + 1)) + min;
const money = (min, max) => int(min, max);
const idFactory = (() => { let n = 0; return (prefix) => `${prefix}-V457-${++n}`; })();

// 1) Timesheet entry: UI input values must produce the same VND labor cost as an independent formula.
for (let i = 0; i < 1000; i += 1) {
  const fixed = rnd() < 0.65;
  const settings = { monthlyWorkingHours: int(140, 220), employerBurdenRate: int(0, 35) };
  const person = fixed
    ? { id: 'P', type: 'Fixed', monthlySalary: money(5_000_000, 100_000_000) }
    : { id: 'P', type: 'CTV', hourlyRate: money(40_000, 2_000_000) };
  const hours = Math.round((0.5 + rnd() * 11.5) * 2) / 2;
  const expectedRate = fixed
    ? person.monthlySalary * (1 + settings.employerBurdenRate / 100) / settings.monthlyWorkingHours
    : person.hourlyRate;
  const db = { settings, people: [person], projects: [{ id: 'PRJ' }], timesheets: [{ id: 'TS', date: '2026-07-25', personId: 'P', projectId: 'PRJ', hours, approved: true, billable: true, description: 'Test' }] };
  assert.equal(C.laborCost(db, { projectId: 'PRJ', from: '2026-07-01', to: '2026-07-31' }), Math.round(hours * expectedRate), `timesheet cost ${i}`);
  assert.equal(C.validateTimesheet(db, db.timesheets[0], 'TS').valid, true, `timesheet validation ${i}`);
}

// 2) Procurement entry: quantity × unit price, VAT and classification remain deterministic at policy boundaries.
for (let i = 0; i < 1000; i += 1) {
  const quantity = int(1, 20);
  const unitPrice = money(1_000, 200_000_000);
  const vatRate = [0, 5, 8, 10][int(0, 3)];
  const usefulLifeMonths = int(1, 84);
  const threshold = money(20_000_000, 80_000_000);
  const total = Math.round(quantity * unitPrice);
  const vat = Math.round(total * vatRate / 100);
  assert.equal(C.vnd(quantity * unitPrice), total, `purchase subtotal ${i}`);
  assert.equal(C.vnd(total * vatRate / 100), vat, `purchase VAT ${i}`);
  const actual = C.classifyPurchase({ quantity, unitPrice, usefulLifeMonths, category: 'IT equipment' }, { fixedAssetThreshold: threshold });
  const expected = usefulLifeMonths <= 12 ? 'expense' : total >= threshold ? 'fixed_asset' : 'tool';
  assert.equal(actual.classification, expected, `purchase classification ${i}`);
}

// 3) Quick project entry: form values must synchronize exactly to one primary customer contract and an Approved budget baseline.
for (let i = 0; i < 1000; i += 1) {
  const contractValue = money(1_000_000, 5_000_000_000);
  const directBudget = money(0, contractValue);
  const project = { id: `PRJ-${i}`, code: `UX-${i}`, name: 'Input simulation', clientId: 'CLIENT', pmId: 'PM', status: 'In Progress', startDate: '2026-07-01', endDate: '2027-06-30', contractValue, directBudget, progress: int(0, 100), progressMode: 'manual' };
  const db = { settings: { defaultVatRate: 10 }, projects: [project], contracts: [], billingMilestones: [], projectBudgetVersions: [], projectBudgetLines: [] };
  const result = C.syncProjectQuickInputs(db, project.id, { defaultVatRate: 10, progressMode: 'manual', idFactory });
  assert.equal(result.ok, true, `quick sync ok ${i}`);
  const contract = db.contracts.find((x) => x.projectId === project.id && x.isPrimary === true);
  const budget = db.projectBudgetVersions.find((x) => x.projectId === project.id && C.statusIs(x.status, 'approved'));
  assert(contract, `primary contract exists ${i}`);
  assert(budget, `approved budget exists ${i}`);
  assert.equal(contract.valueExclVat, contractValue, `contract sync ${i}`);
  assert.equal(contract.clientId, 'CLIENT', `client sync ${i}`);
  assert.equal(budget.directBudget, directBudget, `budget sync ${i}`);
}

// 4) Existing billing milestones are reallocated without losing or creating one VND.
for (let i = 0; i < 1000; i += 1) {
  const contractValue = money(1, 3_000_000_000);
  const project = { id: `MPRJ-${i}`, code: `M-${i}`, clientId: 'CLIENT', contractValue, directBudget: money(0, contractValue), progressMode: 'manual' };
  const contract = { id: `CTR-${i}`, projectId: project.id, clientId: 'CLIENT', contractType: 'customer', status: 'Active', isPrimary: true, valueExclVat: money(1, 2_000_000_000) };
  const count = int(1, 8);
  const milestones = Array.from({ length: count }, (_, j) => ({ id: `MS-${i}-${j}`, contractId: contract.id, projectId: project.id, percentage: int(0, 100), amountExclVat: money(0, 500_000_000), status: 'Active' }));
  const db = { settings: { defaultVatRate: 10 }, projects: [project], contracts: [contract], billingMilestones: milestones, projectBudgetVersions: [], projectBudgetLines: [] };
  const result = C.syncProjectQuickInputs(db, project.id, { idFactory });
  assert.equal(result.ok, true, `milestone sync ${i}`);
  assert.equal(db.billingMilestones.reduce((s, x) => s + x.amountExclVat, 0), contractValue, `milestone total ${i}`);
  assert(db.billingMilestones.every((x) => x.amountExclVat >= 0 && Number.isInteger(x.amountExclVat)), `milestone nonnegative integer ${i}`);
}

// Explicit regression: the last positive-weight milestone must absorb rounding even when a trailing row has 0%.
{
  const contractValue = 1_791_949_433;
  const project = { id: 'MPRJ-ROUNDING', code: 'M-ROUND', clientId: 'CLIENT', contractValue, directBudget: 0, progressMode: 'manual' };
  const contract = { id: 'CTR-ROUNDING', projectId: project.id, clientId: 'CLIENT', contractType: 'customer', status: 'Active', isPrimary: true, valueExclVat: 1 };
  const weights = [91, 75, 35, 43, 91, 70, 0];
  const milestones = weights.map((percentage, j) => ({ id: `MS-ROUND-${j}`, contractId: contract.id, projectId: project.id, percentage, amountExclVat: 0, status: 'Active' }));
  const db = { settings: { defaultVatRate: 10 }, projects: [project], contracts: [contract], billingMilestones: milestones, projectBudgetVersions: [], projectBudgetLines: [] };
  C.syncProjectQuickInputs(db, project.id, { idFactory });
  assert.equal(db.billingMilestones.reduce((sum, row) => sum + row.amountExclVat, 0), contractValue, 'known milestone rounding regression');
}

// 5) Straight-line allocation/depreciation preserves exact value through rounding and final-period remainder.
for (let i = 0; i < 1000; i += 1) {
  const cost = money(0, 10_000_000_000);
  const residual = money(0, cost);
  const months = int(1, 600);
  const rows = C.straightLineSchedule({ sourceId: `ASSET-${i}`, kind: 'asset', startDate: '2026-07-01', cost, residualValue: residual, months });
  assert.equal(rows.length, months, `schedule length ${i}`);
  assert.equal(rows.reduce((s, x) => s + x.amount, 0), Math.max(0, Math.round(cost) - Math.round(residual)), `schedule exact total ${i}`);
  assert(rows.every((x) => Number.isInteger(x.amount) && x.amount >= 0), `schedule rows ${i}`);
}

// 6) Daily timesheet input guard: total hours cannot exceed 24, with a warning above 12.
for (let i = 0; i < 1000; i += 1) {
  const existing = Math.round(rnd() * 20 * 2) / 2;
  const added = Math.round((0.5 + rnd() * 12) * 2) / 2;
  const db = { people: [{ id: 'P' }], projects: [{ id: 'PRJ' }], timesheets: existing > 0 ? [{ id: 'OLD', date: '2026-07-25', personId: 'P', projectId: 'PRJ', hours: existing }] : [] };
  const result = C.validateTimesheet(db, { date: '2026-07-25', personId: 'P', projectId: 'PRJ', hours: added, description: 'Input test' });
  assert.equal(result.valid, existing + added <= 24, `daily 24-hour guard ${i}`);
  assert.equal(result.warnings.some((x) => x.includes('cao')), existing + added > 12, `daily warning ${i}`);
}

console.log('PASS input-workflow-formula-v457: 6,000 deterministic entry scenarios');
