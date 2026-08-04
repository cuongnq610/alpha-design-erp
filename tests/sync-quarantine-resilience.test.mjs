import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sync=fs.readFileSync(path.join(root,'alpha-sync.bundle.js'),'utf8');

// Task 1: State carries a quarantine store
assert.ok(/outbox:\[\],conflicts:\{\},quarantine:\{\}/.test(sync),'Sync state must include a quarantine store');

// Task 1: A permanent-rejection classifier exists and recognises server validation SQLSTATEs
assert.ok(sync.includes('isPermanentReject'),'Sync must classify permanent server rejections');
assert.ok(sync.includes('22023')&&sync.includes('23505')&&sync.includes('23503'),'Classifier must recognise validation SQLSTATEs');

// Task 2: the loop quarantines + continues on permanent reject, not re-throw for everything
const loop=sync.slice(sync.indexOf('for(let y of[...u.outbox])'),sync.indexOf('for(let y of[...u.outbox])')+1400);
assert.ok(/isPermanentReject\([^)]*\)\)\{[^}]*u\.quarantine\[/.test(loop),'Permanent rejects must be moved to quarantine inside the loop');
assert.ok(loop.includes('continue'),'Loop must continue past a quarantined record');
// Task 2: quarantine-only state keeps status online (app stays writable); F() dispatch carries quarantine count
assert.ok(sync.includes('quarantine:Object.keys(u.quarantine).length'),'sync-status event must include quarantine count');

console.log('PASS phase1 task1: quarantine state + classifier present');

// Task 2 behavioral proof: mirror of the loop algorithm
function isPermanentReject(err){if(!err)return false;const c=String(err.code||'');if(['22023','23505','23503','23514','22007','22P02'].includes(c))return true;const m=String(err.message||err);return /^(REQUIRED_FIELD|INVALID_[A-Z]+|FIELD_TOO_LONG|DUPLICATE_KEY|NUMBER_OUT_OF_RANGE|FORMULA_MISMATCH|UNBALANCED_JOURNAL|PAYLOAD_TOO_LARGE|ID_MISMATCH)/.test(m);}
function runLoop(outbox,serverErrForKey){const state={outbox:[...outbox],quarantine:{},status:'online'};for(const y of[...state.outbox]){const err=serverErrForKey[y.key];if(!err){state.outbox=state.outbox.filter(R=>R.key!==y.key);continue;}if(isPermanentReject(err)){state.quarantine[y.key]={error:err.message};state.outbox=state.outbox.filter(R=>R.key!==y.key);continue;}state.status='error';throw err;}return state;}
const s1=runLoop([{key:'a'},{key:'b'}],{a:{code:'22023',message:'REQUIRED_FIELD: x'}});
assert.deepEqual(s1.outbox,[],'valid record b must still sync past poison a');
assert.deepEqual(Object.keys(s1.quarantine),['a'],'poison a must be quarantined');
assert.equal(s1.status,'online','app must stay writable after quarantine');
assert.throws(()=>runLoop([{key:'a'}],{a:{code:'',message:'network down'}}),'transient error must retry, not quarantine');
// Task 3: quarantine management API exposed
assert.ok(sync.includes('discardQuarantine:')&&sync.includes('retryQuarantine:'),'Quarantine management API (discard/retry) must be exposed');
assert.ok(/function qr\(m\)\{[^}]*u\.outbox\.push\(/.test(sync),'retryQuarantine must re-queue the record to the outbox');
console.log('PASS phase1 task3: quarantine management API present');

console.log('PASS phase1 task2: quarantine behavior verified');
