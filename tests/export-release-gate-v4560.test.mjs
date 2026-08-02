#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(path)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const source=read('export-center.js');
const app=read('app.js');

assert.match(source,/async function ensureStatutoryReleaseReady\(workbook, m = meta\(\)\)/,'A shared statutory export gate is required');
assert.match(source,/await ensureStatutoryReleaseReady\(wb, m\)/,'Single-report exports must pass the shared statutory gate');
assert.match(source,/await ensureStatutoryReleaseReady\(activeStatutory, m\)/,'Full ZIP packages must pass the active statutory gate');
assert.match(source,/async function printSelectedWorkbook\(\)/,'Direct print/PDF must use an asynchronous certified gate');
assert.match(source,/document\.getElementById\('printExport'\).*printSelectedWorkbook/,'The direct print action must not bypass certification');
assert.doesNotMatch(source,/state\.format !== 'json'/,'JSON must not bypass the statutory release gate');
assert.match(source,/isTT132Regime\?'Dong_tien_quan_tri':isTT99Regime\?'B03_DN':'B03_DNN'/,'Cash-flow package must follow the active accounting regime');
assert.match(source,/Hệ thống tài khoản \$\{isTT99Regime\?'TT99':isTT132Regime\?'TT132':'TT133'\}/,'Account master title must follow the active accounting regime');
assert.match(source,/TT99 bị khóa phát hành/,'TT99 export must fail closed while its mapping is only a TT133-derived preview');
assert.match(source,/String\(cert\.release_version \|\| ''\) !== releaseVersion\(\)/,'Cloud certificate gate must follow the actual release version');
assert.match(source,/DATABASE_MIGRATION_VERSION = 75/,'Cloud certificate gate must require migration 075');
assert.match(app,/table\.dataset\.gridVersion=RELEASE_VERSION/,'Table audit metadata must follow the current release');

console.log('PASS v4.5.67 fail-closed statutory XLSX/PDF/CSV/XML/DOCX/JSON/ZIP gate, TT99 publication block and current certificate binding');
