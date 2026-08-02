import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(p)=>fs.readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
const app=read('app.js');
const css=read('alpha-design-system.css');
const cloud=read('cloud-v2.js');
const exportsJs=read('export-center.js');
const publicApp=read('public/app.js');
const publicCss=read('public/alpha-design-system.css');

for(const marker of [
  'planning-table-stack','table-planning-budget','table-planning-resource','table-planning-commitments',
  'crm-mix-stage-grid','crm-customer-revenue-grid','crm-pipeline-card','table-pipeline',
  'cash-balance-grid','cash-transactions-card','table-finance-transactions',
  'financial-equal-grid','table-financial-key-ratios','table-financial-growth','table-financial-ratios',
  'accounting-overview-tables','table-trial-balance','table-journals','partner-balance-grid',
  'tax-compliance-card','tax-invoice-card','table-tax-invoices'
]) assert.ok(app.includes(marker),`Missing v4.5.9 layout marker: ${marker}`);

for(const marker of ['table-cloud-backups','mode-selector','automation-list'])
  assert.ok(cloud.includes(marker),`Missing v4.5.9 cloud layout marker: ${marker}`);
assert.ok(exportsJs.includes('table-export-log'), 'Export log must use the fitted table layout');

assert.match(css,/\.planning-table-stack,\.accounting-overview-tables\{display:grid;gap:16px\}/,'Planning/accounting stacks must use a one-column grid');
assert.match(css,/\.cash-balance-grid[^\{]*\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/,'Paired cash panels must share equal columns');
assert.match(css,/\.crm-mix-stage-grid\s*\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/,'CRM department and stage charts must share equal columns');
assert.match(css,/\.table-action-group\s*\{[^}]*display:flex/,'Table actions need an internal flex group');
assert.match(css,/\.table-actions\s*\{[^}]*display:table-cell!important/,'Action TD must retain table-cell layout');
assert.match(css,/\.balanced-table\.table-pipeline \.table-col-actions,[\s\S]*?width:116px!important/,'Pipeline action column must be explicitly sized');
assert.match(css,/\.balanced-table\.table-finance-transactions \.table-col-actions,[\s\S]*?width:116px!important/,'Cash action column must be explicitly sized');
assert.match(css,/\.balanced-table\.table-journals \.table-col-actions\{width:164px!important/,'Journal action column must fit all controls');
assert.match(css,/\.table-fit-wide\s*\{[^}]*width:100%/,'Desktop fit-table contract is missing');
assert.equal(publicApp,app,'Public app.js must exactly match source app.js');
assert.equal(publicCss,css,'Public CSS must exactly match source CSS');
console.log('UI_FULL_TABLE_LAYOUT_V459_TESTS_PASSED');
