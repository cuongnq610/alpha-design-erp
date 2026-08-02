import assert from 'node:assert/strict';
import fs from 'node:fs';
const app=fs.readFileSync('app.js','utf8');
const css=fs.readFileSync('alpha-design-system.css','utf8');
for(const marker of [
  'function scheduleTableRelayout()',
  'tableLayoutResizeObserver',
  'table.dataset.gridVersion=RELEASE_VERSION',
  "return 'table-col-date'",
  'columnLooksNumeric',
  'scheduleTableRelayout();'
]) assert.ok(app.includes(marker),`missing responsive sidebar/table marker ${marker}`);
for(const marker of [
  'v4.5.48 — collapsed-sidebar table reflow and centered quantitative data',
  '.app-shell.sidebar-is-collapsed .table-wrap',
  '.balanced-table .table-col-numeric',
  '.balanced-table .table-col-date',
  'text-align:center!important'
]) assert.ok(css.includes(marker),`missing centered table CSS marker ${marker}`);
console.log('PASS v4.5.49 collapsed-sidebar reflow and global quantitative/date centering wiring');
