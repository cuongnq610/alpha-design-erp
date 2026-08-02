#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(path)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const app=read('app.js');
const css=read('alpha-design-system.css');
const offline=read('scripts/offline-browser-audit.py');
const xss=read('scripts/xss-browser-audit.py');
const invariants=read('scripts/production-invariants-browser-v4527.py');
const globalTables=read('scripts/focused-global-table-columns-v4525.py');
const runner=read('tests/run-browser-release-audit.sh');
const version=JSON.parse(read('VERSION.json'));
const build=read('scripts/build-public.mjs');

assert.equal(version.version,'4.5.57','QA hardening release version must be exact');
assert.match(app,/const STORAGE_KEY = 'alpha_design_erp_cloud_v4_5_57_qa_hardened'/,'Release data must use a new storage namespace');
assert.match(app,/LEGACY_STORAGE_KEYS\.unshift\('alpha_design_erp_cloud_v4_5_56_version_final'\)/,'v4.5.56 local data must migrate into v4.5.57');
assert.match(build,/index-qa-demo-v4\.5\.57\.html/,'Public build must include the exact QA demo entry');
assert.match(build,/qa-demo-seed-v4557\.js/,'Public build must include the exact QA seed');
assert.match(app,/const ratios=\[\.20,\.11,\.17,\.18,\.18,\.16\]/,'Dashboard must reserve enough width for full VND values');
assert.match(css,/dashboard-col-contract\{width:18%\}/,'Dashboard contract column width must match the runtime grid');
assert.match(css,/dashboard-col-cost\{width:18%\}/,'Dashboard cost column width must match the runtime grid');
assert.match(css,/\.payroll-plan-charts\{grid-template-columns:minmax\(0,2fr\) minmax\(360px,\.9fr\)!important\}/,'Payroll donut card must retain enough intrinsic width without causing body overflow');
assert.match(app,/const authoredScrollable=table\.classList\.contains\('payroll-detail-table'\)\|\|table\.classList\.contains\('annual-benefit-table'\)/,'Authored wide payroll tables must be identified');
assert.match(app,/const desktopFit=window\.innerWidth>=1280 && columnCount<=12 && !authoredScrollable/,'Authored wide payroll tables must retain horizontal scrolling on desktop');

for(const [name,source] of [['offline',offline],['xss',xss]]){
  assert.match(source,/'tax-calendar\.js'/,`${name} audit must load the required tax-calendar module`);
  assert.match(source,/wait_for_function\("\(\) => Boolean\(window\.AlphaERP && window\.AlphaProductionGuard\)"/,`${name} audit must wait for application readiness`);
}

assert.match(invariants,/window\.__qaConfirms=\[\]/,'Production invariant audit must capture confirmations');
assert.match(invariants,/Soft archive marks project Archived/,'Production invariant audit must validate archival state');
assert.match(invariants,/Soft archive preserves linked contracts/,'Production invariant audit must validate referential preservation');
assert.match(globalTables,/authored_scroll=t\.get\('gridContract'\)=='authored' and t\.get\('scrollRegion'\)/,'Global table audit may exempt only accessible authored scroll regions from desktop fitting');
assert.match(runner,/if \[\[ \$SUMMARY_CODE -ne 0 && \$FAILURES -eq 0 \]\]; then FAILURES=1; fi/,'Browser runner must not double-count failed steps');

console.log('PASS v4.5.57 browser audit, desktop table and soft-archive regression contract');
