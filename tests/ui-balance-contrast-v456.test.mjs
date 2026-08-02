import assert from 'node:assert/strict';
import fs from 'node:fs';

const css=fs.readFileSync(new URL('../alpha-design-system.css',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');

assert.match(css,/v4\.5\.6 — balanced tables, true circular chart markers and dark-mode contrast hardening/);
assert.match(css,/\.legend-dot,\.donut-row i\{border-radius:50%!important\}/);
assert.match(css,/\.donut-center\{background:transparent!important;border-radius:50%\}/);
assert.match(css,/html\[data-theme="dark"\] \.donut::after\{background:var\(--surface\)!important;border-radius:50%\}/);
assert.match(css,/html\[data-theme="dark"\] \.donut-center\{background:transparent!important\}/);
assert(css.lastIndexOf('.donut-center{background:transparent!important') > css.indexOf('html[data-theme="dark"] .donut::after,html[data-theme="dark"] .donut-center'), 'The transparent circular center must override the legacy dark rectangular center rule.');

assert.match(css,/@media\(min-width:1360px\)\{[\s\S]*?\.dashboard-kpi-grid\{grid-template-columns:repeat\(7,minmax\(0,1fr\)\)\}/);
assert.match(css,/@media\(min-width:1025px\) and \(max-width:1359px\)\{[\s\S]*?\.project-plan-kpi-grid\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)\}/);
assert.match(css,/@media\(max-width:600px\)\{[\s\S]*?\.dashboard-kpi-grid>\.kpi-card:last-child:nth-child\(odd\)[\s\S]*?grid-column:1\/-1/);
assert.match(css,/\.kpi-foot\{[\s\S]*?display:grid;grid-template-columns:auto minmax\(0,1fr\)/);
assert.match(css,/\.kpi-label\{overflow-wrap:anywhere\}/);

assert.match(css,/\.balanced-table \.table-col-primary\{min-width:160px\}/);
assert.match(css,/\.balanced-table \.table-col-numeric\{min-width:116px;text-align:right;font-variant-numeric:tabular-nums\}/);
assert.match(css,/\.balanced-table \.table-col-actions\{width:var\(--table-action-width\)/);
assert.match(css,/@media\(min-width:1025px\)\{[\s\S]*?\.balanced-table\.table-fit\{min-width:0!important;table-layout:fixed\}/);
assert.match(css,/@media\(max-width:1024px\)\{[\s\S]*?\.balanced-table\{min-width:var\(--table-mobile-min,760px\)!important\}/);
assert.match(css,/\.balanced-table tbody tr:nth-child\(even\) td/);
assert.match(css,/\.balanced-table tbody tr:hover td/);

assert.match(css,/html\[data-theme="dark"\] \.kpi-label,[\s\S]*?html\[data-theme="dark"\] \.donut-row span:last-child,[\s\S]*?color:var\(--text\)!important/);
assert.match(css,/html\[data-theme="dark"\] \.kpi-icon\.purple\{color:#c8b2ff!important;background:#2b2348!important\}/);
assert.match(css,/html\[data-theme="dark"\] \.nav-group\.is-open \.nav-group-toggle\{color:#d9eef5\}/);
assert.match(css,/html\[data-theme="dark"\] \.balanced-table td\{color:var\(--text\)!important\}/);
assert.match(css,/html\[data-theme="dark"\] \.nav-item\.active \.nav-label\{color:#e8f7fb!important\}/);
assert.match(css,/html\[data-theme="dark"\] \.export-icon\.cyan\{color:#79d9ea!important\}/);

assert.match(app,/function enhanceResponsiveTables\(\)/);
assert.match(app,/table\.classList\.add\('balanced-table'\)/);
assert.match(app,/const forceFit=table\.classList\.contains\('table-fit-wide'\)/);
assert.match(app,/table\.classList\.toggle\('table-fit',columnCount<=6\|\|forceFit\)/);
assert.match(app,/table\.classList\.toggle\('table-wide',columnCount>=8&&\!forceFit(?:&&\!desktopFit)?\)/);
assert.match(app,/table\.style\.setProperty\('--table-mobile-min',`\$\{Math\.max\(700,columnCount\*112\)\}px`\)/);
assert.match(app,/if\(index===0\)return 'table-col-primary'/);
assert.match(app,/return 'table-col-numeric'/);
assert.match(app,/return 'table-col-progress'/);
assert.match(app,/return 'table-col-status'/);
assert.match(app,/header\.classList\.add\(columnClass\)/);
assert.ok(/row\.cells\[columnIndex\]\?\.classList\.add\(columnClass\)/.test(app)||/columnCells\.forEach\(cell=>cell\.classList\.add\(columnClass\)\)/.test(app));

console.log('PASS v4.5.6 UI balance, circular chart and dark-contrast regressions');
