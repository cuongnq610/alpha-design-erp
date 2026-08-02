import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const sw=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');
const currentCache=sw.match(/const CACHE=`\$\{CACHE_PREFIX\}([^`]+)`;/)?.[1] ? `alpha-design-erp-${sw.match(/const CACHE=`\$\{CACHE_PREFIX\}([^`]+)`;/)[1]}` : '';
assert.ok(currentCache,'Current cache namespace could not be parsed from sw.js');
const previousCache='alpha-design-erp-v4-5-28-engineering-qa';
const shellMatch=sw.match(/const SHELL=\[(.*?)\];/s)?.[1]||'';
assert.equal(shellMatch.includes('runtime-config.js'),false,'Environment-sensitive runtime config must not be pre-cached');
assert.ok(sw.includes("url.pathname===RUNTIME_CONFIG_PATH"),'Runtime config needs a dedicated exact-path branch');
assert.ok(sw.includes("fetch(event.request,{cache:'no-store'})"),'Runtime config and API requests must bypass HTTP cache');
assert.ok(sw.includes('LOCKED_RUNTIME_CONFIG'),'Offline runtime config must fail closed');
const runtimeBranch=sw.split('if(url.pathname===RUNTIME_CONFIG_PATH){',2)[1]?.split('if(!SHELL_PATHS.has(url.pathname))',1)[0]||'';
assert.ok(runtimeBranch,'Runtime config branch could not be isolated');
assert.equal(/caches\.(?:match|open)/.test(runtimeBranch),false,'Runtime config branch must not read or write Cache Storage');
assert.ok(sw.includes("key.startsWith(CACHE_PREFIX)&&key!==CACHE"),'Activation must only delete old ALPHA ERP caches');
assert.equal(sw.includes("keys.filter(key=>key!==CACHE)"),false,'Activation must not delete unrelated same-origin caches');
assert.ok(sw.includes('SHELL_PATHS.has(url.pathname)'),'Shell matching must use exact scoped pathnames');
assert.equal(sw.includes("url.pathname.endsWith(item.replace('./','/'))"),false,'Suffix matching can capture unrelated same-origin resources');
assert.ok(sw.includes('await cache.put(event.request,response.clone())'),'Refreshed shell assets must be durably cached before response completion');

// Execute the actual Service Worker source against deterministic mocks, not only string assertions.
const listeners={};
const deleted=[];
const opened=[];
let cacheMatchCalls=0;
let fetchImpl=async()=>{throw new Error('offline')};
let putCompleted=false;
const cacheNames=['other-website-cache',previousCache,currentCache];
const cacheObject={
  async addAll(){},
  async put(){await new Promise(resolve=>setTimeout(resolve,5));putCompleted=true;}
};
const cachesMock={
  async open(name){opened.push(name);return cacheObject;},
  async keys(){return [...cacheNames];},
  async delete(name){deleted.push(name);return true;},
  async match(){cacheMatchCalls+=1;return undefined;}
};
const selfMock={
  location:{origin:'https://alpha.test'},
  registration:{scope:'https://alpha.test/'},
  clients:{claim:async()=>true},
  skipWaiting:async()=>true,
  addEventListener(type,handler){listeners[type]=handler;}
};
const sandbox={self:selfMock,caches:cachesMock,fetch:(...args)=>fetchImpl(...args),URL,Response,Request,Error,Set,Promise,setTimeout,console};
vm.runInNewContext(sw,sandbox,{filename:'sw.js'});
assert.equal(typeof listeners.activate,'function');
assert.equal(typeof listeners.fetch,'function');

let activationPromise;
listeners.activate({waitUntil(promise){activationPromise=promise;}});
await activationPromise;
assert.deepEqual(deleted,[previousCache],'Activation deleted an unrelated cache or retained an obsolete ALPHA cache');

async function dispatchFetch(path,{mode='same-origin'}={}){
  let responsePromise;
  const request={method:'GET',url:`https://alpha.test${path}`,mode};
  listeners.fetch({request,respondWith(value){responsePromise=Promise.resolve(value);}});
  assert.ok(responsePromise,`Service Worker did not handle ${path}`);
  return responsePromise;
}

const matchesBeforeRuntime=cacheMatchCalls;
fetchImpl=async()=>{throw new Error('network offline')};
const locked=await dispatchFetch('/runtime-config.js');
const lockedText=await locked.text();
for(const token of ['environment:"production"','dataMode:"server-authoritative"','allowDemoLogin:false','allowLocalBusinessData:false','allowOfflineWritesInProduction:false','supabaseUrl:""'])assert.ok(lockedText.includes(token),`Fail-closed runtime config is missing ${token}`);
assert.equal(cacheMatchCalls,matchesBeforeRuntime,'Offline runtime config must not read Cache Storage');

fetchImpl=async()=>new Response('window.ALPHA_RUNTIME_CONFIG={environment:"demo",allowDemoLogin:true};',{status:200});
const online=await dispatchFetch('/runtime-config.js');
assert.ok((await online.text()).includes('environment:"demo"'),'Online runtime config must pass through the backend response');
assert.equal(cacheMatchCalls,matchesBeforeRuntime,'Online runtime config must not read Cache Storage');

putCompleted=false;
fetchImpl=async()=>new Response('application asset',{status:200});
const asset=await dispatchFetch('/app.js');
assert.equal(await asset.text(),'application asset');
assert.equal(putCompleted,true,'Shell response resolved before cache.put completed');
assert.ok(opened.includes(currentCache),'Current release cache was not opened');

console.log('PASS current-release fail-closed runtime config, executable cache isolation, exact shell matching and durable Service Worker writes');
