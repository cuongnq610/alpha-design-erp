(() => {
  'use strict';
  const cfg=window.ALPHA_RUNTIME_CONFIG||{};
  const env=String(cfg.environment||'demo').toLowerCase();
  const production=env==='production';
  const staging=env==='staging';
  let syncStatus={status:production||staging?'offline':'demo',message:production||staging?'Đang chờ kết nối PostgreSQL':'Chế độ trình diễn'};
  let context=null;
  let fatal='';

  function configured(){return Boolean(cfg.supabaseUrl&&cfg.supabaseAnonKey&&String(cfg.dataMode||'')==='server-authoritative');}
  function privileged(ctx=context){const p=Array.isArray(ctx?.permissions)?ctx.permissions:[];return p.includes('*')||p.includes('admin')||p.some(x=>['accounting.post','accounting.close','accounting.period.lock','users.manage','roles.manage','reports.import','backup.restore','security.manage','release.approve'].includes(x));}
  function mfaLocked(){return Boolean((production||staging)&&cfg.requireMfaForPrivilegedRoles!==false&&context?.mfa_required!==false&&privileged()&&context?.aal!=='aal2');}
  function operationalLocked(){const mode=String(context?.operational_mode||'pilot');return mode==='maintenance'||mode==='suspended'||(mode==='production'&&context?.production_writes_enabled!==true);}
  function canWrite(){
    if(env==='demo')return true;
    if(fatal||!configured()||!context||operationalLocked())return false;
    if(cfg.allowOfflineWritesInProduction===true)return !mfaLocked();
    return navigator.onLine!==false&&syncStatus.status==='online'&&!mfaLocked();
  }
  function reason(){
    if(fatal)return fatal;
    if(!configured())return 'Thiếu cấu hình Supabase hoặc dataMode không phải server-authoritative.';
    if(!context)return 'Cần đăng nhập bằng Supabase Auth và được gán vào công ty.';
    if(operationalLocked()){const mode=String(context?.operational_mode||'pilot');return mode==='maintenance'?'Hệ thống đang bảo trì; mọi thay đổi bị khóa.':mode==='suspended'?'Hệ thống đang tạm dừng; mọi thay đổi bị khóa.':'Production chưa được mở quyền ghi sau kiểm định go-live.';}
    if(mfaLocked())return 'Vai trò đặc quyền phải xác thực MFA cấp AAL2 trước khi ghi dữ liệu.';
    if(navigator.onLine===false||syncStatus.status!=='online')return 'Mất kết nối máy chủ; hệ thống đang ở chế độ chỉ đọc và không ghi dữ liệu mới.';
    return '';
  }
  function render(){
    let banner=document.getElementById('productionGuardBanner');
    if(!banner){banner=document.createElement('div');banner.id='productionGuardBanner';banner.className='production-guard-banner';document.body.appendChild(banner);}
    const blocked=!canWrite();
    banner.className=`production-guard-banner ${blocked?'blocked':'ready'} ${env}`;
    const title=document.createElement('strong');title.textContent=env.toUpperCase();
    const message=document.createElement('span');message.textContent=blocked?reason():(env==='demo'?'Dữ liệu mô phỏng; không dùng thông tin thật.':'PostgreSQL là nguồn dữ liệu duy nhất • phiên đã xác thực');
    banner.replaceChildren(title,message);
    document.body.classList.toggle('production-readonly',blocked&&env!=='demo');
    document.querySelectorAll('#primaryAction,#mobileQuickAdd,[data-write-action]').forEach(el=>{el.disabled=blocked&&env!=='demo';el.setAttribute('aria-disabled',String(blocked&&env!=='demo'));});
  }
  async function apiToken(){
    const direct=window.AlphaCloud?.getAccessToken?.();if(direct)return direct;
    try{const result=await window.AlphaOnline?.getClient?.()?.auth?.getSession?.();return result?.data?.session?.access_token||'';}catch{return '';}
  }
  async function refreshContext(){
    if(env==='demo'){context={role_name:'Demo',permissions:['*'],aal:'aal1',mfa_required:false};render();return context;}
    if(!configured()){fatal='Cấu hình production chưa hoàn chỉnh.';render();return null;}
    const token=await apiToken();if(!token){context=null;render();return null;}
    try{
      const response=await fetch(`${String(cfg.apiBaseUrl||'').replace(/\/$/,'')}/api/session`,{headers:{Authorization:`Bearer ${token}`,'x-request-id':(globalThis.crypto?.randomUUID?.()||'00000000-0000-4000-8000-'+Date.now().toString(16).padStart(12,'0').slice(-12))}});
      const body=await response.json();if(!response.ok)throw new Error(body.error||'Không xác minh được phiên');context=body.context;fatal='';render();return context;
    }catch(error){
      const message=String(error?.message||error||'');
      const networkFailure=navigator.onLine===false||error instanceof TypeError||/failed to fetch|networkerror|network request failed|offline|mất kết nối/i.test(message);
      if(networkFailure){syncStatus={...syncStatus,status:'offline',message:'Mất kết nối máy chủ'};fatal='';render();return context;}
      context=null;fatal=message||'Không xác minh được phiên';render();return null;
    }
  }
  function clearLegacyBusinessCache(){
    if(!(production||staging)||cfg.allowLocalBusinessData===true)return;
    try{
      for(const key of Object.keys(localStorage)){if(/^alpha_design_erp_cloud_v3(_|$)|^alpha_design_erp_cloud_v3_5_algorithm_first/.test(key)&&!key.includes('meta'))localStorage.removeItem(key);}
    }catch{fatal='Trình duyệt chặn bộ nhớ cục bộ; hệ thống chuyển sang chỉ đọc để bảo vệ dữ liệu.';}
  }
  window.addEventListener('alpha:sync-status',event=>{syncStatus=event.detail||syncStatus;if(syncStatus.context)context=syncStatus.context;render();if(syncStatus.status==='online'&&!context)refreshContext();});
  window.addEventListener('alpha:auth-changed',()=>refreshContext());
  document.addEventListener('submit',event=>{const authForms=new Set(['loginForm','filterForm','mfaVerificationForm','passwordRecoveryRequestForm','passwordUpdateForm']);if(env!=='demo'&&!canWrite()&&!authForms.has(event.target?.id)){event.preventDefault();event.stopImmediatePropagation();alert(reason());}},true);
  document.addEventListener('click',event=>{const target=event.target.closest('[data-edit],[data-delete],[data-write-action],.edit-row,.delete-row,.journal-post,.approval-action,.delete-file,#lockCurrentPeriod,#unlockCurrentPeriod,#resetDemo');if(target&&env!=='demo'&&!canWrite()){event.preventDefault();event.stopImmediatePropagation();alert(reason());}},true);
  clearLegacyBusinessCache();
  window.AlphaProductionGuard={canWrite,reason,refreshContext,getContext:()=>context,getStatus:()=>({...syncStatus}),operationalLocked,environment:env};
  setTimeout(()=>{refreshContext();render();},0);
})();
