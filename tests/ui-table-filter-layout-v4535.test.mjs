import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=(p)=>fs.readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
const app=read('app.js');
const css=read('alpha-design-system.css');

for(const marker of [
  'data-local-table-filter="resourcePlansTable"',
  'data-local-table-filter="toolsTable"',
  'data-local-table-filter="financialForecastTable"'
]) assert.ok(app.includes(marker),`Missing targeted table filter: ${marker}`);
assert.ok(app.includes("renderScheduleTable(db.toolAllocationSchedules,'Lịch phân bổ CCDC','toolAllocationScheduleTable')"),'CCDC schedule filter binding is missing');
assert.ok(app.includes('data-local-table-filter=\"${esc(filterId)}\"'),'Schedule table filter template is missing');

assert.ok(app.includes('crm-mix-stage-grid'),'Department mix and stage charts must share a dedicated row');
assert.ok(app.includes('crm-customer-revenue-grid'),'Customer revenue must occupy a dedicated full-width row');
assert.ok(app.includes("minPlotWidth:1180"),'Customer revenue plot needs enough horizontal label space');
assert.match(css,/\.crm-mix-stage-grid\s*\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/s);
assert.match(css,/\.crm-customer-revenue-grid\s*\{[^}]*grid-template-columns:minmax\(0,1fr\)/s);

assert.ok(app.includes('class="table-fit-wide table-tax-filings"'),'Tax filing table needs a dedicated layout class');
assert.ok(app.includes('tax-filing-reference-col'),'Tax filing column structure is missing');
assert.ok(app.includes('tax-invoice-content-col'),'VAT invoice column structure is missing');
assert.ok(app.includes("table.classList.contains('table-tax-filings')"),'Desktop tax filing geometry is missing');
assert.ok(app.includes("table.classList.contains('table-tax-invoices')"),'Desktop VAT invoice geometry is missing');
assert.match(css,/\.table-tax-filings\s*\{[^}]*table-layout:fixed!important/s);
assert.match(css,/\.table-tax-invoices\s*\{[^}]*table-layout:fixed!important/s);

console.log('PASS v4.5.36 targeted table filters, CRM layout and tax column regression');
