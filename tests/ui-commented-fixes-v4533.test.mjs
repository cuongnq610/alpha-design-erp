import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(p)=>fs.readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
const app=read('app.js');
const css=read('alpha-design-system.css');
const index=read('index.html');
const cloud=read('cloud-v2.js');

assert.ok(app.includes("customers.map(x=>x.name)"),'Customer chart must use full customer names');
assert.equal(app.includes("x.name.slice(0,12)+'…'"),false,'Customer names must not be truncated');
assert.ok(app.includes("className:'customer-label-chart',scrollLabels:true"),'Customer chart must support readable horizontal labels');
assert.ok(css.includes('.crm-primary-stack')&&css.includes('grid-template-columns:minmax(0,1fr)'),'Primary CRM charts must be independent full-width rows');
assert.ok(css.includes('.crm-revenue-grid')&&css.includes('repeat(2,minmax(0,1fr))'),'Customer and stage charts must be equal-width peers');

assert.ok(app.includes('syncSidebarGridState'),'Sidebar grid sync helper is missing');
assert.ok(css.includes('.app-shell.sidebar-is-collapsed'),'Collapsed app-shell grid rule is missing');
assert.ok(css.includes('grid-template-columns:72px minmax(0,1fr)'),'Collapsed sidebar must release unused grid width');
assert.ok(css.includes('.sidebar.collapsed .nav::-webkit-scrollbar{display:none}'),'Collapsed sidebar scrollbar must not cover icons');

for(const marker of ['function filtersForView','function matchesViewFilters','function filterRowsForView','function bindLocalTableFilters']) assert.ok(app.includes(marker),`Missing working filter marker: ${marker}`);
assert.ok(app.includes('data-local-table-filter="documentsTable"'),'Documents need a local status filter');
assert.ok(app.includes('data-local-table-filter="controlProjectTable"'),'Control table needs a local filter');
assert.ok(app.includes('data-local-table-filter="staffCostTable"'),'Payroll staff-cost table needs a local department filter');
assert.ok(app.includes('data-local-table-filter="recentJournalTable"'),'Recent journals need a local project filter');
assert.equal(app.includes('Bản Core quản lý metadata'),false,'Removed document prototype note must not render');

assert.ok(app.includes('departmentStructure(active)')&&app.includes('people-structure-final'),'Detailed department structure must replace the duplicate specialty chart');
assert.ok(app.includes('completion-month-summary'),'People completion chart needs Done/Total monthly explanation');

assert.equal(app.includes('function usageGuide(view)'),false,'Quick usage panels must be removed');
assert.equal(app.includes('Hướng dẫn sử dụng nhanh'),false,'Quick usage panel text must be removed');
assert.equal(app.includes('dashboard-load-note section'),false,'Dashboard load-test note must be removed');
assert.equal(cloud.includes('Phạm vi Demo:'),false,'Annotated integration scope line must be removed');

assert.ok(index.includes('id="filterDrawer"'),'Filter drawer must remain available');
console.log('UI_TARGETED_FIXES_V4534_TESTS_PASSED');
