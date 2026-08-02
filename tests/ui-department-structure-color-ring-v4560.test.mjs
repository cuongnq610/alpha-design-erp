import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const css=fs.readFileSync(path.join(root,'alpha-design-system.css'),'utf8');
const publicApp=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
const publicCss=fs.readFileSync(path.join(root,'public/alpha-design-system.css'),'utf8');

assert.ok(app.includes("conic-gradient(from -90deg,${slices})"),'Department summary must render a data-driven conic-gradient ring');
assert.ok(app.includes('style="--department-ring:${ring}"'),'Department ring must receive the computed palette');
assert.ok(app.includes('role="img" aria-label="${esc(summary)}"'),'Department ring must expose an accessible summary');
assert.ok(app.includes("'#06b6d4','#ec4899'"),'Palette must provide distinct colors for all nine demo departments');
assert.ok(css.includes('background:var(--department-ring,#dceeff)'),'Department ring CSS must use the computed color property');
assert.ok(css.includes('.department-structure-summary::before'),'Department ring must retain a readable inner surface');
assert.deepEqual(Buffer.from(publicApp),Buffer.from(app),'Public app.js must match the source after build');
assert.deepEqual(Buffer.from(publicCss),Buffer.from(css),'Public CSS must match the source after build');
console.log('PASS department structure summary uses a colored proportional donut ring with accessible text');
