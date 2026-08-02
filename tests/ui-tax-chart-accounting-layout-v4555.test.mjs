import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../alpha-design-system.css',import.meta.url),'utf8');
const version=JSON.parse(readFileSync(new URL('../VERSION.json',import.meta.url),'utf8'));
const taxReference=readFileSync(new URL('../tax-compliance-reference.js',import.meta.url),'utf8');
const statutoryManager=readFileSync(new URL('../statutory-template-manager.js',import.meta.url),'utf8');
const build=readFileSync(new URL('../scripts/build-public.mjs',import.meta.url),'utf8');

assert.ok(['4.5.55','4.5.56','4.5.57','4.5.58','4.5.59','4.5.60','4.5.61','4.5.62','4.5.63','4.5.64','4.5.65','4.5.67'].includes(version.version));
for(const marker of [
  "alpha_design_erp_cloud_v4_5_54_end_to_end_input_accounting_qa_ui_refinement",
  'chartMoneyAxisMeta',
  'Đơn vị: ${esc(axisUnit)}',
  'Lịch thuế ${calendarYear} & nhắc việc',
  'taxCalendarSourceInfo',
  "filter(x=>String(x.period||'').includes(String(calendarYear)))",
  'applyAccountingRegimeProfile',
  "TT132/2018/TT-BTC",
  "profile.code==='TT132'",
  "Calc.tt99B01",
  'departmentStructure(active)',
  'documents-table-wrap',
  'compact-kpi-row planning-kpi-row',
  'compact-kpi-row control-kpi-row',
  'compact-kpi-row financial-kpi-row'
]) assert.ok(app.includes(marker),`Missing v4.5.55 app marker: ${marker}`);

assert.ok(!app.includes('2026.02-reference'), 'Internal tax package version must not be displayed');
assert.ok(!app.includes('TNDN quản trị theo ngày hiệu lực:'), 'Removed CIT explanatory line must stay removed');
for(const marker of [
  '.tax-compliance-grid',
  '.tax-compliance-grid .combo-chart{height:348px}',
  '.compact-kpi-row',
  '.documents-table-wrap{min-height:560px',
  '.department-structure',
  '.chart-unit-badge'
]) assert.ok(css.includes(marker),`Missing v4.5.55 CSS marker: ${marker}`);
for(const marker of ['2026.03-controlled','verifiedOn":"2026-07-30','sourcePolicy']) assert.ok(taxReference.includes(marker),`Missing tax provenance marker: ${marker}`);
assert.ok(statutoryManager.includes('TT132'), 'TT132 package compatibility is missing');
assert.ok(/index-qa-demo-v4\.5\.(55|56|57|58|59|60)\.html/.test(build), 'Current QA demo must be published');
console.log('PASS tax provenance, dynamic chart scale, compact KPI, TT133/TT99 accounting-regime and department-layout contract');
