import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../alpha-design-system.css',import.meta.url),'utf8');
for(const marker of ['function logicalRowCells(','function clearGeneratedTableGrid(','table-column-grid','table-grid-exact','table.dataset.gridVersion=RELEASE_VERSION',"table.dataset.gridContract=fitDesktop?'fitted':'scroll'"])assert.ok(app.includes(marker),`missing global table grid marker ${marker}`);
assert.ok(!app.includes("[...table.querySelectorAll('colgroup')].forEach(group=>group.remove())"),'authored colgroups must never be removed');
for(const marker of ['v4.5.45 — exact global table column grid alignment','.table-wrap>table.table-grid-exact','.table-wrap>table.table-generated-grid','--table-grid-width','border-inline-end'])assert.ok(css.includes(marker),`missing global table grid CSS ${marker}`);
console.log('PASS v4.5.45 exact global table column-grid alignment static contract');
