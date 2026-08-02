import {existsSync,readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const errors=[];const warnings=[];
const strict=process.argv.includes('--strict')||process.env.PREFLIGHT_STRICT==='1'||process.env.NODE_ENV==='production'||process.env.ALPHA_ENV==='production';
const missing=(message)=>strict?errors.push(message):warnings.push(message);
const major=Number(process.versions.node.split('.')[0]);
if(major<20)errors.push(`Node.js ${process.versions.node} không đạt yêu cầu >=20`);
for(const file of ['package.json','package-lock.json','passenger.cjs','backend/server.mjs','backend/security.mjs','SUPABASE_PRODUCTION_SCHEMA.sql','public/index.html']){
  if(!existsSync(join(root,file)))errors.push(`Thiếu ${file}`);
}
const env={...process.env};
const required=['SUPABASE_URL','CORS_ORIGINS','VALIDATION_EVIDENCE_SECRET'];
for(const key of required)if(!String(env[key]||'').trim())missing(`Chưa đặt ${key}`);
const publishable=String(env.SUPABASE_PUBLISHABLE_KEY||env.SUPABASE_ANON_KEY||'').trim();
const adminKey=String(env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY||'').trim();
if(!publishable)missing('Chưa đặt SUPABASE_PUBLISHABLE_KEY hoặc SUPABASE_ANON_KEY');
if(!adminKey)missing('Chưa đặt SUPABASE_SECRET_KEY hoặc legacy SUPABASE_SERVICE_ROLE_KEY');
if(env.SUPABASE_URL&&!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(env.SUPABASE_URL))errors.push('SUPABASE_URL không đúng dạng HTTPS của Supabase');
if(env.CORS_ORIGINS){
  const origins=env.CORS_ORIGINS.split(',').map(x=>x.trim()).filter(Boolean);
  for(const origin of origins){
    if(!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(origin))errors.push(`CORS origin không hợp lệ: ${origin}`);
    if(origin.includes('*'))errors.push(`Không được dùng wildcard trong CORS: ${origin}`);
  }
}
if(publishable&&adminKey&&publishable===adminKey)errors.push('Publishable key và Secret/Service Role key không được giống nhau');
if(env.SUPABASE_SECRET_KEY&&!String(env.SUPABASE_SECRET_KEY).startsWith('sb_secret_'))warnings.push('SUPABASE_SECRET_KEY không có tiền tố sb_secret_; hãy kiểm tra lại loại khóa');
if(env.VALIDATION_EVIDENCE_SECRET&&env.VALIDATION_EVIDENCE_SECRET.length<32)errors.push('VALIDATION_EVIDENCE_SECRET phải dài tối thiểu 32 ký tự');
const publicRuntime=readFileSync(join(root,'public/runtime-config.js'),'utf8');
for(const token of ['SERVICE_ROLE','VALIDATION_EVIDENCE_SECRET','DATABASE_URL'])if(publicRuntime.includes(token))errors.push(`public/runtime-config.js chứa tên secret: ${token}`);
try{execFileSync(process.execPath,[join(root,'libraries/check-libraries.mjs')],{cwd:root,stdio:'pipe'});}catch(error){errors.push(`Kiểm tra thư viện thất bại: ${error.stderr?.toString()||error.message}`);}
const result={ok:errors.length===0,strict,node:process.versions.node,root,errors,warnings};
console.log(JSON.stringify(result,null,2));
if(errors.length)process.exit(1);
