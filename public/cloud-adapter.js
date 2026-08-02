(() => {
  'use strict';
  const KEY='alpha_design_erp_supabase_session_v3';
  const store=()=>String(window.ALPHA_RUNTIME_CONFIG?.sessionPersistence||'session')==='local'?localStorage:sessionStorage;
  const read=()=>{try{return JSON.parse(store().getItem(KEY)||'null')}catch{return null}};
  const write=v=>{try{if(v)store().setItem(KEY,JSON.stringify(v));else{sessionStorage.removeItem(KEY);localStorage.removeItem(KEY)}}catch{}};
  const base=u=>String(u||'').replace(/\/$/,'');
  const headers=(cfg,token,json=true)=>({
    ...(json?{'Content-Type':'application/json'}:{}),
    apikey:cfg.anonKey||'',
    Authorization:`Bearer ${token||read()?.access_token||cfg.anonKey||''}`
  });
  async function request(cfg,path,options={}){
    if(!cfg?.endpoint||!cfg?.anonKey)throw new Error('Thiếu Supabase URL hoặc anon key');
    const res=await fetch(base(cfg.endpoint)+path,{...options,headers:{...headers(cfg,options.token,options.json!==false),...(options.headers||{})}});
    const text=await res.text();let body=null;try{body=text?JSON.parse(text):null}catch{body=text}
    if(!res.ok)throw new Error(body?.message||body?.error_description||body?.hint||`HTTP ${res.status}`);
    return body;
  }
  async function signIn(cfg,email,password){
    const session=await request(cfg,'/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email,password})});
    write(session);return session;
  }
  async function signOut(cfg){
    const s=read();if(s?.access_token)await request(cfg,'/auth/v1/logout',{method:'POST',token:s.access_token,body:'{}'}).catch(()=>{});write(null);
  }
  async function refresh(cfg){
    const s=read();if(!s?.refresh_token)return null;
    const next=await request(cfg,'/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:s.refresh_token})});write(next);return next;
  }
  async function rpc(cfg,name,args={}){
    return request(cfg,`/rest/v1/rpc/${encodeURIComponent(name)}`,{method:'POST',body:JSON.stringify(args),headers:{Prefer:'return=representation'}});
  }
  async function select(cfg,table,query='select=*'){
    return request(cfg,`/rest/v1/${encodeURIComponent(table)}?${query}`,{method:'GET'});
  }
  async function health(cfg){
    const started=performance.now();
    const data=await select(cfg,'companies','select=id,code,name,accounting_regime&limit=1');
    return {ok:true,latencyMs:Math.round(performance.now()-started),company:data?.[0]||null};
  }
  async function acquireLock(cfg,companyId,entityType,entityId,ttl=300){
    return rpc(cfg,'acquire_edit_lock',{p_company:companyId,p_entity:entityType,p_id:entityId,p_ttl_seconds:ttl});
  }
  async function releaseLock(cfg,companyId,entityType,entityId){
    return rpc(cfg,'release_edit_lock',{p_company:companyId,p_entity:entityType,p_id:entityId});
  }
  async function postJournal(cfg,entryId,expectedVersion){
    return rpc(cfg,'post_journal_entry',{p_entry:entryId,p_expected_version:expectedVersion});
  }
  async function reverseJournal(cfg,entryId,reversalDate,documentNo,reason){
    return rpc(cfg,'reverse_journal_entry',{p_entry:entryId,p_reversal_date:reversalDate,p_document_no:documentNo,p_reason:reason});
  }
  async function verifyAudit(cfg,companyId){return rpc(cfg,'verify_audit_chain',{p_company:companyId})}
  async function validateTT133(cfg,from,to){return rpc(cfg,'validate_tt133_report_set',{p_from:from,p_to:to})}
  async function report(cfg,code,from,to){
    const map={B01:'report_b01a_dnn',B02:'report_b02_dnn',B03:'report_b03_dnn',B09:'report_b09_dnn',F01:'report_f01_dnn'};
    if(!map[code])throw new Error('Mã báo cáo không hỗ trợ');
    return rpc(cfg,map[code],{p_from:from,p_to:to});
  }
  window.AlphaCloud={readSession:read,getAccessToken:()=>read()?.access_token||'',signIn,signOut,refresh,rpc,select,health,acquireLock,releaseLock,postJournal,reverseJournal,verifyAudit,validateTT133,report};
})();
