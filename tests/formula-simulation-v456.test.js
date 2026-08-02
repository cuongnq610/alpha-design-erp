'use strict';
const assert = require('node:assert/strict');
const C = require('../calculation-core.js');

let seed = 0xA1F456;
const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
const int = (min, max) => Math.floor(rnd() * (max - min + 1)) + min;
const pick = (rows) => rows[int(0, rows.length - 1)];
const money = (min = 1, max = 1_000_000_000) => int(min, max);
const date = (day) => `2026-07-${String(day).padStart(2, '0')}`;
const RANGE = { from: '2026-07-01', to: '2026-07-31' };

// 1) Management cash flow: only Paid Income/Expense, excluding internal transfers.
for (let scenario = 0; scenario < 3000; scenario += 1) {
  const finance = [];
  let expectedIn = 0;
  let expectedOut = 0;
  let expectedTransfers = 0;
  const count = int(1, 35);
  for (let i = 0; i < count; i += 1) {
    const type = pick(['Income', 'Expense']);
    const status = pick(['Paid', 'Pending', 'Draft', 'Cancelled']);
    const amount = money(1, 30_000_000);
    const transferMode = int(0, 9);
    const row = { id: `CF-${scenario}-${i}`, date: date(int(1, 28)), type, status, amount, category: 'Hoạt động' };
    if (transferMode === 0) row.transferId = `TR-${scenario}-${i}`;
    if (transferMode === 1) row.transactionNature = 'Internal transfer';
    if (transferMode === 2) row.category = 'Chuyển quỹ nội bộ';
    const internal = transferMode <= 2;
    finance.push(row);
    if (status === 'Paid') {
      if (internal) expectedTransfers += Math.abs(Math.round(amount));
      else if (type === 'Income') expectedIn += Math.round(amount);
      else expectedOut += Math.round(amount);
    }
  }
  finance.push({ id: `OUTSIDE-${scenario}`, date: '2026-08-01', type: 'Income', status: 'Paid', amount: 999_999_999 });
  const actual = C.cashFlow({ finance }, RANGE);
  assert.equal(actual.cashIn, expectedIn, `cashIn scenario ${scenario}`);
  assert.equal(actual.cashOut, expectedOut, `cashOut scenario ${scenario}`);
  assert.equal(actual.net, expectedIn - expectedOut, `cash net scenario ${scenario}`);
  assert.equal(actual.internalTransfers || 0, expectedTransfers, `internal transfer scenario ${scenario}`);
}

// 2) VAT register: include only recognized invoice states in period and calculate payable/credit carry exactly.
const VAT_ACTIVE = new Set(['', 'valid', 'adjusted', 'issued', 'posted', 'approved', 'accepted', 'active', 'completed']);
for (let scenario = 0; scenario < 3000; scenario += 1) {
  const taxInvoices = [];
  let output = 0;
  let inputAll = 0;
  let inputDeductible = 0;
  const count = int(1, 35);
  for (let i = 0; i < count; i += 1) {
    const direction = pick(['Output', 'Input']);
    const status = pick(['Valid', 'Issued', 'Approved', 'Draft', 'Cancelled', 'Rejected', '']);
    const vatAmount = money(0, 15_000_000);
    const deductible = rnd() >= 0.35;
    const invoiceDate = rnd() < 0.9 ? date(int(1, 28)) : '2026-08-01';
    taxInvoices.push({ id: `VAT-${scenario}-${i}`, direction, status, date: invoiceDate, vatAmount, deductible });
    const included = VAT_ACTIVE.has(String(status).trim().toLowerCase()) && invoiceDate >= RANGE.from && invoiceDate <= RANGE.to;
    if (!included) continue;
    if (direction === 'Output') output += Math.round(vatAmount);
    else {
      inputAll += Math.round(vatAmount);
      if (deductible) inputDeductible += Math.round(vatAmount);
    }
  }
  const actual = C.vatRegisterSummary({ taxInvoices }, RANGE);
  assert.deepEqual(actual, {
    output,
    inputAll,
    inputDeductible,
    payable: Math.max(0, output - inputDeductible),
    creditCarry: Math.max(0, inputDeductible - output)
  }, `VAT scenario ${scenario}`);
}

