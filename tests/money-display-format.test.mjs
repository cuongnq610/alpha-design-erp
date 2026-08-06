import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const appSrc=fs.readFileSync(path.join(root,'app.js'),'utf8');

// Vietnamese money rule: a compact amount must never display >= 1.000 of a smaller unit —
// it escalates to the next unit (nghìn -> triệu -> tỷ). Bug was: 999.999.999 VND rendered
// as "1.000 tr" (= 1.000 triệu) instead of "1 tỷ", because the unit was picked by magnitude
// BEFORE rounding, and fmtNum then rounded the scaled value up to 1000.

// Faithful mirror of the fixed formatters (app.js compactMoney / chartMoneyAxisMeta).
const fmtNum=(v,digits=1)=>new Intl.NumberFormat('vi-VN',{maximumFractionDigits:digits}).format(Number(v)||0);
const UNITS=[{t:1e3,u:'nghìn',d:0},{t:1e6,u:'tr',d:1},{t:1e9,u:'tỷ',d:2}];
function compactMoney(v){
  const n=Number(v)||0,a=Math.abs(n);
  let i=-1;for(let k=0;k<UNITS.length;k++)if(a>=UNITS[k].t)i=k;
  if(i<0)return fmtNum(n,0);
  while(i<UNITS.length-1&&Math.abs(Number((n/UNITS[i].t).toFixed(UNITS[i].d)))>=1000)i++;
  const {t,u,d}=UNITS[i];
  return `${fmtNum(n/t,d)} ${u}`;
}
function chartMoneyAxisMeta(maxValue){
  const max=Math.abs(Number(maxValue)||0);
  const trDecimals=max>=100?0:1;
  if(Number(max.toFixed(trDecimals))>=1000)return {divisor:1000,unit:'tỷ',decimals:max>=10000?0:1};
  return {divisor:1,unit:'tr',decimals:trDecimals};
}

// --- the reported bug and its neighbours ---
assert.equal(compactMoney(1_000_000_000),'1 tỷ','exactly 1 tỷ');
assert.equal(compactMoney(999_999_999),'1 tỷ','≈1 tỷ must NOT be "1.000 tr"');
assert.equal(compactMoney(999_950_000),'1 tỷ','rounds up to 1 tỷ');
assert.equal(compactMoney(999_999),'1 tr','≈1 triệu must NOT be "1.000 nghìn"');
assert.equal(compactMoney(999_500),'1 tr','rounds up to 1 triệu');

// --- normal values keep their natural unit ---
assert.equal(compactMoney(0),'0');
assert.equal(compactMoney(500),'500','sub-nghìn stays raw');
assert.equal(compactMoney(12_500),'13 nghìn');
assert.equal(compactMoney(1_000_000),'1 tr');
assert.equal(compactMoney(2_500_000),'2,5 tr');
assert.equal(compactMoney(1_500_000_000),'1,5 tỷ');
assert.equal(compactMoney(1_234_567_890),'1,23 tỷ');
assert.equal(compactMoney(-999_999_999),'-1 tỷ','sign preserved');
assert.equal(compactMoney(1_000_000_000_000),'1.000 tỷ','trillions cap at tỷ (VN: nghìn tỷ)');

// --- no "≥1000 in a smaller unit" ever escapes, across a wide sweep ---
for(let e=2;e<=13;e++){
  for(const base of [1,1.5,3.3,9.99,9.999,9.9999]){
    const out=compactMoney(base*10**e);
    const m=out.match(/^-?([\d.,]+)\s+(nghìn|tr|tỷ)$/);
    if(m&&m[2]!=='tỷ'){
      const num=Number(m[1].replace(/\./g,'').replace(/,/g,'.'));
      assert.ok(num<1000,`compactMoney(${base*10**e})="${out}" must not show ≥1000 of a non-tỷ unit`);
    }
  }
}

// --- chart axis: the top tick must escalate to tỷ instead of showing "1.000 tr" ---
let meta=chartMoneyAxisMeta(999.9); // triệu, i.e. ~1 tỷ padded axis top
assert.equal(meta.unit,'tỷ','axis top ≈1.000 triệu escalates to tỷ');
meta=chartMoneyAxisMeta(1045);
assert.equal(meta.unit,'tỷ');
assert.equal(fmtNum(1045/meta.divisor,meta.decimals)+' '+meta.unit,'1 tỷ');
meta=chartMoneyAxisMeta(550);
assert.equal(meta.unit,'tr','sub-tỷ axis stays in triệu');
assert.equal(fmtNum(550/meta.divisor,meta.decimals)+' '+meta.unit,'550 tr');

// --- static guards: the real source carries the escalation logic ---
assert.ok(/while\(i<COMPACT_MONEY_UNITS\.length-1&&Math\.abs\(Number\(\(n\/COMPACT_MONEY_UNITS\[i\]\.t\)\.toFixed\(COMPACT_MONEY_UNITS\[i\]\.d\)\)\)>=1000\)i\+\+/.test(appSrc),'compactMoney must escalate on rounding');
assert.ok(/if\(Number\(max\.toFixed\(trDecimals\)\)>=1000\)\s*return\s*\{divisor:1000,unit:'tỷ'/.test(appSrc),'chartMoneyAxisMeta must escalate on rounding');
assert.ok(appSrc.includes('chartMoneyAxisMeta(barMax)'),'comboChart must pick the unit from the padded axis top (barMax)');

console.log('PASS money-display-format: compact/chart formatters follow VN unit escalation');
