import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sync=fs.readFileSync(path.join(root,'alpha-sync.bundle.js'),'utf8');

// Regression: the login init path (le -> sn) upserts device_registrations. A supabase-js
// PostgREST builder is a thenable (has .then) but has NO .catch method, so calling
// `.upsert(...).catch(()=>{})` throws "TypeError: p.from(...).upsert(...).catch is not a
// function" on the FIRST login, rejecting sn() -> le() -> signIn() -> "Đăng nhập thất bại".

// A faithful stand-in for a PostgREST builder: awaitable, but .catch is undefined.
function builderLike(){
  return {then(resolve){resolve({data:null,error:null});},upsert(){return this;},from(){return this;}};
}
const b=builderLike();
assert.equal(typeof b.catch,'undefined','PostgREST builder must not expose .catch (models the real hazard)');

// The broken pattern throws synchronously when .catch is read+called.
assert.throws(()=>b.upsert({}).catch(()=>{}),/catch is not a function/,'unguarded .catch on a builder must throw');

// The fixed pattern (await the thenable inside try/catch) must resolve without throwing.
await assert.doesNotReject(async()=>{try{await b.upsert({});}catch(_e){}},'awaiting the builder in try/catch must be safe');

// Static guard: device registration must NOT use an unguarded builder .catch anymore,
// and must be wrapped so a failure can never break login init.
assert.ok(sync.includes('from("device_registrations").upsert('),'device registration upsert must exist');
assert.ok(!/upsert\([^;]*\}\)\.catch\(\(\)=>\{\}\)/.test(sync),'device registration must not call .catch() on the PostgREST builder');
assert.ok(/try\{await p\.from\("device_registrations"\)\.upsert\([^;]*\)\}catch/.test(sync),'device registration upsert must be awaited inside try/catch');

console.log('PASS login device-registration guard: builder .catch hazard fixed');
