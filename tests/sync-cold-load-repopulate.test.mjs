import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sync=fs.readFileSync(path.join(root,'alpha-sync.bundle.js'),'utf8');

// Regression: the cloud pull (ft) rebuilds the local db from server rows, but it skips
// applying a row when its cached hash (u.hashes[key]) still matches the server hash.
// u.hashes is PERSISTED across reloads while the actual db is NOT (production db is
// memory-only; and the pull full-resets collections when a server "manifest" row exists).
// So after a refresh the persisted hashes matched the server, every row was skipped, the
// full-reset left the db empty, and applyRemote(empty) WIPED the data. Fix: hashes must
// not outlive the db — they are re-initialised to {} on every load, forcing the first
// pull of a session to fully re-apply the server rows.

const COLLECTIONS=['projects','clients'];
const SYSTEM='system';
const hash=v=>JSON.stringify(v); // any deterministic function is fine for the model
const clone=v=>JSON.parse(JSON.stringify(v));

// Faithful model of ft()'s apply gate.
function pullApply(serverRows,appDb,state){
  let w=clone(appDb),changed=false;
  const hasManifest=serverRows.some(R=>R.collection===SYSTEM&&R.record_id==='manifest'&&!R.deleted_at);
  if(hasManifest&&state.outbox.length===0){for(const c of COLLECTIONS)w[c]=[];changed=true;}
  for(const R of serverRows){
    if(R.collection===SYSTEM)continue;
    const key=R.collection+':'+R.record_id;
    const h=hash(R.deleted_at?{deleted:true}:R.data);
    if(state.hashes[key]!==h){ // apply
      const arr=Array.isArray(w[R.collection])?w[R.collection]:[];
      const idx=arr.findIndex(x=>String(x.id)===String(R.record_id));
      if(R.deleted_at){if(idx>=0)arr.splice(idx,1);}else if(idx>=0)arr[idx]=R.data;else arr.push(R.data);
      w[R.collection]=arr; changed=true;
    }
    state.hashes[key]=h;
  }
  return {w,changed};
}

// Server has the data plus a manifest marker; outbox empty (everything already synced).
const serverRows=[
  {collection:SYSTEM,record_id:'manifest',data:{},deleted_at:null},
  {collection:'projects',record_id:'p1',data:{id:'p1',name:'Alpha'},deleted_at:null},
  {collection:'clients',record_id:'c1',data:{id:'c1',name:'Acme'},deleted_at:null},
];
const persistedHashes={
  'projects:p1':hash({id:'p1',name:'Alpha'}),
  'clients:c1':hash({id:'c1',name:'Acme'}),
};

// --- OLD behaviour: hashes persist across reload; production db loads empty ---
{
  const state={outbox:[],hashes:clone(persistedHashes)}; // restored, matches server
  const {w}=pullApply(serverRows,{projects:[],clients:[]},state);
  assert.equal(w.projects.length,0,'BUG repro: persisted hashes + full-reset leave projects empty');
  assert.equal(w.clients.length,0,'BUG repro: data wiped after refresh');
}

// --- NEW behaviour: hashes reset to {} on load, so the first pull fully re-applies ---
{
  const state={outbox:[],hashes:{}}; // <-- the fix: cold-load starts with empty hashes
  const {w,changed}=pullApply(serverRows,{projects:[],clients:[]},state);
  assert.equal(w.projects.length,1,'FIX: projects repopulated from server after refresh');
  assert.equal(w.clients.length,1,'FIX: clients repopulated from server after refresh');
  assert.equal(w.projects[0].name,'Alpha');
  assert.equal(changed,true,'FIX: applyRemote runs because rows were re-applied');
}

// --- Static guard: the bundle must reset hashes to {} on load (after restoring state) ---
assert.ok(sync.includes(',...l(r,{}),hashes:{}}'),'sync state must re-initialise hashes to {} on every load');

console.log('PASS sync cold-load repopulate: hashes no longer outlive the db');
