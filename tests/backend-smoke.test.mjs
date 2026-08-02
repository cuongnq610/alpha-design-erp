import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
const VERSION=JSON.parse(fs.readFileSync(new URL('../VERSION.json',import.meta.url),'utf8')).version;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function start(port,env={}){
  const child=spawn(process.execPath,['backend/server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:String(port),HOST:'127.0.0.1',...env},stdio:['ignore','pipe','pipe']});
  let response;for(let i=0;i<40;i++){try{response=await fetch(`http://127.0.0.1:${port}/api/health`);if(response.ok)break;}catch{}await sleep(100);}assert(response?.ok,'Backend did not start');return {child,response};
}
let demo,prod;
try{
  demo=await start(18978,{NODE_ENV:'development',ALLOW_CLIENT_DB:'true'});
  const health=await demo.response.json();assert.equal(health.version,VERSION);assert.equal(health.dataMode,'demo-compatible');
  const demoRuntime=await (await fetch('http://127.0.0.1:18978/runtime-config.js')).text();assert(demoRuntime.includes('\"environment\": \"demo\"'));assert(!demoRuntime.includes('service_role'));
  const options=await fetch('http://127.0.0.1:18978/api/portfolio-control',{method:'OPTIONS',headers:{origin:'http://127.0.0.1:8787','access-control-request-method':'POST','access-control-request-headers':'authorization,content-type'}});assert.equal(options.status,204);assert(options.headers.get('access-control-allow-headers')?.includes('authorization'));
  const page=await fetch('http://127.0.0.1:18978/');assert.equal(page.status,200);assert((await page.text()).includes(`ERP CLOUD v${VERSION}`));assert.equal(page.headers.get('x-frame-options'),'DENY');assert(page.headers.get('content-security-policy')?.includes("script-src 'self'"));assert.equal(page.headers.get('cross-origin-resource-policy'),'same-origin');assert.equal(page.headers.get('x-dns-prefetch-control'),'off');
  const validation=await fetch('http://127.0.0.1:18978/api/project-financials',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({db:{projects:[]},projectId:'missing'})});assert.equal(validation.status,422);assert.equal((await validation.json()).source,'client-demo');
  const portfolio=await fetch('http://127.0.0.1:18978/api/portfolio-control',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({db:{projects:[]}})});assert.equal(portfolio.status,200);assert.equal((await portfolio.json()).result.rows.length,0);
  const aging=await fetch('http://127.0.0.1:18978/api/invoice-aging',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({db:{taxInvoices:[{id:'i1',direction:'Output',date:'2026-01-01',dueDate:'2026-01-31',status:'Valid',totalAmount:110,taxBase:100}],paymentAllocations:[]},options:{direction:'Output',asOf:'2026-02-10'}})});assert.equal(aging.status,200);assert.equal((await aging.json()).result.totals.outstanding,110);
  prod=await start(18979,{NODE_ENV:'production',ALPHA_ENV:'production',DATA_MODE:'server-authoritative',SUPABASE_URL:'https://project-ref.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',SUPABASE_SECRET_KEY:'sb_secret_test_server_only'});
  const prodRuntime=await (await fetch('http://127.0.0.1:18979/runtime-config.js')).text();assert(prodRuntime.includes('\"environment\": \"production\"'));assert(prodRuntime.includes('server-authoritative'));assert(prodRuntime.includes('project-ref.supabase.co'));assert(prodRuntime.includes('sb_publishable_test'));assert(!prodRuntime.includes('sb_secret_'));assert(!prodRuntime.includes('SUPABASE_SERVICE_ROLE_KEY'));
  const protectedCall=await fetch('http://127.0.0.1:18979/api/portfolio-control',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});assert.equal(protectedCall.status,401);const body=await protectedCall.json();assert.equal(body.code,'AUTH_REQUIRED');
  const prodPage=await fetch('http://127.0.0.1:18979/');const prodCsp=prodPage.headers.get('content-security-policy')||'';assert(prodCsp.includes('https://project-ref.supabase.co'));assert(prodCsp.includes('wss://project-ref.supabase.co'));assert.equal(prodCsp.includes('*.supabase.co'),false);assert(prodCsp.includes('upgrade-insecure-requests'));assert.equal(prodPage.headers.get('strict-transport-security'),'max-age=31536000; includeSubDomains');
  console.log(`PASS backend v${VERSION} exact-origin CSP, security headers, static hosting, demo compatibility and production auth gate`);
}finally{demo?.child.kill('SIGTERM');prod?.child.kill('SIGTERM');}
