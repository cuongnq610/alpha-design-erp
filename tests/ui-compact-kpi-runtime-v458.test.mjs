import assert from 'node:assert/strict';
import fs from 'node:fs';

const css=fs.readFileSync(new URL('../alpha-design-system.css',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const publicCss=fs.readFileSync(new URL('../public/alpha-design-system.css',import.meta.url),'utf8');
const publicApp=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');

assert.match(app,/class="kpi-status-badge" role="status">Cần chú ý/,'KPI attention state must use a semantic child badge');
assert.doesNotMatch(app,/kpi-card\.is-attention::after/,'Application markup must not depend on pseudo-element attention text');
assert.match(css,/\.kpi-card::after\s*\{[\s\S]*?content:none!important;[\s\S]*?display:none!important;/,'Decorative KPI pseudo-element must be disabled');
assert.match(css,/\.kpi-status-badge\s*\{/,'Attention badge CSS is missing');
assert.match(css,/dashboard-kpi-grid>\.kpi-card:nth-child\(-n\+4\)\{min-height:126px/,'Desktop core KPI cards are not compacted');
assert.match(css,/project-plan-kpi-grid>\.kpi-card\{min-height:104px/,'Planning KPI cards are not compacted');
assert.equal(publicCss,css,'Public CSS must exactly match source CSS');
assert.equal(publicApp,app,'Public app must exactly match source app');
console.log('UI_COMPACT_KPI_RUNTIME_V458_TESTS_PASSED');
