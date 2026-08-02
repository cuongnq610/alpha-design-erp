import fs from 'node:fs';
const base=String(process.env.APP_URL||'').replace(/\/+$/,'');
if(!/^https:\/\//i.test(base))throw new Error('Đặt APP_URL bằng URL HTTPS thật, ví dụ https://staging-erp.alphadesign.vn');
const release=JSON.parse(fs.readFileSync(new URL('../VERSION.json',import.meta.url),'utf8'));
const expectedVersion=process.env.EXPECTED_VERSION||release.version;
const errors=[];const checks=[];
async function request(path,options={}){
  const response=await fetch(`${base}${path}`,{redirect:'manual',signal:AbortSignal.timeout(20000),...options});
  const text=await response.text();
  return {response,text};
}
const health=await request('/api/health');
let healthJson={};try{healthJson=JSON.parse(health.text);}catch{}
checks.push({name:'health',status:health.response.status,payload:healthJson});
if(health.response.status!==200||healthJson.ok!==true)errors.push('/api/health không đạt');
if(healthJson.version!==expectedVersion)errors.push(`Sai version: ${healthJson.version||'unknown'}`);
if(healthJson.dataMode!=='server-authoritative')errors.push('DATA_MODE chưa phải server-authoritative');
if(healthJson.supabaseConfigured!==true)errors.push('Backend chưa nhận cấu hình Supabase');

const runtime=await request('/runtime-config.js');
checks.push({name:'runtime-config',status:runtime.response.status,length:runtime.text.length});
if(runtime.response.status!==200)errors.push('Không đọc được runtime-config.js');
for(const forbidden of ['SUPABASE_SERVICE_ROLE_KEY','VALIDATION_EVIDENCE_SECRET','DATABASE_URL','sb_secret_'])if(runtime.text.includes(forbidden))errors.push(`Runtime làm lộ secret marker: ${forbidden}`);
if(!runtime.text.includes('server-authoritative'))errors.push('runtime-config chưa bật server-authoritative');

const index=await request('/');
checks.push({name:'index',status:index.response.status});
if(index.response.status!==200)errors.push('Trang chủ không trả 200');
const headers=index.response.headers;
if(!headers.get('strict-transport-security'))errors.push('Thiếu HSTS');
if(!headers.get('content-security-policy'))errors.push('Thiếu Content-Security-Policy');
if(headers.get('x-content-type-options')!=='nosniff')errors.push('Thiếu X-Content-Type-Options');

const cors=await request('/api/health',{method:'OPTIONS',headers:{Origin:base,'Access-Control-Request-Method':'GET'}});
checks.push({name:'cors',status:cors.response.status,allowOrigin:cors.response.headers.get('access-control-allow-origin')});
if(cors.response.status!==204)errors.push('CORS preflight không trả 204');
if(cors.response.headers.get('access-control-allow-origin')!==base)errors.push('CORS không trả đúng origin');

const result={ok:errors.length===0,appUrl:base,checkedAt:new Date().toISOString(),checks,errors};
console.log(JSON.stringify(result,null,2));
if(errors.length)process.exit(1);
