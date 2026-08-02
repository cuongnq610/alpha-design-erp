import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const helperStart=app.indexOf('  function tableViewportContext()');
const helperEnd=app.indexOf('\n\n  function render(options={})',helperStart);
assert.ok(helperStart>=0&&helperEnd>helperStart,'Shared table viewport helpers are missing');

for(const marker of [
  "content.querySelectorAll('.table-wrap')",
  'top:wrap.scrollTop',
  'left:wrap.scrollLeft',
  'anchorId:anchor?.dataset.recordId',
  'wrap.scrollTop=Math.max(0,Math.min(nextTop',
  'wrap.scrollLeft=Math.max(0,Math.min(Number(state.left)',
  'enhanceResponsiveTables();',
  'restoreTableViewportState(viewportState,viewportContext);',
  'render({preserveTableViewport:false})'
]) assert.ok(app.includes(marker),`Table viewport persistence is missing ${marker}`);

const captureIndex=app.indexOf('captureTableViewportState(viewportContext)');
const replaceIndex=app.indexOf('content.innerHTML=fn()');
const restoreIndex=app.indexOf('restoreTableViewportState(viewportState,viewportContext)');
assert.ok(captureIndex<replaceIndex&&replaceIndex<restoreIndex,'Viewport must be captured before and restored after the shared table render');

const makeWrap=({top=0,left=0,anchorOffsetTop=480}={})=>{
  const anchor={dataset:{recordId:'approval-42'},offsetTop:anchorOffsetTop,getBoundingClientRect:()=>({bottom:250})};
  const headers=[{textContent:'Ngày'},{textContent:'Thao tác'}];
  const table={id:'',querySelectorAll:selector=>selector==='thead th'?headers:[],tHead:{getBoundingClientRect:()=>({height:40})}};
  return {
    id:'',dataset:{},scrollTop:top,scrollLeft:left,scrollHeight:1200,clientHeight:300,scrollWidth:1400,clientWidth:700,
    querySelector:selector=>selector==='table'?table:selector.includes('approval-42')?anchor:null,
    querySelectorAll:selector=>selector==='tbody tr[data-record-id]'?[anchor]:[],
    closest:()=>null,getBoundingClientRect:()=>({top:100}),classList:{toggle:()=>{}}
  };
};

const oldWrap=makeWrap({top:320,left:145,anchorOffsetTop:480});
const content={dataset:{tableViewportContext:'same-view'},wraps:[oldWrap],querySelectorAll(){return this.wraps;}};
const viewport={x:null,y:null};
const sandbox={content,pendingFocus:null,window:{scrollX:11,scrollY:27,scrollTo:(x,y)=>{viewport.x=x;viewport.y=y;}}};
vm.createContext(sandbox);
vm.runInContext(`${app.slice(helperStart,helperEnd)}\nglobalThis.viewportApi={captureTableViewportState,restoreTableViewportState};`,sandbox);

const snapshot=sandbox.viewportApi.captureTableViewportState('same-view');
assert.equal(snapshot.tables[0].top,320);
assert.equal(snapshot.tables[0].left,145);
assert.equal(snapshot.tables[0].anchorId,'approval-42');
assert.equal(sandbox.viewportApi.captureTableViewportState('different-view'),null,'A navigation/filter context change must reset the table viewport');

const newWrap=makeWrap({top:0,left:0,anchorOffsetTop:500});
content.wraps=[newWrap];
sandbox.viewportApi.restoreTableViewportState(snapshot,'same-view');
assert.equal(newWrap.scrollTop,340,'The same visible approval row must keep its vertical offset after rerender');
assert.equal(newWrap.scrollLeft,145,'Horizontal table position must survive rerender');
assert.deepEqual(viewport,{x:11,y:27},'Page position must survive an in-view table action');

console.log('PASS inherited v4.5.63 shared table vertical/horizontal scroll and row-anchor persistence');
