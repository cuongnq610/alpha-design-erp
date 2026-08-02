import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../alpha-design-system.css',import.meta.url),'utf8');
const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const version=JSON.parse(readFileSync(new URL('../VERSION.json',import.meta.url),'utf8'));

for(const marker of [
  'Cơ cấu giờ làm việc đã duyệt theo tháng',
  'Giờ tính phí dự án',
  'Giờ nội bộ / không tính phí',
  'Tiền đã chi theo mục đích và theo tháng',
  'Số dư cuối tháng theo nơi giữ tiền',
  'Lịch thuế ${calendarYear} & nhắc việc',
  'syncTaxCalendar',
  'taxReminderWindowDays',
  'corporateTaxRateEffectiveDate',
  'citManualRateHistory',
  "db.settings.citRateMode='Manual'"
]) assert.ok(app.includes(marker),`missing v4.5.53 UI marker: ${marker}`);
assert.ok(!app.includes("field('citRateMode'"),'CIT mode selector must be removed from settings UI');
assert.ok(!app.includes('Điều kiện áp dụng mức 15% / 17%'),'15%/17% eligibility selector must be removed');
assert.ok(!app.includes('data-cit-auto-only'),'obsolete auto CIT UI wrapper must be removed');
for(const marker of ['chart-summary-strip','chart-explanation','tax-calendar-row','settings-wide-note'])assert.ok(css.includes(marker),`missing CSS marker ${marker}`);
assert.ok(index.includes('<script src="tax-calendar.js"></script>'),'tax calendar module must load before app');
assert.ok(['4.5.55','4.5.56','4.5.57','4.5.58','4.5.59','4.5.60','4.5.61','4.5.62','4.5.63','4.5.64','4.5.65','4.5.67'].includes(version.version));
console.log('PASS v4.5.53 clear charts, automatic tax reminders and manual effective-dated CIT settings UI');
