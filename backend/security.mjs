import {randomUUID,createHmac,createHash,timingSafeEqual} from 'node:crypto';
import {isIP} from 'node:net';

const trimBase=value=>String(value||'').replace(/\/+$/,'');
const finiteNumber=(value,fallback,min,max)=>{const parsed=Number(value);return Number.isFinite(parsed)?Math.min(max,Math.max(min,parsed)):fallback;};
const strictUuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const runtime={
  environment:String(process.env.ALPHA_ENV||process.env.NODE_ENV||'development').toLowerCase(),
  supabaseUrl:trimBase(process.env.SUPABASE_URL),
  supabaseAnonKey:String(process.env.SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_ANON_KEY||''),
  supabaseAdminKey:String(process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||''),
  supabaseAdminKeyType:String(process.env.SUPABASE_SECRET_KEY||'').startsWith('sb_secret_')?'secret':'legacy-service-role',
  validationEvidenceSecret:String(process.env.VALIDATION_EVIDENCE_SECRET||''),
  authoritative:String(process.env.DATA_MODE||'').toLowerCase()==='server-authoritative'||String(process.env.NODE_ENV||'').toLowerCase()==='production',
  allowedOrigins:String(process.env.CORS_ORIGINS||process.env.CORS_ORIGIN||'').split(',').map(x=>x.trim()).filter(Boolean),
  maxRequestsPerMinute:finiteNumber(process.env.RATE_LIMIT_PER_MINUTE,180,10,10000),
  supabaseTimeoutMs:finiteNumber(process.env.SUPABASE_TIMEOUT_MS,15000,1000,120000),
  sessionIdleTimeoutMs:finiteNumber(process.env.SESSION_IDLE_TIMEOUT_MS,30*60*1000,5*60*1000,2*60*60*1000),
  sessionAbsoluteTimeoutMs:finiteNumber(process.env.SESSION_ABSOLUTE_TIMEOUT_MS,8*60*60*1000,30*60*1000,24*60*60*1000),
  trustProxy:String(process.env.TRUST_PROXY||'false').toLowerCase()==='true',
  trustProxyHops:finiteNumber(process.env.TRUST_PROXY_HOPS,1,1,10)
};

export function requestId(req){
  const value=String(req.headers['x-request-id']||'').trim();
  return strictUuid.test(value)?value:randomUUID();
}
export function bearerToken(req){
  const auth=String(req.headers.authorization||'');
  const match=auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim()||'';
}
export function isConfigured(){
  if(!runtime.supabaseUrl||!runtime.supabaseAnonKey)return false;
  try{
    const url=new URL(runtime.supabaseUrl);
    if(runtime.authoritative||runtime.environment==='production')return url.protocol==='https:';
    return url.protocol==='https:'||url.protocol==='http:';
  }catch{return false;}
}

async function supabaseFetch(path,{token='',method='GET',body,headers={},apiKey=''}={}){
  if(!isConfigured())throw Object.assign(new Error('Máy chủ chưa được cấu hình Supabase.'),{status:503,code:'SUPABASE_NOT_CONFIGURED'});
  const selectedKey=apiKey||runtime.supabaseAnonKey;
  let response;
  try{
    response=await fetch(`${runtime.supabaseUrl}${path}`,{
      method,
      headers:{
        apikey:selectedKey,
        ...(token?{Authorization:`Bearer ${token}`}:(selectedKey&&!String(selectedKey).startsWith('sb_')?{Authorization:`Bearer ${selectedKey}`}:{ })),
        ...(body!==undefined?{'content-type':'application/json'}:{}),
        ...headers
      },
      body:body===undefined?undefined:JSON.stringify(body),
      signal:AbortSignal.timeout(runtime.supabaseTimeoutMs)
    });
  }catch(error){
    if(error?.name==='TimeoutError'||error?.name==='AbortError')throw Object.assign(new Error('Dịch vụ dữ liệu phản hồi quá thời gian.'),{status:504,code:'UPSTREAM_TIMEOUT'});
    throw Object.assign(new Error('Không thể kết nối dịch vụ dữ liệu.'),{status:502,code:'UPSTREAM_UNAVAILABLE',cause:error});
  }
  const text=await response.text();
  let payload=null;try{payload=text?JSON.parse(text):null;}catch{payload=text;}
  if(!response.ok){
    const error=Object.assign(new Error(payload?.message||payload?.error_description||payload?.hint||`Supabase HTTP ${response.status}`),{status:response.status===401?401:response.status===403?403:502,upstreamStatus:response.status,payload});
    throw error;
  }
  return payload;
}


