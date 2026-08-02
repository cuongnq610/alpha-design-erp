import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(file)=>readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const app=read('app.js');
const css=read('alpha-design-system.css');
const version=JSON.parse(read('VERSION.json'));

assert.ok(['4.5.55','4.5.56','4.5.57','4.5.58','4.5.59','4.5.60','4.5.61','4.5.62','4.5.63','4.5.64','4.5.65','4.5.67'].includes(version.version));
for(const marker of [
  'dashboard-core-grid','dashboard-context-grid','dashboard-source-card',"variant:'compact'",'variantClass',
  'approve-timesheet','approveTimesheetRecord','bindTimesheetApprovalActions',
  "Payroll.refreshDraftPeriods(db,uid)","requirePrivilegedAction(['timesheet.approve']"
]) assert.ok(app.includes(marker),`Missing v4.5.54 application marker: ${marker}`);
for(const marker of [
  'v4.5.54 — compact executive dashboard',
  '.dashboard-context-grid', '.kpi-card--compact', '.approve-timesheet',
  '.sidebar.collapsed .nav-item.active', 'width:48px', 'overflow:hidden'
]) assert.ok(css.includes(marker),`Missing v4.5.54 CSS marker: ${marker}`);

const payrollStart=app.indexOf('function payrollDetailTable');
const payrollEnd=app.indexOf('function renderPayroll',payrollStart);
const payrollTable=app.slice(payrollStart,payrollEnd);
assert.ok(payrollTable.length>1000,'Payroll table source not found');
assert.equal(/cell-auto-source[^\n]{0,160}Tự động/.test(payrollTable),false,'Payroll cells must not visibly label automatic values');
assert.ok(payrollTable.includes('giờ OT'),'Automatic overtime hours must remain visible and auditable');
assert.ok(payrollTable.includes('Thủ công'),'Manual override indicators must remain visible');

const timesheetStart=app.indexOf('function timesheetsTable');
const timesheetEnd=app.indexOf('function renderPeople',timesheetStart);
const timesheetTable=app.slice(timesheetStart,timesheetEnd);
assert.ok(timesheetTable.includes("x.approved?'':`<button"),'Approval action must only render for Pending rows');
assert.ok(timesheetTable.includes('data-record-id'),'Timesheet rows must remain focusable after approval');
assert.ok(app.includes('bindTimesheetApprovalActions(host)'),'Filtered timesheet tables must rebind approval buttons');

const dashboardStart=app.indexOf('function renderDashboard');
const dashboardEnd=app.indexOf('function kpi(',dashboardStart);
const dashboard=app.slice(dashboardStart,dashboardEnd);
assert.ok(dashboard.includes('dashboard-core-grid')&&dashboard.includes('dashboard-context-grid'),'Dashboard hierarchy must have separate core/context grids');
assert.equal((dashboard.match(/dashboard-source-note/g)||[]).length,1,'Dashboard source explanation must render once');
console.log('PASS v4.5.54 operational input/accounting UI, direct timesheet approval, compact dashboard, payroll labels and collapsed sidebar contract');