// 3) Labor costing: approved/posted timesheets only; Fixed staff burden and CTV hourly rate are independently recalculated.
for (let scenario = 0; scenario < 2000; scenario += 1) {
  const settings = { monthlyWorkingHours: int(140, 220), employerBurdenRate: int(0, 35) };
  const people = Array.from({ length: int(1, 12) }, (_, i) => {
    const type = rnd() < 0.55 ? 'Fixed' : 'CTV';
    return type === 'Fixed'
      ? { id: `P${i}`, type, monthlySalary: money(5_000_000, 80_000_000) }
      : { id: `P${i}`, type, hourlyRate: money(40_000, 1_500_000) };
  });
  const timesheets = [];
  let expectedRaw = 0;
  for (let i = 0; i < int(1, 50); i += 1) {
    const person = pick(people);
    const approvedMode = pick(['approved-boolean', 'approved-status', 'posted-status', 'draft']);
    const row = { id: `TS-${scenario}-${i}`, date: date(int(1, 28)), projectId: rnd() < 0.8 ? 'PRJ' : 'OTHER', personId: person.id, hours: Math.round((rnd() * 12 + 0.25) * 4) / 4 };
    if (approvedMode === 'approved-boolean') row.approved = true;
    else if (approvedMode === 'approved-status') row.status = 'Approved';
    else if (approvedMode === 'posted-status') row.status = 'Posted';
    else row.status = 'Draft';
    timesheets.push(row);
    const recognized = approvedMode !== 'draft' && row.projectId === 'PRJ';
    if (recognized) {
      const rate = person.type === 'CTV'
        ? Math.max(0, Number(person.hourlyRate))
        : Math.max(0, Number(person.monthlySalary)) * (1 + settings.employerBurdenRate / 100) / settings.monthlyWorkingHours;
      expectedRaw += row.hours * rate;
    }
  }
  const expected = Math.round(expectedRaw);
  const actual = C.laborCost({ settings, people, timesheets }, { ...RANGE, projectId: 'PRJ' });
  assert.equal(actual, expected, `labor scenario ${scenario}`);
}

// 4) Invoice allocations: accepted rows must be posted, date-valid and remain within both invoice and payment caps.
for (let scenario = 0; scenario < 2500; scenario += 1) {
  const invoiceTotal = money(1_000, 100_000_000);
  const paymentAmount = money(1_000, 100_000_000);
  const invoice = { id: 'INV', direction: 'Output', date: '2026-07-01', status: 'Valid', projectId: 'PRJ', totalAmount: invoiceTotal, taxBase: invoiceTotal, vatAmount: 0 };
  const payment = { id: 'PAY', type: 'Income', status: 'Paid', date: '2026-07-03', projectId: 'PRJ', amount: paymentAmount };
  const paymentAllocations = [];
  for (let i = 0; i < int(1, 20); i += 1) {
    paymentAllocations.push({
      id: `A${String(i).padStart(2, '0')}`,
      invoiceId: rnd() < 0.92 ? 'INV' : 'OTHER',
      paymentId: rnd() < 0.92 ? 'PAY' : 'MISSING',
      date: pick(['2026-07-02', '2026-07-03', '2026-07-04', 'bad-date']),
      status: pick(['Posted', 'Applied', 'Draft', 'Cancelled']),
      amount: money(1, Math.max(invoiceTotal, paymentAmount))
    });
  }
  const sorted = paymentAllocations.slice().sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.id).localeCompare(String(b.id)));
  const recognized = sorted.filter((row) => {
    const validStatus = ['posted', 'paid', 'applied', 'completed'].includes(String(row.status).toLowerCase());
    const validDate = /^2026-07-\d{2}$/.test(row.date) && row.date >= payment.date;
    return validStatus && validDate && row.invoiceId === 'INV' && row.paymentId === 'PAY' && Math.round(Number(row.amount) || 0) > 0;
  });
  const admittedByCap = (rows, cap) => {
    let used = 0;
    const ids = new Set();
    for (const row of rows) {
      const amount = Math.max(0, Math.round(Number(row.amount) || 0));
      if (used + amount > cap + 1) continue;
      used += amount;
      ids.add(row.id);
    }
    return ids;
  };
  const invoiceAccepted = admittedByCap(recognized, invoiceTotal);
  const paymentAccepted = admittedByCap(recognized, paymentAmount);
  const acceptedIds = new Set([...invoiceAccepted].filter((id) => paymentAccepted.has(id)));
  const usedInvoice = recognized.filter((row) => acceptedIds.has(row.id)).reduce((sum, row) => sum + Math.max(0, Math.round(Number(row.amount) || 0)), 0);
  const db = { taxInvoices: [invoice], finance: [payment], paymentAllocations };
  const actual = C.invoiceAllocatedAmount(db, invoice, { asOf: '2026-07-31' });
  assert.equal(actual, usedInvoice, `allocation scenario ${scenario}; accepted ${[...acceptedIds].join(',')}`);
  assert(actual <= invoiceTotal, `invoice cap scenario ${scenario}`);
  assert(actual <= paymentAmount, `payment cap scenario ${scenario}`);
  const aging = C.invoiceAging(db, { direction: 'Output', asOf: '2026-07-31', to: '2026-07-31' });
  assert.equal(aging.rows[0].allocated, actual, `aging allocated scenario ${scenario}`);
  assert.equal(aging.rows[0].outstanding, invoiceTotal - actual, `aging outstanding scenario ${scenario}`);
  assert.equal(aging.totals.original, invoiceTotal, `aging total scenario ${scenario}`);
  assert.equal(aging.totals.allocated + aging.totals.outstanding, aging.totals.original, `aging identity scenario ${scenario}`);
}

