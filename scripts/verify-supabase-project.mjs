import fs from 'node:fs';
const release=JSON.parse(fs.readFileSync(new URL('../VERSION.json',import.meta.url),'utf8'));
const expectedVersion=release.version;
const expectedMigration=release.databaseMigration;
const url=String(process.env.SUPABASE_URL||'').replace(/\/+$/,'');
const publishable=String(process.env.SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_ANON_KEY||'');
const secret=String(process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||'');
if(!url||!publishable||!secret)throw new Error('Cần SUPABASE_URL, Publishable/Anon key và Secret/Service Role key trong môi trường server');
const errors=[];const warnings=[];const checks=[];
async function call(path,key=secret){
  const headers={apikey:key,...(!String(key).startsWith('sb_')?{Authorization:`Bearer ${key}`}:{})};
  const r=await fetch(`${url}${path}`,{headers,signal:AbortSignal.timeout(20000)});
  const text=await r.text();let data=text;try{data=text?JSON.parse(text):null;}catch{}
  return {status:r.status,data,headers:Object.fromEntries(r.headers.entries())};
}
const schema=await call('/rest/v1/schema_versions?select=version,applied_at&order=applied_at.desc&limit=10');
checks.push({name:'schema_versions',status:schema.status,data:schema.data});
if(schema.status!==200)errors.push('Không đọc được schema_versions');
else if(!Array.isArray(schema.data)||!schema.data.some(x=>x.version===expectedVersion))errors.push(`Chưa thấy schema version ${expectedVersion} (migration ${String(expectedMigration).padStart(3,'0')})`);

const openapi=await call('/rest/v1/');
checks.push({name:'postgrest_openapi',status:openapi.status});
if(openapi.status!==200)errors.push('PostgREST không hoạt động');
else{
  const paths=openapi.data?.paths||{};
  for(const rpc of ['/rpc/current_user_context','/rpc/provision_company','/rpc/apply_entity_change','/rpc/update_role_module_permissions'])if(!paths[rpc])errors.push(`Thiếu RPC ${rpc}`);
}

const buckets=await call('/storage/v1/bucket');
checks.push({name:'storage_buckets',status:buckets.status,data:Array.isArray(buckets.data)?buckets.data.map(x=>({id:x.id,public:x.public})):buckets.data});
if(buckets.status!==200)errors.push('Không đọc được Storage buckets');
else{
  const bucket=Array.isArray(buckets.data)?buckets.data.find(x=>x.id==='company-files'):null;
  if(!bucket)errors.push('Thiếu bucket company-files');
  else if(bucket.public)errors.push('Bucket company-files phải là private');
}

const auth=await call('/auth/v1/settings',publishable);
checks.push({name:'auth_settings',status:auth.status,data:auth.data});
if(auth.status!==200)errors.push('Không đọc được Auth settings');
else if(auth.data?.disable_signup!==true)warnings.push('Auth signup chưa bị tắt; hệ thống nội bộ nên chỉ cho mời người dùng');

if(process.env.ALPHA_COMPANY_ID){
  const cid=encodeURIComponent(process.env.ALPHA_COMPANY_ID);
  const company=await call(`/rest/v1/companies?id=eq.${cid}&select=id,code,name,production_mode,require_mfa_for_privileged`);
  checks.push({name:'company',status:company.status,data:company.data});
  if(company.status!==200||!Array.isArray(company.data)||company.data.length!==1)errors.push('Không tìm thấy ALPHA_COMPANY_ID');
  else if(company.data[0].require_mfa_for_privileged!==true)warnings.push('Công ty chưa bật require_mfa_for_privileged');
}
const result={ok:errors.length===0,supabaseUrl:url,checkedAt:new Date().toISOString(),checks,errors,warnings,manualChecks:['RLS policies','Realtime publication','SMTP','Redirect URLs','MFA AAL2','Backup/restore drill']};
console.log(JSON.stringify(result,null,2));
if(errors.length)process.exit(1);