function stableJson(value){
  if(Array.isArray(value))return `[${value.map(stableJson).join(',')}]`;
  if(value&&typeof value==='object')return `{${Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stableJson(value[k])).join(',')}}`;
  return JSON.stringify(value);
}
function evidenceMessage(body,timestamp){
  const summaryHash=createHash('sha256').update(stableJson(body?.summary||{})).digest('hex');
  return [timestamp,String(body?.companyId||''),String(body?.release||''),String(body?.gateCode||''),String(body?.status||''),summaryHash,String(body?.evidenceUri||''),String(body?.checksumSha256||''),String(body?.expiresAt||'')].join('|');
}
export function verifyValidationEvidenceRequest(req,body){
  if(!runtime.validationEvidenceSecret)throw Object.assign(new Error('Validation evidence secret is not configured.'),{status:503,code:'VALIDATION_SECRET_MISSING'});
  const timestamp=String(req.headers['x-validation-timestamp']||'');const signature=String(req.headers['x-validation-signature']||'').toLowerCase();
  if(!/^\d{10,13}$/.test(timestamp)||!/^[0-9a-f]{64}$/.test(signature))throw Object.assign(new Error('Invalid validation signature headers.'),{status:401,code:'INVALID_VALIDATION_SIGNATURE'});
  const millis=timestamp.length===10?Number(timestamp)*1000:Number(timestamp);if(Math.abs(Date.now()-millis)>5*60*1000)throw Object.assign(new Error('Validation signature expired.'),{status:401,code:'EXPIRED_VALIDATION_SIGNATURE'});
  const expected=createHmac('sha256',runtime.validationEvidenceSecret).update(evidenceMessage(body,timestamp)).digest('hex');
  const a=Buffer.from(signature,'hex'),b=Buffer.from(expected,'hex');if(a.length!==b.length||!timingSafeEqual(a,b))throw Object.assign(new Error('Validation signature mismatch.'),{status:401,code:'INVALID_VALIDATION_SIGNATURE'});
  return true;
}
export async function serviceRpc(name,args={}){
  if(!runtime.supabaseAdminKey)throw Object.assign(new Error('Supabase Secret key hoặc legacy Service Role key chưa được cấu hình trên backend.'),{status:503,code:'SUPABASE_ADMIN_KEY_MISSING'});
  return supabaseFetch(`/rest/v1/rpc/${encodeURIComponent(name)}`,{apiKey:runtime.supabaseAdminKey,method:'POST',body:args,headers:{Prefer:'return=representation'}});
}

export async function authenticate(req){
  const token=bearerToken(req);
  if(!token)throw Object.assign(new Error('Thiếu access token.'),{status:401,code:'AUTH_REQUIRED'});
  const user=await supabaseFetch('/auth/v1/user',{token});
  if(!user?.id)throw Object.assign(new Error('Phiên đăng nhập không hợp lệ.'),{status:401,code:'INVALID_SESSION'});
  const contextPayload=await supabaseFetch('/rest/v1/rpc/current_user_context',{token,method:'POST',body:{}});
  const context=Array.isArray(contextPayload)?contextPayload[0]:contextPayload;
  if(!context?.company_id)throw Object.assign(new Error('Tài khoản chưa được gán vào công ty.'),{status:403,code:'NO_COMPANY_MEMBERSHIP'});
  return {token,user,context};
}

export function hasPermission(context,required=[]){
  const permissions=Array.isArray(context?.permissions)?context.permissions:[];
  const needed=Array.isArray(required)?required:[required];
  return permissions.includes('*')||permissions.includes('admin')||needed.length===0||needed.some(p=>permissions.includes(p));
}
const AAL2_PRIVILEGED_PERMISSIONS=new Set([
  'accounting.post','accounting.close','accounting.period.lock','users.manage','roles.manage',
  'reports.import','backup.restore','security.manage','release.approve','b09.review','b09.approve','financial_reports.certify','admin'
]);
export function requiresAal2(context,required=[]){
  const needed=Array.isArray(required)?required:[required];
  const permissions=Array.isArray(context?.permissions)?context.permissions:[];
  const matchedPrivileged=permissions.includes('*')||permissions.includes('admin')||needed.some(permission=>AAL2_PRIVILEGED_PERMISSIONS.has(String(permission||''))&&permissions.includes(permission));
  // Missing mfa_required is treated as fail-closed. A company may explicitly
  // disable the policy by returning false from current_user_context.
  return Boolean(matchedPrivileged&&context?.mfa_required!==false&&context?.aal!=='aal2');
}
export function requirePermission(auth,required=[]){
  if(!hasPermission(auth?.context,required))throw Object.assign(new Error('Không đủ quyền thực hiện thao tác.'),{status:403,code:'PERMISSION_DENIED'});
  if(requiresAal2(auth?.context,required))throw Object.assign(new Error('Thao tác đặc quyền yêu cầu xác thực MFA cấp AAL2.'),{status:403,code:'MFA_AAL2_REQUIRED'});
}

export async function rpc(auth,name,args={}){
  return supabaseFetch(`/rest/v1/rpc/${encodeURIComponent(name)}`,{token:auth.token,method:'POST',body:args,headers:{Prefer:'return=representation'}});
}

