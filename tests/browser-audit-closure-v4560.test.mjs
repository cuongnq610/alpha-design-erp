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

assert.equal(version.version,'4.5.67','Recycle-bin restore release version must be exact');
assert.match(app,/const STORAGE_KEY = 'alpha_design_erp_cloud_v4_5_58_tt99_export_activation'/,'Release must preserve the v4.5.58 data namespace because there is no payload migration');
assert.match(app,/LEGACY_STORAGE_KEYS\.unshift\('alpha_design_erp_cloud_v4_5_57_qa_hardened','alpha_design_erp_cloud_v4_5_56_version_final'\)/,'Historical local data migration must remain available');
assert.match(build,/index-qa-demo-v4\.5\.60\.html/,'Public build must include the exact QA demo entry');
assert.match(build,/qa-demo-seed-v4560\.js/,'Public build must include the exact QA seed');
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
assert.match(runner,/EXPECTED_STEPS=18/,'Browser runner must include the TT99 and all-format export gate audits');


const exportCenter=read('export-center.js');
const calc=read('calculation-core.js');
const sw=read('sw.js');
assert.match(exportCenter,/if \(!state\.selected \|\| !cats\[state\.selected\]\) state\.selected = regime/,'Selecting TT99 must not be reset to TT133');
assert.doesNotMatch(exportCenter,/state\.selected!==regime/,'Cross-regime preview must remain selectable');
assert.match(exportCenter,/const expectedRegime = statutoryRegimeCode\(workbook\)/,'Statutory gate must derive TT99 or TT133 from the selected workbook');
assert.match(exportCenter,/TT99 bị khóa phát hành/,'TT99 compatibility preview must fail closed until Appendix IV mapping is validated');
assert.match(exportCenter,/if \(workbook\.id==='tt133'\) \{/,'TT133 Cloud certificate checks must not incorrectly block the TT99 or TT132 local gates');
assert.match(exportCenter,/const tt133ReportDb = cloudNotes\.length \? \{ \.\.\.db, reportNotesTT133: cloudNotes \} : db/,'TT133 Cloud notes must be isolated from TT99 export calculations');
assert.match(exportCenter,/const t99b01Raw=Calc\.tt99B01\(db,range\).*t99b09=Calc\.tt99B09\(db,range\)/s,'TT99 export calculations must use the unmodified TT99 database');
assert.match(calc,/Array\.isArray\(db\?\.reportNotesTT99\)/,'TT99 B09 calculation must isolate TT99 notes');
assert.match(app,/data-note-type="\$\{isTT99\?'reportNotesTT99':'reportNotesTT133'\}"/,'TT99 statutory screen must expose B09 editing');
assert.match(app,/reportNotesTT99:\{title:'Thuyết minh B09-DN'/,'TT99 B09 form configuration is missing');
assert.match(sw,/TT99_2026_BASELINE_TEMPLATE\.json/,'Offline shell must include the TT99 baseline template');
assert.equal(version.uiRuntimeAudit.fullBrowserRunnerCompleted,false,'Current release must not claim an unexecuted browser rerun');
assert.equal(version.uiRuntimeAudit.browserAuditPassedSteps,3,'Current release must record static-security, auth/MFA and structural browser steps');
assert.equal(version.uiRuntimeAudit.structuralAuditCurrentReleaseCompleted,true,'Exact-package structural browser evidence is required');
assert.equal(version.uiRuntimeAudit.structuralStates,378,'Structural state count is stale');
assert.equal(version.uiRuntimeAudit.targetedTT99BrowserPassedChecks,0,'TT99 publication is intentionally blocked');
assert.equal(version.uiRuntimeAudit.exportCenterPassedChecks,version.uiRuntimeAudit.exportCenterChecks,'All export-center checks must pass');

console.log('PASS v4.5.67 fail-closed export gate, truthful browser evidence and TT99 publication-block contract');
