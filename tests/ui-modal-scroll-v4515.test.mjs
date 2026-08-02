import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../alpha-design-system.css',import.meta.url),'utf8');
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
for(const marker of ['modal scroll containment','body.modal-open','overflow-y:auto','scrollbar-gutter:stable','z-index:1400','touch-action:pan-y'])assert.ok(css.includes(marker),marker);
for(const marker of ['syncModalOpenState','MutationObserver(syncModalOpenState)','modalForm.scrollTop=0','modalForm.scrollTop+=e.deltaY'])assert.ok(app.includes(marker),marker);
assert.ok(css.includes('.modal{display:flex;flex-direction:column;min-height:0}'));
assert.ok(css.includes('.modal-form{flex:1 1 auto;min-height:0'));
console.log('UI_MODAL_SCROLL_V4515_OK');