export async function loadAuthoritativeDb(auth){
  const rows=[];let offset=0;
  for(;;){
    const query=new URLSearchParams({select:'collection,record_id,data,row_version,deleted_at',company_id:`eq.${auth.context.company_id}`,deleted_at:'is.null',order:'collection.asc,record_id.asc',limit:'1000',offset:String(offset)});
    const page=await supabaseFetch(`/rest/v1/entity_records?${query.toString()}`,{token:auth.token});
    rows.push(...(Array.isArray(page)?page:[]));
    if(!Array.isArray(page)||page.length<1000)break;
    offset+=1000;
    if(offset>100000)throw Object.assign(new Error('Dữ liệu vượt giới hạn an toàn.'),{status:413});
  }
  const db={};
  for(const row of rows){
    if(row.collection==='settings'&&row.record_id==='singleton')db.settings=row.data||{};
    else if(row.record_id==='singleton')db[row.collection]=row.data||{};
    else{
      if(!Array.isArray(db[row.collection]))db[row.collection]=[];
      const payload=row.data&&typeof row.data==='object'&&!Array.isArray(row.data)?row.data:{};
      // record_id is the authoritative storage identity. Normalizing it into
      // every business payload keeps legacy rows without an embedded id usable
      // and prevents a stale payload id from breaking cross-module references.
      db[row.collection].push({...payload,id:String(row.record_id)});
    }
  }
  db.meta={...(db.meta||{}),companyId:auth.context.company_id,source:'postgresql',loadedAt:new Date().toISOString(),recordCount:rows.length};
  return db;
}

export async function logSecurityEvent(auth,eventType,success,severity='info',details={}){
  if(!auth?.token)return;
  try{await rpc(auth,'log_security_event',{p_event_type:eventType,p_success:Boolean(success),p_severity:severity,p_details:details});}catch{}
}

const rateBuckets=new Map();
function normalizedIp(value){
  const raw=String(value||'').trim().replace(/^\[|\]$/g,'');
  const clean=raw.startsWith('::ffff:')&&isIP(raw.slice(7))===4?raw.slice(7):raw;
  return isIP(clean)?clean:'';
}
export function rateLimitAddress(req){
  const remote=normalizedIp(req.socket?.remoteAddress)||'unknown';
  if(!runtime.trustProxy)return remote;
  const forwarded=String(req.headers['x-forwarded-for']||'').split(',').map(normalizedIp).filter(Boolean);
  if(forwarded.length){
    const chain=[...forwarded,remote];
    const index=Math.max(0,chain.length-1-runtime.trustProxyHops);
    return chain[index]||remote;
  }
  return normalizedIp(req.headers['x-real-ip'])||remote;
}
export function enforceRateLimit(req,key='global'){
  const now=Date.now();const minute=Math.floor(now/60000);
  const address=rateLimitAddress(req);
  const bucketKey=`${minute}|${address}|${key}`;
  const count=(rateBuckets.get(bucketKey)||0)+1;rateBuckets.set(bucketKey,count);
  if(rateBuckets.size>10000){for(const k of rateBuckets.keys())if(!k.startsWith(`${minute}|`))rateBuckets.delete(k);}
  if(count>runtime.maxRequestsPerMinute)throw Object.assign(new Error('Quá nhiều yêu cầu. Vui lòng thử lại sau.'),{status:429,code:'RATE_LIMITED'});
}

export function corsHeaders(req){
  const origin=String(req.headers.origin||'');
  if(!origin)return {};
  if(runtime.allowedOrigins.includes(origin))return {'access-control-allow-origin':origin,'vary':'Origin'};
  if(runtime.environment==='development'&&/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin))return {'access-control-allow-origin':origin,'vary':'Origin'};
  throw Object.assign(new Error('Origin không được phép.'),{status:403,code:'CORS_DENIED'});
}

export function baseSecurityHeaders({requestIdValue='',html=false}={}){
  const production=runtime.environment==='production';
  const connectSources=["'self'"];
  if(isConfigured()){
    const endpoint=new URL(runtime.supabaseUrl);
    connectSources.push(endpoint.origin);
    connectSources.push(`${endpoint.protocol==='https:'?'wss:':'ws:'}//${endpoint.host}`);
  }
  const csp=[
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    `connect-src ${[...new Set(connectSources)].join(' ')}`,
    "font-src 'self' data:",
    "worker-src 'self'",
    "manifest-src 'self'",
    "media-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    ...(production?['upgrade-insecure-requests']:[])
  ].join('; ');
  return {
    'x-request-id':requestIdValue,
    'x-content-type-options':'nosniff',
    'x-dns-prefetch-control':'off',
    'x-permitted-cross-domain-policies':'none',
    'referrer-policy':'strict-origin-when-cross-origin',
    'permissions-policy':'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    'cross-origin-opener-policy':'same-origin',
    'cross-origin-resource-policy':'same-origin',
    'origin-agent-cluster':'?1',
    'x-frame-options':'DENY',
    ...(production?{'strict-transport-security':'max-age=31536000; includeSubDomains'}:{}),
    ...(html?{'content-security-policy':csp}:{})
  };
}
