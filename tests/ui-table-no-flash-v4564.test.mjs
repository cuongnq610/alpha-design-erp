import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const start=app.indexOf('  function render(options={})');
const end=app.indexOf('\n\n  function renderDashboard()',start);
assert.ok(start>=0&&end>start,'Shared render function is missing');
const renderSource=app.slice(start,end);

const replaceIndex=renderSource.indexOf('content.innerHTML=fn()');
const layoutIndex=renderSource.indexOf('enhanceResponsiveTables();');
const restoreIndex=renderSource.indexOf('restoreTableViewportState(viewportState,viewportContext);');
assert.ok(replaceIndex>=0&&layoutIndex>replaceIndex&&restoreIndex>layoutIndex,'Table layout and viewport restore must complete synchronously after DOM replacement');
assert.equal(
  /requestAnimationFrame\([^\n]*restoreTableViewportState\(viewportState,viewportContext\)/.test(renderSource),
  false,
  'Viewport restore must never wait for an animation frame that can expose row 1'
);
assert.match(renderSource,/không có khung hình tạm ở dòng 1/,'The no-first-row-frame invariant must be documented beside the render path');

console.log('PASS inherited v4.5.64 table viewport is restored before the first browser paint');
