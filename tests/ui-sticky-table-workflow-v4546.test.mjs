import assert from 'node:assert/strict';
import fs from 'node:fs';
const app=fs.readFileSync('app.js','utf8');
const css=fs.readFileSync('alpha-design-system.css','utf8');
const index=fs.readFileSync('index.html','utf8');
const build=fs.readFileSync('scripts/build-public.mjs','utf8');
const ref=fs.readFileSync('statutory-template-reference.js','utf8');
for(const marker of ['function configureTableScrollExperience(','native-bottom-only','table-scroll-frame','function workflowGateAttrs(','data-workflow-ready','workflow-helper','window.AlphaStatutoryTemplateReference','migrationVersion:68']) assert.ok(app.includes(marker),`missing v4.5.46 app marker ${marker}`);
for(const marker of ['v4.5.46 — sticky table headers','.table-wrap.table-scroll-frame','position:sticky!important','text-align:center!important','v4.5.49 — bottom-only horizontal scrolling','.payroll-detail-table tbody td:nth-child(4)','.payroll-detail-table tbody td:nth-child(5)']) assert.ok(css.includes(marker),`missing v4.5.46 CSS marker ${marker}`);
assert.ok(index.indexOf('statutory-template-reference.js')>index.indexOf('statutory-template-manager.js'),'reference package must load after template manager');
assert.ok(build.includes("'statutory-template-reference.js'"),'public builder must copy embedded TT133 reference');
assert.ok(ref.startsWith('window.AlphaStatutoryTemplateReference='),'embedded TT133 reference package missing');
for(const id of ['generatePayrollPeriod','reviewPayrollPeriod','approvePayrollPeriod','lockPayrollPeriod','generateAnnualBenefitBudget','reviewAnnualBenefitBudget','approveAnnualBenefitBudget','lockAnnualBenefitBudget']){
  const start=app.indexOf(`id="${id}"`); assert.ok(start>=0,`missing workflow button ${id}`);
  const snippet=app.slice(Math.max(0,start-100),start+300); assert.equal(/\sdisabled(?:\s|=|>)/.test(snippet),false,`${id} must give explicit feedback instead of being silently disabled`);
}
assert.ok(app.includes('topScroller?.remove();hint?.remove();'),'legacy top scrollers must be removed');
console.log('PASS v4.5.49 sticky long-table headers, centered headings, workflow feedback and embedded TT133 reference');
