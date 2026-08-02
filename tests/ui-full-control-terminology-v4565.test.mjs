import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync('app.js','utf8');
const calc=fs.readFileSync('calculation-core.js','utf8');
const css=fs.readFileSync('alpha-design-system.css','utf8');
const version=JSON.parse(fs.readFileSync('VERSION.json','utf8'));

assert.equal(version.version,'4.5.67','Current release must inherit the full control terminology contract');

for(const label of [
  'Công nợ phải thu',
  'Chi phí ước tính khi hoàn thành',
  'Chỉ số hiệu quả chi phí / Chỉ số hiệu quả tiến độ',
  'Biên lợi nhuận dự án thực tế',
  'Biên lợi nhuận dự án dự báo'
]) assert.ok(app.includes(label),`Missing full control label: ${label}`);

const actualPanel=app.slice(app.indexOf('function renderControlActual'),app.indexOf('function renderControlCommercial'));
for(const abbreviatedHeader of ['>AR<','>EAC<','>CPI / SPI<','>Actual Cost<','>Contract<','>Invoiced<']){
  assert.equal(actualPanel.includes(abbreviatedHeader),false,`Abbreviated control header remains: ${abbreviatedHeader}`);
}

for(const marker of [
  "['actual','Thực tế & dự báo']",
  "['commercial','Thương mại']",
  "['cash','Dòng tiền']",
  "['quality','Chất lượng dữ liệu']",
  "High:'Cao'",
  "'Coverage-qualified approved plan':'Kế hoạch được duyệt đủ độ bao phủ'"
]) assert.ok(app.includes(marker),`Missing localized terminology marker: ${marker}`);

assert.ok(calc.includes('Chỉ số hiệu quả chi phí dưới 0,90.'));
assert.ok(calc.includes('Chỉ số hiệu quả tiến độ dưới 0,90'));
assert.ok(calc.includes('Độ tin cậy của chi phí ước tính khi hoàn thành thấp'));
assert.ok(css.includes('.table-controls th:nth-child(7),.table-controls td:nth-child(7){width:9.5%}'));
assert.ok(css.includes('.table-controls th:nth-child(8),.table-controls td:nth-child(8){width:10.5%}'));

console.log('PASS v4.5.67 inherited full Vietnamese control terminology and long-header layout regression');
