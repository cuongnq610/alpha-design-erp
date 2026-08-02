import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const core=readFileSync(new URL('../calculation-core.js',import.meta.url),'utf8');
const demo=readFileSync(new URL('../demo-enterprise-seed.js',import.meta.url),'utf8');

for(const marker of [
  "field('vendorId','Nhà cung cấp (nếu là khoản chi)'",
  "field('invoiceId','Hóa đơn đầu vào được thanh toán'",
  'trạng thái Paid nhập tay không đủ làm bằng chứng',
  'Calc.inputInvoicePaymentConstraint(db,data,id)',
  "field('paymentStatus','Tình trạng tham khảo'",
  'Có — chỉ tính phần đủ chứng từ'
]) assert.ok(app.includes(marker),`Input-VAT UI is missing ${marker}`);

for(const marker of [
  'function inputVatBankPaymentMatch',
  'function inputVatPaymentEvidence',
  'function inputInvoicePaymentConstraint',
  'verifiedPaidGross:evidence.paidGross',
  'VAT_PARTIAL_PAYMENT',
  'VAT_PAYMENT_LINK',
  'prepaidCurrent',
  'prepaidLongTerm'
]) assert.ok(core.includes(marker),`Calculation core is missing ${marker}`);

assert.match(demo,/vendorId, invoiceId: inputInvoiceId, amount: directGross/,'Enterprise demo expenses must link vendor and Input invoice evidence');

console.log('PASS v4.5.62 Input-VAT evidence data entry and TK242 parity UI/core wiring');
