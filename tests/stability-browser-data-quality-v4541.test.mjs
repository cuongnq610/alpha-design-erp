import assert from 'node:assert/strict';
import fs from 'node:fs';
const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const calc=fs.readFileSync(new URL('../calculation-core.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../alpha-design-system.css',import.meta.url),'utf8');
const offline=fs.readFileSync(new URL('../scripts/offline-browser-audit.py',import.meta.url),'utf8');
const xss=fs.readFileSync(new URL('../scripts/xss-browser-audit.py',import.meta.url),'utf8');
assert.match(app,/minimums=\[84,78,94,102,86,58,90,132,132\]/,'VAT desktop geometry must fit 1280 content width, preserve the type label, and keep control/action columns aligned');
assert.match(app,/floors=\[70,74,84,94,68,54,72,126,126\]/,'VAT shrink floors must preserve readable column boundaries at desktop minimum width');
assert.match(css,/v4\.5\.41 — VAT table desktop fit/);
assert.match(css,/min-width:132px!important/);
assert.match(css,/min-width:118px!important/);
for(const script of [offline,xss]){
  const report=script.indexOf("'reporting-period.js'");
  const template=script.indexOf("'statutory-template-manager.js'");const payroll=script.indexOf("'payroll-detail.js'");
  const appIndex=script.indexOf("'app.js'");
  assert.ok(report>0&&template>report&&appIndex>template,'QA browser script must load report modules before app.js');
}
assert.match(calc,/portfolio\.contractedRows\.filter\(\(x\) => x\.eacConfidence === 'Low'\)/,'EAC confidence gate must exclude pipeline projects');
assert.match(app,/id:'je6'.*?status:'Posted'/s,'Demo revenue must include a posted COGS transfer');
assert.match(app,/evidenceScope": "demo-simulated"/,'Demo B09 evidence must be explicitly marked simulated');
console.log('PASS v4.5.41 browser QA, VAT layout and demo data-quality regression');