// 5) Straight-line allocation/depreciation: no negative month, exact VND total, deterministic final-month remainder.
for (let scenario = 0; scenario < 2500; scenario += 1) {
  const cost = money(0, 5_000_000_000);
  const residual = money(0, cost);
  const months = int(1, 600);
  const startMonth = int(1, 12);
  const schedule = C.straightLineSchedule({ sourceId: `ASSET-${scenario}`, kind: 'asset', cost, residualValue: residual, months, startDate: `2026-${String(startMonth).padStart(2, '0')}-01` });
  const depreciable = Math.max(0, Math.round(cost) - Math.round(residual));
  assert.equal(schedule.length, months, `schedule length ${scenario}`);
  assert.equal(schedule.reduce((sum, row) => sum + row.amount, 0), depreciable, `schedule total ${scenario}`);
  assert(schedule.every((row) => Number.isInteger(row.amount) && row.amount >= 0), `nonnegative integer schedule ${scenario}`);
  assert.equal(new Set(schedule.map((row) => row.id)).size, months, `unique schedule IDs ${scenario}`);
  const base = Math.floor(depreciable / months);
  if (months > 1) assert(schedule.slice(0, -1).every((row) => row.amount === base), `base amount ${scenario}`);
  assert.equal(schedule.at(-1).amount, depreciable - base * (months - 1), `last remainder ${scenario}`);
}

