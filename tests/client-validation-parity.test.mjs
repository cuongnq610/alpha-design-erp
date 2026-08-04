import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(import.meta.url);
const Calc=require('../calculation-core.js');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');

// The shared validator exists and is exported on Calc
assert.equal(typeof Calc.validateEntityPayload,'function','Calc.validateEntityPayload must be exported');
// The form submit choke point calls it before persisting
assert.ok(app.includes('Calc.validateEntityPayload'),'submit path must call the shared validator');

const V=(coll,data,db={},id='')=>Calc.validateEntityPayload(coll,data,db,id);
const hasErr=(res,marker)=>res.errors.some(e=>e.startsWith(marker));

// Unknown collection: no rules -> always ok (never blocks unrelated forms)
assert.equal(V('somethingRandom',{}).ok,true,'unknown collection must not be blocked');

// accounts parity (server: code<=32 + ^[0-9A-Za-z._-]+$, name required<=240, type enum)
assert.equal(V('accounts',{code:'111',name:'Tiền mặt',type:'Asset'}).ok,true,'valid account passes');
assert.equal(hasErr(V('accounts',{code:'11 1',name:'x',type:'Asset'}),'INVALID_ACCOUNT_CODE'),true,'space in account code rejected');
assert.equal(hasErr(V('accounts',{code:'111',name:'',type:'Asset'}),'REQUIRED_FIELD'),true,'missing account name rejected');
assert.equal(hasErr(V('accounts',{code:'111',name:'x',type:'Nonsense'}),'INVALID_ENUM'),true,'bad account type rejected');
// duplicate code (excluding self by id)
const accdb={accounts:[{id:'a1',code:'111'}]};
assert.equal(hasErr(V('accounts',{code:'111',name:'x',type:'Asset'},accdb,'a2'),'DUPLICATE_KEY'),true,'duplicate account code rejected');
assert.equal(V('accounts',{code:'111',name:'x',type:'Asset'},accdb,'a1').ok,true,'same record editing its own code is fine');

// projects parity (refs to clients/people must exist; contractValue>0; progress 0..100; date format)
const pdb={clients:[{id:'c1'}],people:[{id:'p1'}]};
const validProject={code:'PRJ1',name:'DA',clientId:'c1',pmId:'p1',startDate:'2026-01-01',contractValue:1000,directBudget:500,progress:10};
assert.equal(V('projects',validProject,pdb).ok,true,'valid project passes');
assert.equal(hasErr(V('projects',{...validProject,clientId:''},pdb),'REQUIRED_FIELD'),true,'missing clientId rejected');
assert.equal(hasErr(V('projects',{...validProject,clientId:'ghost'},pdb),'INVALID_REFERENCE'),true,'unknown clientId rejected');
assert.equal(hasErr(V('projects',{...validProject,contractValue:0},pdb),'NUMBER_OUT_OF_RANGE'),true,'zero contractValue rejected');
assert.equal(hasErr(V('projects',{...validProject,progress:150},pdb),'NUMBER_OUT_OF_RANGE'),true,'progress>100 rejected');
assert.equal(hasErr(V('projects',{...validProject,startDate:'01/01/2026'},pdb),'INVALID_DATE'),true,'non-ISO startDate rejected');

console.log('PASS phase2 task6: shared validator (accounts, projects) behaviorally verified');
