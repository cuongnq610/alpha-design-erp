// ALPHA DESIGN ERP v4.5.67 DEEP QA AUTOHEAL RELEASE cache
const CACHE_PREFIX='alpha-design-erp-';
const CACHE=`${CACHE_PREFIX}v4-5-67-deep-qa-autoheal`;
const SHELL=['./','./index.html','./theme-bootstrap.js','./alpha-design-system.css','./calculation-core.js','./reporting-period.js','./statutory-template-manager.js','./statutory-template-reference.js','./tax-compliance-package-manager.js','./tax-compliance-reference.js','./tax-calendar.js','./accounting-operations.js','./payroll-detail.js','./annual-benefits.js','./recycle-bin.js','./export-center.js','./theme-manager.js','./demo-enterprise-seed.js','./app.js','./cloud-adapter.js','./alpha-sync.bundle.js','./auth-security.js','./permission-map.js','./cloud-v2.js','./production-guard.js','./alpha-enterprise.js','./manifest.webmanifest','./logo-alpha-transparent.png','./logo-alpha-on-dark.png','./icon-192.png','./icon-512.png','./templates/statutory/TT133_2026_BASELINE_TEMPLATE.json','./templates/statutory/TT99_2026_BASELINE_TEMPLATE.json','./templates/statutory/TT132_2026_BASELINE_TEMPLATE.json','./templates/tax/VN_TAX_2026_BASELINE_PACKAGE.json'];
const SHELL_PATHS=new Set(SHELL.map(item=>new URL(item,self.registration.scope).pathname));
const RUNTIME_CONFIG_PATH=new URL('./runtime-config.js',self.registration.scope).pathname;
const LOCKED_RUNTIME_CONFIG='window.ALPHA_RUNTIME_CONFIG={environment:"production",dataMode:"server-authoritative",apiAuthRequired:true,allowDemoLogin:false,allowLocalBusinessData:false,allowOfflineWritesInProduction:false,sessionPersistence:"session",sessionIdleTimeoutMs:1800000,sessionAbsoluteTimeoutMs:28800000,requireMfaForPrivilegedRoles:true,supabaseUrl:"",supabaseAnonKey:""};';

self.addEventListener('install',event=>event.waitUntil(
  caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())
));

self.addEventListener('activate',event=>event.waitUntil(
  caches.keys()
    .then(keys=>Promise.all(keys.filter(key=>key.startsWith(CACHE_PREFIX)&&key!==CACHE).map(key=>caches.delete(key))))
    .then(()=>self.clients.claim())
));

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;

  if(url.pathname.startsWith('/api/')){
    event.respondWith(fetch(event.request,{cache:'no-store'}));
    return;
  }

  // Runtime configuration is environment-sensitive and must never be persisted.
  // On network failure, return a locked configuration rather than a cached Demo/Staging value.
  if(url.pathname===RUNTIME_CONFIG_PATH){
    event.respondWith(
      fetch(event.request,{cache:'no-store'}).then(response=>{
        if(!response.ok)throw new Error(`Runtime config HTTP ${response.status}`);
        return response;
      }).catch(()=>new Response(LOCKED_RUNTIME_CONFIG,{
        headers:{'content-type':'text/javascript; charset=utf-8','cache-control':'no-store'}
      }))
    );
    return;
  }

  if(!SHELL_PATHS.has(url.pathname))return;
  event.respondWith((async()=>{
    try{
      const response=await fetch(event.request,{cache:'no-cache'});
      if(response.ok){
        const cache=await caches.open(CACHE);
        await cache.put(event.request,response.clone());
      }
      return response;
    }catch{
      const hit=await caches.match(event.request,{ignoreSearch:true});
      if(hit)return hit;
      if(event.request.mode==='navigate')return caches.match(new URL('./index.html',self.registration.scope).href);
      return Response.error();
    }
  })());
});

self.addEventListener('message',event=>{if(event.data==='SKIP_WAITING')self.skipWaiting();});