// 6) Contract status and project-control identities under randomized project scenarios.
for (let scenario = 0; scenario < 1500; scenario += 1) {
  const masterValue = money(1_000_000, 3_000_000_000);
  const projectStatus = pick(['Active', 'In progress', 'Lead', 'Proposal', 'Cancelled', 'Completed']);
  const contracts = Array.from({ length: int(0, 5) }, (_, i) => ({
    id: `CTR${i}`,
    projectId: 'PRJ',
    contractType: 'Customer',
    status: pick(['Signed', 'Active', 'Approved', 'Draft', 'Proposal', 'Pending', 'Cancelled']),
    valueExclVat: money(1_000_000, 1_000_000_000)
  }));
  const committedStatuses = new Set(['signed', 'active', 'approved']);
  const committedFromContracts = contracts.filter((row) => committedStatuses.has(row.status.toLowerCase())).reduce((sum, row) => sum + Math.round(row.valueExclVat), 0);
  const pipeline = ['lead', 'proposal'].includes(projectStatus.toLowerCase());
  const excluded = projectStatus.toLowerCase() === 'cancelled';
  const expectedContract = committedFromContracts > 0 ? committedFromContracts : (!pipeline && !excluded ? masterValue : 0);
  const expectedPipeline = pipeline && committedFromContracts <= 0 ? masterValue : 0;
  const directBudget = money(0, masterValue);
  const progress = Math.round(rnd() * 10000) / 100;
  const actualCost = money(0, Math.max(1, directBudget * 2));
  const db = {
    settings: { monthlyWorkingHours: 176, targetMargin: 30 },
    accounts: [
      { code: '154', type: 'Asset', normalSide: 'Debit', active: true, postable: true },
      { code: '331', type: 'Liability', normalSide: 'Credit', active: true, postable: true },
      { code: '5113', type: 'Revenue', normalSide: 'Credit', active: true, postable: true },
      { code: '131', type: 'Asset', normalSide: 'Debit', active: true, postable: true }
    ],
    openingBalances: [], accountingPeriods: [], people: [], timesheets: [], finance: [], taxInvoices: [], paymentAllocations: [],
    clients: [{ id: 'CLIENT' }],
    projects: [{ id: 'PRJ', code: `PRJ-${scenario}`, name: 'Simulation', clientId: 'CLIENT', pmId: 'PM', status: projectStatus, contractValue: masterValue, directBudget, progress, progressMode: 'manual', startDate: '2026-01-01', endDate: '2026-12-31' }],
    contracts, billingMilestones: [], projectStages: [], resourcePlans: [], commitments: [], projectBudgetVersions: [], projectBudgetLines: [],
    journalEntries: actualCost > 0 ? [{ id: 'COST', date: '2026-07-10', documentNo: `COST-${scenario}`, status: 'Posted', projectId: 'PRJ', lines: [{ accountCode: '154', debit: actualCost, credit: 0 }, { accountCode: '331', debit: 0, credit: actualCost }] }] : []
  };
  const commercial = C.projectCommercialValue(db, db.projects[0]);
  assert.equal(commercial.committedValue, expectedContract, `committed contract ${scenario}`);
  assert.equal(commercial.pipelineValue, expectedPipeline, `pipeline contract ${scenario}`);
  const result = C.projectFinancials(db, 'PRJ', { to: '2026-07-31' });
  assert.equal(result.contractValue, expectedContract, `project contract identity ${scenario}`);
  assert.equal(result.pipelineValue, expectedPipeline, `project pipeline identity ${scenario}`);
  assert.equal(result.actualCost, actualCost, `actual cost scenario ${scenario}`);
  assert(result.estimateAtCompletion >= result.actualCost, `EAC >= actual ${scenario}`);
  assert.equal(result.forecastCostToComplete, Math.max(0, result.estimateAtCompletion - result.actualCost), `ETC identity ${scenario}`);
  assert.equal(result.forecastProfit, result.contractValue - result.estimateAtCompletion, `forecast profit identity ${scenario}`);
  assert.equal(result.budgetVariance, result.directBudget - result.estimateAtCompletion, `budget variance identity ${scenario}`);
  assert.equal(result.actualProfit, result.recognizedRevenue - result.actualCost, `actual profit identity ${scenario}`);
  assert(result.backlog >= 0 && result.receivableGross >= 0 && result.receivableNet >= 0, `commercial nonnegative ${scenario}`);
  assert(result.invoiceCollectionRate >= 0 && result.invoiceCollectionRate <= 100 + 1e-9, `collection rate cap ${scenario}`);
}

