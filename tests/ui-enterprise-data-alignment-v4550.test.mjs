import assert from 'node:assert/strict';
import fs from 'node:fs';
const app=fs.readFileSync('app.js','utf8');
const css=fs.readFileSync('alpha-design-system.css','utf8');
const migration=fs.readFileSync('supabase/migrations/068_enterprise_data_alignment_operational_audit_v4550.sql','utf8');
for(const marker of [
  'table-purchase-orders table-fit-wide',
  "table.classList.contains('annual-benefit-table')",
  "table.classList.contains('table-purchase-orders')&&columnCount===9",
  'đánh giá|nhóm|tính chất|vai trò|bộ phận|hành động|phân hệ|thanh toán|chứng từ',
  'table.dataset.gridVersion=RELEASE_VERSION',
  "releaseVersion:'4.5.55',migrationVersion:68"
]) assert.ok(app.includes(marker),`missing v4.5.50 app marker: ${marker}`);
for(const marker of [
  'v4.5.50 — enterprise table semantics',
  '.table-purchase-orders th:nth-child(6)',
  '.payroll-detail-table tbody .payroll-sticky-col',
  '.payroll-detail-table thead .payroll-sticky-col',
  '.annual-benefit-table col:nth-child(10)',
  '.annual-benefit-table thead th'
]) assert.ok(css.includes(marker),`missing v4.5.50 CSS marker: ${marker}`);
assert.ok(migration.includes("('4.5.50','Enterprise table data alignment, complete payroll sticky header and operational regression binding')"));
assert.ok(migration.includes("p_release_version<>'4.5.50' or p_migration_version<>68"));
console.log('PASS v4.5.50 enterprise data alignment and payroll sticky header source wiring');
