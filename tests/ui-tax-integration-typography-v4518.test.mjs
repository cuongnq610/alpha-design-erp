import assert from 'node:assert/strict';
import fs from 'node:fs';
const app=fs.readFileSync('app.js','utf8'),cloud=fs.readFileSync('cloud-v2.js','utf8'),css=fs.readFileSync('alpha-design-system.css','utf8');
for(const marker of ['function pitWithholdingsTable(rows)','function citAdjustmentsTable(rows)','Khấu trừ thuế TNCN','Điều chỉnh thuế TNDN'])assert.ok(app.includes(marker),`Missing Accounting Tax runtime marker: ${marker}`);
for(const marker of ['data-automation-config="email"','data-automation-config="bank"','function openAutomationConfig(kind)','Lưu cấu hình Demo'])assert.ok(cloud.includes(marker),`Missing integration action marker: ${marker}`);
for(const marker of ['v4.5.18 — typography safety','.kpi-value{','line-height:1.24!important','automation-list .alert-item'])assert.ok(css.includes(marker),`Missing typography/integration CSS marker: ${marker}`);
console.log('PASS v4.5.18 Accounting Tax runtime, email/bank configuration actions and typography safety static assertions');