// 7) Balanced double-entry ledger and TT133 cross-report checks against independent totals.
const ACCOUNTS = [
  ['1111', 'Asset', 'Debit'], ['1121', 'Asset', 'Debit'], ['131', 'Asset', 'Debit'], ['1331', 'Asset', 'Debit'],
  ['331', 'Liability', 'Credit'], ['33311', 'Liability', 'Credit'], ['411', 'Equity', 'Credit'],
  ['5113', 'Revenue', 'Credit'], ['632', 'Expense', 'Debit'], ['6422', 'Expense', 'Debit'], ['8211', 'Expense', 'Debit']
].map(([code, type, normalSide]) => ({ code, type, normalSide, active: true, postable: true }));
for (let scenario = 0; scenario < 750; scenario += 1) {
  const journalEntries = [];
  let sequence = 0;
  const addEntry = (description, cashFlowCode, lines, day = int(1, 28), status = 'Posted') => {
    const entry = { id: `J-${scenario}-${sequence}`, date: date(day), documentNo: `DOC-${scenario}-${sequence}`, status, description, cashFlowCode, lines };
    sequence += 1;
    journalEntries.push(entry);
  };
  const capital = money(2_000_000_000, 10_000_000_000);
  let cash = capital;
  let ar = 0;
  let ap = 0;
  let vatPayable = 0;
  let expectedRevenue = 0;
  let expectedExpense = 0;
  addEntry('Góp vốn', '31', [{ accountCode: '1121', debit: capital, credit: 0 }, { accountCode: '411', debit: 0, credit: capital }], 1);
  for (let i = 0; i < int(10, 35); i += 1) {
    const mode = int(0, 6);
    if (mode === 0 || mode === 1) {
      const net = money(1_000_000, 100_000_000);
      const vat = Math.round(net * pick([0, 0.05, 0.08, 0.1]));
      const gross = net + vat;
      expectedRevenue += net;
      vatPayable += vat;
      if (mode === 0) {
        addEntry('Bán hàng thu tiền', '01', [{ accountCode: '1111', debit: gross, credit: 0 }, { accountCode: '5113', debit: 0, credit: net }, ...(vat ? [{ accountCode: '33311', debit: 0, credit: vat }] : [])]);
        cash += gross;
      } else {
        addEntry('Bán chịu', '', [{ accountCode: '131', debit: gross, credit: 0 }, { accountCode: '5113', debit: 0, credit: net }, ...(vat ? [{ accountCode: '33311', debit: 0, credit: vat }] : [])]);
        ar += gross;
      }
    } else if (mode === 2 || mode === 3) {
      const net = money(1_000_000, 60_000_000);
      const vat = Math.round(net * pick([0, 0.05, 0.08, 0.1]));
      const gross = net + vat;
      expectedExpense += net;
      vatPayable -= vat;
      const expenseAccount = rnd() < 0.5 ? '632' : '6422';
      if (mode === 2 && cash >= gross) {
        addEntry('Chi phí trả tiền', '02', [{ accountCode: expenseAccount, debit: net, credit: 0 }, ...(vat ? [{ accountCode: '1331', debit: vat, credit: 0 }] : []), { accountCode: '1121', debit: 0, credit: gross }]);
        cash -= gross;
      } else {
        addEntry('Chi phí mua chịu', '', [{ accountCode: expenseAccount, debit: net, credit: 0 }, ...(vat ? [{ accountCode: '1331', debit: vat, credit: 0 }] : []), { accountCode: '331', debit: 0, credit: gross }]);
        ap += gross;
      }
    } else if (mode === 4 && ar > 0) {
      const amount = money(1, ar);
      addEntry('Thu công nợ', '01', [{ accountCode: '1121', debit: amount, credit: 0 }, { accountCode: '131', debit: 0, credit: amount }]);
      cash += amount;
      ar -= amount;
    } else if (mode === 5 && ap > 0 && cash > 0) {
      const amount = money(1, Math.min(ap, cash));
      addEntry('Trả công nợ', '02', [{ accountCode: '331', debit: amount, credit: 0 }, { accountCode: '1121', debit: 0, credit: amount }]);
      cash -= amount;
      ap -= amount;
    } else {
      const amount = money(1, Math.max(1, Math.min(cash, 20_000_000)));
      addEntry('Chuyển quỹ nội bộ', '', [{ accountCode: '1111', debit: amount, credit: 0 }, { accountCode: '1121', debit: 0, credit: amount }]);
    }
  }
  // An unbalanced Draft entry must not contaminate any Posted report.
  addEntry('Draft không cân', '', [{ accountCode: '1111', debit: 999, credit: 0 }, { accountCode: '331', debit: 0, credit: 1 }], 20, 'Draft');
  const db = { settings: {}, accounts: ACCOUNTS, openingBalances: [], accountingPeriods: [], journalEntries };
  const tb = C.trialBalance(db, RANGE);
  assert.equal(tb.balanced, true, `trial balance ${scenario}`);
  assert.equal(tb.totals.debit, tb.totals.credit, `debit-credit ${scenario}`);
  assert.equal(tb.totals.endingDebit, tb.totals.endingCredit, `ending balance ${scenario}`);
  const pnl = C.profitAndLoss(db, RANGE);
  assert.equal(pnl.revenue, expectedRevenue, `revenue ${scenario}`);
  assert.equal(pnl.expenseBeforeTax, expectedExpense, `expense ${scenario}`);
  assert.equal(pnl.profitBeforeTax, expectedRevenue - expectedExpense, `PBT ${scenario}`);
  const b02 = C.tt133B02(db, RANGE);
  assert.equal(b02.profitBeforeTax, pnl.profitBeforeTax, `B02 linkage ${scenario}`);
  const checks = C.tt133ReportChecks(db, RANGE);
  assert.equal(checks.pass, true, `TT133 checks scenario ${scenario}: ${JSON.stringify(checks.checks)}`);
  const ledgerCash = C.ledgerCashFlow(db, RANGE);
  const b03 = C.tt133B03Direct(db, RANGE);
  assert.equal(b03.net, ledgerCash.net, `B03 net vs ledger ${scenario}`);
  assert.equal(b03.reconciled, true, `B03 reconciliation ${scenario}`);
}

console.log('PASS 15,250 deterministic independent formula simulation scenarios');
