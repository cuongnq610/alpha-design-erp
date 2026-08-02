import assert from 'node:assert/strict';
import fs from 'node:fs';
const css=fs.readFileSync('alpha-design-system.css','utf8');
const version=JSON.parse(fs.readFileSync('VERSION.json','utf8'));
assert.ok(['4.5.55','4.5.56','4.5.57','4.5.58','4.5.59','4.5.60','4.5.61','4.5.62','4.5.63','4.5.64','4.5.65','4.5.67'].includes(version.version));
for(const marker of [
  'v4.5.51 — global column-content centering across every operational table',
  '#appShell .table-wrap table>tbody>tr>td',
  '#appShell .table-wrap table>tfoot>tr>td',
  'text-align:center!important',
  'vertical-align:middle!important',
  'text-align-last:center',
  ':is(.table-action-group,.audit-action-cell)'
]) assert.ok(css.includes(marker),`missing global centering marker: ${marker}`);
assert.ok(!css.includes('v4.5.51 — global column-content centering across every operational table. */\n#appShell .table-wrap table>thead>tr>th{'), 'body/footer selectors must be included, not header-only');
console.log('PASS inherited v4.5.51 global table column content centering source contract on v4.5.54');
