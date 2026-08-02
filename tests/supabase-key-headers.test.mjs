import assert from 'node:assert/strict';

const originalEnv={...process.env};
const originalFetch=globalThis.fetch;
const calls=[];
globalThis.fetch=async(url,options={})=>{
  calls.push({url:String(url),headers:new Headers(options.headers||{}),method:options.method});
  return new Response(JSON.stringify({ok:true}),{status:200,headers:{'content-type':'application/json'}});
};
try{
  Object.assign(process.env,{
    SUPABASE_URL:'https://project-ref.supabase.co',
    SUPABASE_PUBLISHABLE_KEY:'sb_publishable_public_test_key_long_enough_1234567890',
    SUPABASE_SECRET_KEY:'sb_secret_server_test_key_long_enough_1234567890',
    SUPABASE_SERVICE_ROLE_KEY:''
  });
  const modern=await import(`../backend/security.mjs?modern=${Date.now()}`);
  await modern.serviceRpc('health_check',{});
  const modernCall=calls.pop();
  assert.equal(modernCall.headers.get('apikey'),'sb_secret_server_test_key_long_enough_1234567890');
  assert.equal(modernCall.headers.get('authorization'),null,'sb_secret_ key must not be used as a JWT bearer token');

  process.env.SUPABASE_SECRET_KEY='';
  process.env.SUPABASE_SERVICE_ROLE_KEY='legacy.service.role.jwt';
  const legacy=await import(`../backend/security.mjs?legacy=${Date.now()}`);
  await legacy.serviceRpc('health_check',{});
  const legacyCall=calls.pop();
  assert.equal(legacyCall.headers.get('apikey'),'legacy.service.role.jwt');
  assert.equal(legacyCall.headers.get('authorization'),'Bearer legacy.service.role.jwt');

  console.log('PASS v4.5.4 Supabase new Secret key and legacy Service Role header behavior');
}finally{
  globalThis.fetch=originalFetch;
  for(const key of Object.keys(process.env))if(!(key in originalEnv))delete process.env[key];
  Object.assign(process.env,originalEnv);
}
