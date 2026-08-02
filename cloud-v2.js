(() => {
  'use strict';

  const META_KEY = 'alpha_design_erp_cloud_v3_meta';
  const SESSION_KEY = 'alpha_design_erp_cloud_v36_session';
  const SYNC_SESSION_KEY = 'alpha_design_erp_online_sync_v3_1';
  const RUNTIME=window.ALPHA_RUNTIME_CONFIG||{};
  const ENVIRONMENT=String(RUNTIME.environment||'demo').toLowerCase();
  const sessionStore=()=>String(RUNTIME.sessionPersistence||'session')==='local'?localStorage:sessionStorage;
  const CORE_KEY = 'alpha_design_erp_cloud_v3_tt133';
  const SESSION_IDLE_TIMEOUT_MS=Math.max(5*60*1000,Number(RUNTIME.sessionIdleTimeoutMs||30*60*1000));
  const SESSION_ABSOLUTE_TIMEOUT_MS=Math.max(30*60*1000,Number(RUNTIME.sessionAbsoluteTimeoutMs||8*60*60*1000));
  const nowISO = () => new Date().toISOString();
  const esc = (v='') => String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const fmtDateTime = v => { const d=new Date(v); return Number.isNaN(d.getTime())?'—':new Intl.DateTimeFormat('vi-VN',{dateStyle:'short',timeStyle:'short'}).format(d); };
  const uid = p => { const id=globalThis.crypto?.randomUUID?.(); return id?`${p}-${id}`:`${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`; };
  const readJSON = (k,fallback,store=localStorage) => { try { const v=store.getItem(k); return v?JSON.parse(v):fallback; } catch { return fallback; } };
  const saveJSON = (k,v,store=localStorage) => {try{store.setItem(k,JSON.stringify(v));}catch{}};

  const MODULE_ACCESS = Object.freeze([
    {key:'dashboard',label:'Tổng quan',permissions:['dashboard.read']},
    {key:'tasks',label:'Công việc',permissions:['projects.read','projects.write']},
    {key:'projects',label:'Dự án',permissions:['projects.read','projects.write']},
    {key:'controls',label:'Kiểm soát vận hành',permissions:['projects.read','projects.control']},
    {key:'commercial',label:'Hợp đồng & Công nợ',permissions:['crm.read','crm.write','accounting.read']},
    {key:'planning',label:'Ngân sách & Nguồn lực',permissions:['projects.read','projects.control']},
    {key:'procurement',label:'Mua sắm & Tài sản',permissions:['procurement.read','procurement.write']},
    {key:'crm',label:'Khách hàng & Doanh thu',permissions:['crm.read','crm.write']},
    {key:'approvals',label:'Hợp đồng & Phê duyệt',permissions:['procurement.read','procurement.approve','crm.read']},
    {key:'people',label:'Nhân sự',permissions:['hr.read','hr.write']},
    {key:'timesheets',label:'Chấm công',permissions:['timesheet.read','timesheet.write','timesheet.approve']},
    {key:'payroll',label:'Lương & Chi phí',permissions:['payroll.read','payroll.write','payroll.approve']},
    {key:'documents',label:'Hồ sơ & Lưu trữ',permissions:['documents.read','documents.write']},
    {key:'finance',label:'Dòng tiền',permissions:['accounting.read','accounting.write']},
    {key:'financialAnalytics',label:'Phân tích tài chính',permissions:['financial_analytics.read','financial_analytics.write']},
    {key:'accounting',label:'Kế toán',permissions:['accounting.read','accounting.write','accounting.post']},
    {key:'tax',label:'Thuế',permissions:['tax.read','tax.write']},
    {key:'reports',label:'Báo cáo & Xuất nhập',permissions:['reports.read','reports.export']},
    {key:'settings',label:'Thiết lập & Tích hợp',permissions:['integrations.manage']}
  ]);

  const initialMeta = {
    version:'4.5.54',
    cloud:{mode:'runtime-managed',lastSync:'',status:'ready',autoSync:true},
    users:[
      {id:'u1',name:'Giám đốc Demo',email:'director.demo@alpha.local',role:'Giám đốc',department:'Ban giám đốc',status:'Active',initials:'GD'},
      {id:'u2',name:'Kế toán Demo',email:'accounting.demo@alpha.local',role:'Kế toán trưởng',department:'Kế toán',status:'Active',initials:'KT'},
      {id:'u3',name:'Quản lý dự án Demo',email:'pm.demo@alpha.local',role:'Quản lý dự án',department:'Kiến trúc',status:'Active',initials:'PM'}
    ],
    roles:[
      {id:'r1',name:'Giám đốc',description:'Toàn quyền hệ thống',permissions:['*']},
      {id:'r2',name:'Kế toán trưởng',description:'Tài chính, kế toán và thuế',permissions:['dashboard','commercial','procurement','finance','financialAnalytics','accounting','tax','payroll','documents','reports','settings']},
      {id:'r3',name:'Quản lý dự án',description:'Dự án, công việc và nhân sự dự án',permissions:['dashboard','tasks','projects','controls','planning','crm','approvals','people','timesheets','documents','reports']}
    ],
    audit:[
      {id:'log1',time:new Date(Date.now()-18*60000).toISOString(),user:'Giám đốc Demo',action:'Đăng nhập',module:'Hệ thống',detail:'Đăng nhập từ thiết bị hiện tại',type:'security'},
      {id:'log2',time:new Date(Date.now()-70*60000).toISOString(),user:'Kế toán Demo',action:'Ghi sổ',module:'Kế toán',detail:'Chứng từ HĐ-0001 đã được ghi sổ',type:'update'},
      {id:'log3',time:new Date(Date.now()-130*60000).toISOString(),user:'Quản lý dự án Demo',action:'Phê duyệt',module:'Timesheet',detail:'Đã duyệt 7,5 giờ dự án Aurora',type:'approve'}
    ],
    integrations:[
      {id:'einvoice',name:'Hóa đơn điện tử',provider:'MISA meInvoice / Viettel / VNPT',status:false,note:'Sẵn sàng cấu hình API'},
      {id:'bank',name:'Kết nối ngân hàng',provider:'Open Banking / sao kê tự động',status:false,note:'Chưa khai báo tài khoản'},
      {id:'signature',name:'Chữ ký số',provider:'USB Token / HSM / ký từ xa',status:false,note:'Chưa khai báo chứng thư'},
      {id:'email',name:'Email doanh nghiệp',provider:'SMTP / Microsoft 365 / Gmail',status:false,note:'Chưa khai báo máy chủ gửi'},
      {id:'push',name:'Thông báo đẩy',provider:'Web Push / PWA',status:false,note:'Cần cấp quyền trên trình duyệt'},
      {id:'webhook',name:'API & Webhook',provider:'Tích hợp hệ thống bên ngoài',status:false,note:'Chưa cấu hình endpoint'}
    ],
    files:[],
    backups:[]
  };

  const metaStore=ENVIRONMENT==='demo'?localStorage:sessionStorage;
  const storedMeta=readJSON(META_KEY,{},metaStore);
  let meta=ENVIRONMENT==='demo'?{...initialMeta,...storedMeta}:{version:'4.5.54',cloud:{...initialMeta.cloud},users:[],roles:[],audit:[],integrations:[],files:[],backups:[],...storedMeta};
  meta.cloud={...initialMeta.cloud,...(meta.cloud||{})};delete meta.cloud.endpoint;delete meta.cloud.anonKey;
  meta.users=Array.isArray(meta.users)?meta.users:[];
  meta.roles=Array.isArray(meta.roles)?meta.roles:[];
  if(ENVIRONMENT==='demo')meta.roles.forEach(r=>{if(['Kế toán trưởng','Quản lý dự án'].includes(r.name)&&!r.permissions.includes('reports'))r.permissions.push('reports');if(r.permissions.includes('projects')){if(!r.permissions.includes('controls'))r.permissions.push('controls');if(!r.permissions.includes('planning'))r.permissions.push('planning');}if((r.permissions.includes('crm')||r.permissions.includes('accounting'))&&!r.permissions.includes('commercial'))r.permissions.push('commercial');if(r.permissions.includes('accounting')&&r.permissions.includes('reports')&&!r.permissions.includes('financialAnalytics'))r.permissions.push('financialAnalytics');if(r.name==='Kế toán trưởng'&&!r.permissions.includes('payroll'))r.permissions.push('payroll');});
  meta.audit=Array.isArray(meta.audit)?meta.audit:[];
  meta.integrations=Array.isArray(meta.integrations)?meta.integrations:[];
  meta.files=Array.isArray(meta.files)?meta.files:[];
  meta.backups=Array.isArray(meta.backups)?meta.backups:[];
  const persist=()=>saveJSON(META_KEY,meta,metaStore);

  let session = readJSON(SESSION_KEY,null,sessionStore());
  let lastActivityAt=Number(session?.lastActivityAt||Date.now());
  let lastActivityPersistedAt=0;
  let sessionExpiryRunning=false;
  let cloudView = '';
  let filesDB;
  let productionUsers=[];
  let productionRoles=[];

  const el=id=>document.getElementById(id);
  const content=el('content'), nav=el('nav'), pageTitle=el('pageTitle'), pageSubtitle=el('pageSubtitle'), pageIcon=el('pageIcon'), primaryAction=el('primaryAction');

  const icon = id => `<svg aria-hidden="true"><use href="#${id}"/></svg>`;
  const toast = msg => { const t=el('toast'); t.textContent=msg; t.classList.remove('hidden'); setTimeout(()=>t.classList.add('hidden'),2300); };
  function clearCloudSessionData(){
    if(ENVIRONMENT==='demo'){
      sessionStorage.removeItem(SESSION_KEY);localStorage.removeItem(SESSION_KEY);
      return;
    }
    for(const key of [SESSION_KEY,META_KEY,SYNC_SESSION_KEY,CORE_KEY]){
      try{sessionStorage.removeItem(key);}catch{}
      try{localStorage.removeItem(key);}catch{}
    }
  }
  if(ENVIRONMENT!=='demo'&&window.AlphaOnline?.signOut&&!window.AlphaOnline.__cleanSessionWrapped){
    const originalSignOut=window.AlphaOnline.signOut.bind(window.AlphaOnline);
    window.AlphaOnline.signOut=async(...args)=>{try{return await originalSignOut(...args);}finally{clearCloudSessionData();}};
    Object.defineProperty(window.AlphaOnline,'__cleanSessionWrapped',{value:true,enumerable:false});
  }
  function reloadForCleanSession(){
    if(ENVIRONMENT==='demo')return;
    setTimeout(()=>{try{location.reload();}catch{}},80);
  }
  function recordSessionActivity(){
    if(ENVIRONMENT==='demo'||!session||document.visibilityState==='hidden')return;
    const now=Date.now();lastActivityAt=now;
    if(now-lastActivityPersistedAt<60000)return;
    lastActivityPersistedAt=now;session.lastActivityAt=now;saveJSON(SESSION_KEY,session,sessionStore());
  }
  function sessionExpiryReason(){
    if(ENVIRONMENT==='demo'||!session)return '';
    const loginAt=Date.parse(session.loginAt||'');
    const now=Date.now();
    if(Number.isFinite(loginAt)&&now-loginAt>=SESSION_ABSOLUTE_TIMEOUT_MS)return 'Phiên làm việc đã đạt giới hạn an toàn và được đăng xuất.';
    if(now-lastActivityAt>=SESSION_IDLE_TIMEOUT_MS)return 'Phiên đã tự đăng xuất do không hoạt động để bảo vệ dữ liệu.';
    return '';
  }
  function setPrivacyShield(active){
    if(ENVIRONMENT==='demo')return;
    let shield=el('privacyShield');
    if(!shield){
      shield=document.createElement('div');shield.id='privacyShield';shield.className='privacy-shield';shield.setAttribute('aria-hidden','true');
      shield.innerHTML='<div><span>AD</span><strong>ALPHA DESIGN</strong><p>Nội dung đã được ẩn để bảo vệ thông tin</p></div>';
      document.body.appendChild(shield);
    }
    const visible=Boolean(active&&session);shield.classList.toggle('active',visible);document.body.classList.toggle('privacy-shield-active',visible);
  }
  function ensureCloudWritable(){if(ENVIRONMENT==='demo')return true;const guard=window.AlphaProductionGuard;if(guard?.canWrite?.())return true;toast(guard?.reason?.()||'Hệ thống đang khóa ghi hoặc phiên xác thực không đủ quyền.');return false;}
  function currentUser(){
    const ctx=window.AlphaOnline?.getContext?.();
    if(ctx){const name=ctx.full_name||'Người dùng Cloud';return {id:ctx.user_id,name,email:'',role:ctx.role_name||'Người dùng',department:ctx.department||'',status:'Active',initials:name.split(' ').slice(-2).map(x=>x[0]).join('').toUpperCase()};}
    return meta.users.find(x=>x.id===session?.userId) || meta.users[0] || {id:'pending',name:'Người dùng Cloud',email:'',role:'Đang xác thực',department:'',status:'Pending',initials:'AD'};
  }
  function roleFor(user=currentUser()){
    const ctx=window.AlphaOnline?.getContext?.();
    if(ctx)return {name:ctx.role_name,permissions:Array.isArray(ctx.permissions)?ctx.permissions:[]};
    return meta.roles.find(r=>r.name===user?.role) || meta.roles[0];
  }
  function hasPermission(permission){
    const ps=roleFor()?.permissions||[];
    return window.AlphaPermissionMap?.hasPermission?.(ps,permission)??(ps.includes('*')||ps.includes('admin')||ps.includes(permission));
  }
  function canManageRoles(){
    const role=roleFor();
    return /giám đốc|director/i.test(String(currentUser()?.role||role?.name||'')) || (role?.permissions||[]).includes('*');
  }
  function roleHasModule(role,module){
    const granted=Array.isArray(role?.permissions)?role.permissions:[];
    if(granted.includes('*')||role?.is_admin)return true;
    if(granted.includes(module.key))return true;
    return module.permissions.some(code=>granted.includes(code));
  }
  function roleModuleLabels(role){
    return MODULE_ACCESS.filter(module=>roleHasModule(role,module)).map(module=>module.label);
  }
  function addAudit(action,module,detail,type='update'){
    const u=currentUser();
    meta.audit.unshift({id:uid('log'),time:nowISO(),user:u?.name||'Khách',action,module,detail,type});
    meta.audit=meta.audit.slice(0,500); persist();
  }

  function applySession(){
    const login=el('loginScreen');
    const verifiedContext=window.AlphaOnline?.getContext?.();
    if(!session||(ENVIRONMENT!=='demo'&&!verifiedContext)){ login.classList.remove('hidden'); document.body.classList.add('locked'); return; }
    login.classList.add('hidden'); document.body.classList.remove('locked');
    const u=currentUser();
    ['headerUserName','profileName'].forEach(id=>{if(el(id))el(id).textContent=u.name});
    if(el('headerUserRole'))el('headerUserRole').textContent=u.role;
    if(el('profileRole'))el('profileRole').textContent=`${u.role} • ${u.department}`;
    ['headerAvatar','profileAvatar'].forEach(id=>{if(el(id))el(id).textContent=u.initials||u.name.split(' ').slice(-2).map(x=>x[0]).join('')});
    document.querySelectorAll('[data-permission]').forEach(item=>item.classList.toggle('permission-hidden',!hasPermission(item.dataset.permission)));
    document.querySelectorAll('.nav-group').forEach(group=>group.classList.toggle('permission-hidden',!group.querySelector('.nav-item:not(.permission-hidden)')));
  }

  let sessionCompletion=null;
  async function completeCloudSession(context,{announce=false}={}){
    if(!context)return false;
    if(sessionCompletion)return sessionCompletion;
    sessionCompletion=(async()=>{
      const secured=await window.AlphaAuthSecurity?.ensureRequiredMfa?.(context)||context;
      if(!secured?.user_id)throw new Error('Không xác minh được thông tin tài khoản Cloud.');
      lastActivityAt=Date.now();
      session={userId:secured.user_id,cloud:true,loginAt:nowISO(),lastActivityAt,device:navigator.userAgent};
      saveJSON(SESSION_KEY,session,sessionStore());applySession();window.dispatchEvent(new CustomEvent('alpha:auth-changed'));
      if(announce)toast(`Xin chào ${currentUser().name}`);
      return true;
    })();
    try{return await sessionCompletion;}finally{sessionCompletion=null;}
  }

  async function login(email,password){
    try{
      if(window.AlphaOnline?.isConfigured?.()){
        const result=await window.AlphaOnline.signIn(email,password);const ctx=result?.context||window.AlphaOnline.getContext?.();
        await completeCloudSession(ctx,{announce:true});addAudit('Đăng nhập','Hệ thống','Đăng nhập Cloud và xác minh chính sách bảo mật thành công','security');window.AlphaOnline?.getClient?.()?.rpc?.('log_security_event',{p_event_type:'auth.login',p_success:true,p_severity:'info',p_details:{client:'web-v4.5.54',aal:window.AlphaOnline?.getContext?.()?.aal||'aal1'}}).catch?.(()=>{});return true;
      }
      if(ENVIRONMENT!=='demo'||RUNTIME.allowDemoLogin!==true){toast('Môi trường này bắt buộc đăng nhập Supabase Auth.');return false;}
      const user=meta.users.find(x=>x.email.toLowerCase()===String(email).toLowerCase()&&x.status==='Active')||meta.users[0];
      session={userId:user.id,demo:true,loginAt:nowISO(),lastActivityAt:Date.now(),device:navigator.userAgent};saveJSON(SESSION_KEY,session,sessionStore());applySession();addAudit('Đăng nhập Demo','Hệ thống','Phiên trình diễn không chứa dữ liệu thật','security');toast(`Chế độ trình diễn: ${user.name}`);return true;
    }catch(err){toast(`Đăng nhập thất bại: ${err.message}`);return false;}
  }
  async function logout({reason='',reload=ENVIRONMENT!=='demo'}={}){ addAudit('Đăng xuất','Hệ thống',reason||'Kết thúc phiên đăng nhập','security');if(window.AlphaOnline?.isConfigured?.()){window.AlphaOnline?.getClient?.()?.rpc?.('log_security_event',{p_event_type:'auth.logout',p_success:true,p_severity:'info',p_details:{client:'web-v4.5.54',reason:reason?'session-policy':'user'}}).catch?.(()=>{});await window.AlphaOnline.signOut().catch(()=>{});}clearCloudSessionData();session=null;lastActivityAt=Date.now();setPrivacyShield(false);applySession();window.dispatchEvent(new CustomEvent('alpha:auth-changed'));el('profileDrawer')?.classList.add('hidden');el('drawerBackdrop')?.classList.add('hidden');if(reason)toast(reason);if(reload)reloadForCleanSession(); }

  function openFileDB(){
    return new Promise((resolve,reject)=>{
      if(filesDB) return resolve(filesDB);
      const req=indexedDB.open('alpha_design_erp_cloud_files',1);
      req.onupgradeneeded=()=>{ if(!req.result.objectStoreNames.contains('files')) req.result.createObjectStore('files',{keyPath:'id'}); };
      req.onsuccess=()=>{filesDB=req.result;resolve(filesDB)}; req.onerror=()=>reject(req.error);
    });
  }
  const BLOCKED_UPLOAD_EXTENSIONS=new Set(['html','htm','svg','js','mjs','cjs','exe','msi','bat','cmd','com','scr','ps1','sh','jar']);
  const BLOCKED_UPLOAD_MIME_TYPES=new Set(['text/html','image/svg+xml','text/javascript','application/javascript','application/x-msdownload']);
  function assertSafeUpload(file){
    const name=String(file?.name||'').normalize('NFKC').trim(),extension=name.toLowerCase().split('.').pop()||'',mime=String(file?.type||'').toLowerCase();
    if(!name||name==='.'||name==='..'||/[\u0000-\u001f\u007f]/.test(name))throw new Error('Tên tệp không hợp lệ.');
    if(BLOCKED_UPLOAD_EXTENSIONS.has(extension)||BLOCKED_UPLOAD_MIME_TYPES.has(mime))throw new Error('Loại tệp bị chặn vì có thể chứa mã thực thi.');
  }
  async function storeFile(file,project='Không gắn dự án'){
    if(!ensureCloudWritable())throw new Error('Không đủ quyền tải tệp.');
    if(!file||file.size>100*1024*1024)throw new Error('Tệp vượt giới hạn 100 MB.');
    assertSafeUpload(file);
    if(String(file.name||'').length>240)throw new Error('Tên tệp vượt giới hạn 240 ký tự.');
    const id=uid('file');
    if(window.AlphaOnline?.isConfigured?.()&&window.AlphaOnline?.getContext?.()){
      const uploaded=await window.AlphaOnline.uploadFile(file,'general');
      const rec={id,name:file.name,type:file.type||'application/octet-stream',size:file.size,uploadedAt:uploaded.uploadedAt,uploadedBy:uploaded.uploadedBy,project,storagePath:uploaded.path,cloud:true};
      const core=window.AlphaERP?.getDB?.()||{};core.documents=Array.isArray(core.documents)?core.documents:[];core.documents.unshift({id,title:file.name,type:'Cloud file',projectId:'',version:'01',status:'Active',ownerId:'',storagePath:uploaded.path,fileName:file.name,mimeType:rec.type,sizeBytes:rec.size,uploadedAt:rec.uploadedAt,uploadedBy:rec.uploadedBy});
      const committed=window.AlphaERP?.commit?.(core);
      if(!committed){await window.AlphaOnline.deleteFile(uploaded.path).catch(()=>{});throw new Error('Không thể ghi metadata hồ sơ; tệp Cloud đã được hoàn tác.');}
      meta.files.unshift(rec);persist();
      addAudit('Tải lên Cloud','Lưu trữ tệp',`${file.name} • ${(file.size/1024/1024).toFixed(2)} MB`,'create');return rec;
    }
    const rec={id,name:file.name,type:file.type||'application/octet-stream',size:file.size,uploadedAt:nowISO(),uploadedBy:currentUser().name,project,blob:file};
    const db=await openFileDB(); await new Promise((res,rej)=>{const tx=db.transaction('files','readwrite');tx.objectStore('files').put(rec);tx.oncomplete=res;tx.onerror=()=>rej(tx.error)});
    meta.files.unshift({...rec,blob:undefined}); persist(); addAudit('Tải lên','Lưu trữ tệp',`${file.name} • ${(file.size/1024/1024).toFixed(2)} MB`,'create');return rec;
  }
  async function getFile(id){
    const coreDoc=(window.AlphaERP?.getDB?.().documents||[]).find(x=>x.id===id&&x.storagePath);
    if(coreDoc&&window.AlphaOnline?.isConfigured?.()){const url=await window.AlphaOnline.signedFileUrl(coreDoc.storagePath);const res=await fetch(url);if(!res.ok)throw new Error('Không tải được tệp từ Cloud');return {name:coreDoc.fileName||coreDoc.title,blob:await res.blob()};}
    const db=await openFileDB(); return new Promise((res,rej)=>{const r=db.transaction('files').objectStore('files').get(id);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
  }
  async function removeFile(id){
    if(!ensureCloudWritable())throw new Error('Không đủ quyền xóa tệp.');
    const core=window.AlphaERP?.getDB?.()||{};const coreDoc=(core.documents||[]).find(x=>x.id===id&&x.storagePath);const info=meta.files.find(x=>x.id===id)||coreDoc;
    if(coreDoc&&window.AlphaOnline?.isConfigured?.()){
      if(!window.AlphaERP?.moveToTrash)throw new Error('Mô-đun Thùng rác chưa sẵn sàng.');
      window.AlphaERP.moveToTrash('documents',id,{sourceView:'documents',sourceLabel:'Lưu trữ tệp Cloud',displayName:coreDoc.fileName||coreDoc.title||info?.name||id});
    }
    else{
      if(!info)throw new Error('Không tìm thấy tệp cần xóa.');
      if(!window.AlphaERP?.moveExternalToTrash)throw new Error('Mô-đun Thùng rác chưa sẵn sàng.');
      window.AlphaERP.moveExternalToTrash({entityType:'documents',record:{id:info.id,title:info.name||info.title||id,fileName:info.name||info.fileName||'',type:info.type||'',size:info.size||0,uploadedAt:info.uploadedAt||nowISO(),uploadedBy:info.uploadedBy||currentUser().name,project:info.project||'',projectId:info.projectId||''},sourceView:'documents',sourceLabel:'Lưu trữ tệp trên thiết bị',displayName:info.name||info.title||id,externalSource:'cloud-local-file'});
    }
    meta.files=meta.files.filter(x=>x.id!==id);persist();
  }

  function coreData(){ return ENVIRONMENT==='demo'?readJSON(CORE_KEY,{}):{}; }
  function createBackup(auto=false){
    if(ENVIRONMENT!=='demo')return null;
    const payload={createdAt:nowISO(),core:coreData(),meta:{...meta,backups:[]}};
    const text=JSON.stringify(payload);
    const rec={id:uid('backup'),createdAt:payload.createdAt,size:new Blob([text]).size,createdBy:auto?'Hệ thống tự động':currentUser().name,type:auto?'Auto':'Manual',payload};
    meta.backups.unshift(rec);meta.backups=meta.backups.slice(0,8);persist();addAudit(auto?'Sao lưu tự động':'Tạo bản sao','Sao lưu',`${(rec.size/1024).toFixed(1)} KB`,auto?'system':'create');return rec;
  }
  function downloadBackup(rec){ const blob=new Blob([JSON.stringify(rec.payload,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`ALPHA_DESIGN_ERP_CLOUD_BACKUP_${rec.createdAt.slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href);addAudit('Tải bản sao','Sao lưu',rec.id,'read'); }

  async function syncCloud(){
    const b=el('syncBtn');b?.classList.add('synching');if(el('syncText'))el('syncText').textContent='Đang đồng bộ';
    try{
      if(window.AlphaOnline?.isConfigured?.()){
        const result=await window.AlphaOnline.syncNow();meta.cloud.status=result.status||'online';meta.cloud.lastSync=result.lastSync||nowISO();meta.cloud.company=result.context||null;persist();addAudit('Đồng bộ','Cloud',`Đã đồng bộ ${result.outbox||0} thay đổi còn chờ`,'system');toast((result.conflicts||0)>0?`Có ${result.conflicts} xung đột cần xử lý`:'Dữ liệu đã đồng bộ trên các thiết bị');
      }else{await new Promise(r=>setTimeout(r,250));meta.cloud.status='local-demo';meta.cloud.lastSync=nowISO();persist();toast('Chưa cấu hình máy chủ Cloud');}
    }catch(err){meta.cloud.status='error';persist();toast(`Đồng bộ thất bại: ${err.message}`)}
    finally{b?.classList.remove('synching');if(el('syncText'))el('syncText').textContent=meta.cloud.status==='error'?'Lỗi đồng bộ':'Đã đồng bộ';}
  }

  function setCloudHeader(title,subtitle,iconChar='☁'){
    pageTitle.textContent=title;pageSubtitle.textContent=subtitle;pageIcon.textContent=iconChar;primaryAction.style.display='none';
    document.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.view===cloudView));
    window.AlphaResponsive?.syncActiveNavGroup?.();
    document.querySelectorAll('[data-mobile-view]').forEach(x=>x.classList.remove('active'));
  }
  function renderCloud(view){
    cloudView=view;
    setTimeout(()=>window.AlphaResponsive?.enhanceResponsiveTables?.(),0);
    if(view==='cloud-admin') renderCloudAdmin();
    if(view==='readiness') renderReadiness();
    if(view==='security-center') renderSecurityCenter();
    if(view==='users') renderUsers();
    if(view==='audit') renderAudit();
    if(view==='storage') renderStorage();
    if(view==='integrations') renderIntegrations();
    addAudit('Mở phân hệ','Điều hướng',pageTitle.textContent,'read');
  }

  function feature(id,title,text,state='ok'){
    return `<article class="feature-tile"><span class="tile-icon">${icon(id)}</span><div><h3>${esc(title)}</h3><p>${esc(text)}</p></div><i class="state ${state==='warn'?'warn':''}"></i></article>`;
  }
  function statCard(label,value,note=''){return `<div class="card kpi-card"><div class="kpi-label">${esc(label)}</div><div class="kpi-value">${esc(value)}</div><div class="kpi-foot"><span>${esc(note)}</span></div></div>`;}
  function durationMinutes(milliseconds){return `${Math.round(milliseconds/60000).toLocaleString('vi-VN')} phút`;}
  function securityPosture(title,state,description,tone='good'){
    return `<article class="security-posture-card ${esc(tone)}"><div class="security-posture-head"><span aria-hidden="true">${tone==='good'?'✓':tone==='warn'?'!':'i'}</span><div><h3>${esc(title)}</h3><strong>${esc(state)}</strong></div></div><p>${esc(description)}</p></article>`;
  }
  function renderSecurityCenter(){
    setCloudHeader('Trung tâm bảo mật','Phiên đăng nhập, dữ liệu, MFA và các lớp phòng vệ website','◆');
    const context=window.AlphaOnline?.getContext?.()||window.AlphaProductionGuard?.getContext?.()||{};
    const sync=window.AlphaProductionGuard?.getStatus?.()||window.AlphaOnline?.status?.()||{};
    const demo=ENVIRONMENT==='demo';
    const mfaState=demo?'Mô phỏng':context.aal==='aal2'?'AAL2 đã xác thực':'AAL1 / cần MFA khi thao tác đặc quyền';
    const mfaTone=demo?'info':context.aal==='aal2'?'good':'warn';
    const source=demo?'Dữ liệu mẫu trên thiết bị':'PostgreSQL authoritative + RLS theo công ty';
    const connection=demo?'Không kết nối dữ liệu thật':sync.status==='online'?'Đang kết nối an toàn':'Chỉ đọc khi mất kết nối';
    const sessionState=demo?'Không áp dụng cho dữ liệu thật':`${durationMinutes(SESSION_IDLE_TIMEOUT_MS)} không hoạt động • tối đa ${Math.round(SESSION_ABSOLUTE_TIMEOUT_MS/3600000)} giờ`;
    content.innerHTML=`<section class="security-hero"><div class="security-hero-copy"><span class="eyebrow">ALPHA DESIGN • DEFENCE IN DEPTH</span><h2>Dữ liệu được bảo vệ theo nhiều lớp</h2><p>Giao diện không lưu khóa quản trị. Quyền truy cập, cô lập công ty và kiểm tra liên kết được thực thi lại tại máy chủ dữ liệu.</p><div class="security-hero-actions"><button class="primary-btn" id="openAccountSecurity">Bảo mật tài khoản & MFA</button>${demo?'':'<button class="secondary-btn" id="verifySecuritySession">Kiểm tra phiên hiện tại</button>'}</div></div><div class="security-score"><span>Trạng thái</span><strong>${demo?'DEMO':context.user_id?'ĐÃ XÁC THỰC':'ĐANG KHÓA'}</strong><small>${esc(connection)}</small></div></section>
    <section class="security-posture-grid section">
      ${securityPosture('Nguồn dữ liệu',source,demo?'Bản trình diễn không được dùng để nhập thông tin thật.':'Trình duyệt chỉ ghi qua RPC có RLS, row version và idempotency.')}
      ${securityPosture('Xác thực đa yếu tố',mfaState,demo?'Luồng MFA được mô phỏng trong gói demo.':'Vai trò đặc quyền phải đạt AAL2 trước khi ghi dữ liệu.',mfaTone)}
      ${securityPosture('Chính sách phiên',sessionState,demo?'Production tự xóa sạch dữ liệu phiên khi đăng xuất hoặc đổi tài khoản.':'Tự đăng xuất khi quá hạn; dữ liệu đồng bộ và hàng đợi được xóa khi kết thúc phiên.')}
      ${securityPosture('Mất kết nối',demo?'Cho phép sửa dữ liệu mẫu':'Khóa ghi fail-closed',demo?'Chỉ áp dụng cho dữ liệu mẫu.':'Không xếp hàng thay đổi ngầm khi trình duyệt mất kết nối máy chủ.',demo?'info':'good')}
      ${securityPosture('Tệp tải lên','Tối đa 100 MB • chặn tệp thực thi','Tệp Cloud dùng bucket riêng tư, URL tải xuống có thời hạn và chính sách theo công ty.')}
      ${securityPosture('Phòng vệ trình duyệt','CSP • HSTS • anti-clickjacking','Backend giới hạn origin, loại nội dung, quyền trình duyệt và nguồn kết nối Supabase chính xác.')}
      ${securityPosture('Công thức actual','Posted / Paid / Approved','Doanh thu–chi phí từ sổ Posted; dòng tiền chỉ từ Paid; dự báo không tạo actual.')}
      ${securityPosture('Liên kết phân hệ','Kiểm tra hai lớp','Hợp đồng–hóa đơn–phân bổ–tiền–chứng từ–ngân sách được kiểm tra ở UI và database.')}
    </section>
    <section class="grid two-col section"><div class="card admin-card"><div class="section-header"><div><h2>Quy tắc bảo vệ thông tin</h2><p>Áp dụng cho mọi người dùng vận hành.</p></div></div><ul class="security-rules"><li>Không đưa Service Role/Secret key vào mã trình duyệt.</li><li>Không dùng bản Demo để nhập dữ liệu khách hàng hoặc tài chính thật.</li><li>Bật MFA cho Giám đốc, kế toán trưởng và quản trị hệ thống.</li><li>Dùng HTTPS, backup mã hóa và kiểm thử phục hồi trước go-live.</li></ul></div><div class="card admin-card"><div class="section-header"><div><h2>Kiểm soát phiên hiện tại</h2><p>Thông tin an toàn, không hiển thị token hoặc khóa bí mật.</p></div></div><div class="security-session-list"><div><span>Môi trường</span><strong>${esc(ENVIRONMENT.toUpperCase())}</strong></div><div><span>Đồng bộ</span><strong>${esc(String(sync.status||'demo').toUpperCase())}</strong></div><div><span>Cấp xác thực</span><strong>${esc(String(context.aal||'demo').toUpperCase())}</strong></div><div><span>Lưu phiên</span><strong>SESSION ONLY</strong></div></div></div></section>`;
    el('openAccountSecurity').onclick=()=>el('accountSecurityBtn')?.click();
    if(el('verifySecuritySession'))el('verifySecuritySession').onclick=async()=>{const button=el('verifySecuritySession');button.disabled=true;try{await window.AlphaProductionGuard?.refreshContext?.();toast('Đã kiểm tra lại phiên và quyền truy cập');renderSecurityCenter();}catch(error){toast(`Không thể kiểm tra phiên: ${error.message}`);}finally{if(button)button.disabled=false;}};
  }
  function maskProjectUrl(value=''){
    try{const url=new URL(String(value));const host=url.hostname;return host.length>18?`${host.slice(0,8)}••••${host.slice(-8)}`:host;}catch{return 'Chưa cấu hình';}
  }
  function renderCloudAdmin(){
    setCloudHeader('Quản trị Cloud','Trạng thái bảo mật, đồng bộ, sao lưu và hạ tầng','☁');
    const used=meta.files.reduce((s,x)=>s+(x.size||0),0), last=meta.cloud.lastSync?fmtDateTime(meta.cloud.lastSync):'Chưa đồng bộ',syncState=window.AlphaOnline?.status?.()||{},conflicts=Object.values(syncState.conflicts||{});
    const configured=Boolean(window.AlphaOnline?.isConfigured?.());
    const runtimeProject=maskProjectUrl(RUNTIME.supabaseUrl||'');
    const mode=ENVIRONMENT==='demo'?'Demo cục bộ':`${ENVIRONMENT.toUpperCase()} • ${RUNTIME.dataMode||'server-authoritative'}`;
    content.innerHTML=`<section class="cloud-hero"><div><span class="eyebrow">ALPHA DESIGN ERP CLOUD</span><h2>Hệ thống vận hành tập trung</h2><p>${ENVIRONMENT==='demo'?'Gói Demo không kết nối dữ liệu thật.':'Cấu hình cloud được khóa tại thời điểm triển khai; người dùng không thể thay endpoint hoặc khóa trên trình duyệt.'}</p></div><div class="cloud-health"><div><strong>${configured?'Đã cấu hình':'Chưa cấu hình'}</strong><span>PostgreSQL / Supabase</span></div><div><strong>${meta.cloud.lastSync?fmtDateTime(meta.cloud.lastSync):'Chưa có'}</strong><span>Lần đồng bộ gần nhất</span></div><div><strong>${ENVIRONMENT==='demo'?(used/1024/1024).toFixed(1)+' MB':'Server'}</strong><span>${ENVIRONMENT==='demo'?'Tệp Demo cục bộ':'Lưu trữ tập trung'}</span></div></div></section>
    <section class="section feature-grid">${feature('i-shield','Đăng nhập & phân quyền',`${meta.users.length} người dùng • ${meta.roles.length} vai trò`)}${feature('i-cloud','Đồng bộ thiết bị',`Lần cuối: ${last}`,meta.cloud.status==='error'?'warn':'ok')}${feature('i-history','Nhật ký hệ thống',`${meta.audit.length} hoạt động đã ghi nhận`)}${feature('i-folder','Lưu trữ hồ sơ',ENVIRONMENT==='demo'?`${meta.files.length} tệp Demo`:'Supabase Storage / chính sách máy chủ')}${feature('i-cloud','Sao lưu',ENVIRONMENT==='demo'?`${meta.backups.length} bản Demo`:'pg_dump mã hóa / PITR')}${feature('i-plug','Hóa đơn điện tử',meta.integrations.find(x=>x.id==='einvoice')?.status?(ENVIRONMENT==='demo'?'Đã bật mô phỏng':'Đã kết nối'):'Chờ backend adapter','warn')}${feature('i-warehouse','Ngân hàng',meta.integrations.find(x=>x.id==='bank')?.status?(ENVIRONMENT==='demo'?'Đã cấu hình Demo':'Đã kết nối'):'Chờ backend adapter','warn')}${feature('i-contract','Chữ ký số',meta.integrations.find(x=>x.id==='signature')?.status?(ENVIRONMENT==='demo'?'Đã bật mô phỏng':'Đã kích hoạt'):'Chờ backend adapter','warn')}</section>
    <section class="grid two-col section cloud-deployment-grid"><div class="card admin-card deployment-config-card"><div class="section-header"><div><h2>Cấu hình triển khai</h2><p>Chỉ đọc; được tạo bởi DevOps/runtime-config.js và secret manager.</p></div></div><div class="inline-stats"><div class="mini-stat"><span>Môi trường</span><strong>${esc(mode)}</strong></div><div class="mini-stat"><span>Project</span><strong>${esc(runtimeProject)}</strong></div><div class="mini-stat"><span>Nguồn cấu hình</span><strong>Runtime / CI</strong></div></div><div class="note deployment-security-note"><strong>Bảo mật:</strong> endpoint và publishable key không thể sửa trong giao diện. Service-role key tuyệt đối không xuất hiện ở trình duyệt.</div>${ENVIRONMENT==='demo'?'':`<div class="deployment-actions"><button type="button" class="secondary-btn" id="testSync">Kiểm tra kết nối</button></div>`}</div>
    <div class="card admin-card backup-restore-card"><div class="section-header"><div><h2>Sao lưu & phục hồi</h2><p>${ENVIRONMENT==='demo'?'Bản sao mô phỏng trên thiết bị.':'Backup production chỉ chạy từ máy chủ bằng pg_dump mã hóa/PITR.'}</p></div>${ENVIRONMENT==='demo'?'<button class="primary-btn" id="backupNow">Sao lưu Demo</button>':''}</div><div class="table-wrap"><table class="table-fit-wide table-cloud-backups"><thead><tr><th>Thời gian</th><th>Loại</th><th>Dung lượng</th><th>Người tạo</th><th>Thao tác</th></tr></thead><tbody>${meta.backups.slice(0,5).map(x=>`<tr><td>${fmtDateTime(x.createdAt)}</td><td class="backup-type-cell"><span class="role-tag backup-type-pill">${esc(x.type==='Auto'?'Tự động':x.type)}</span></td><td class="backup-size-cell"><span class="backup-size backup-size-chip">${(x.size/1024).toFixed(1)} KB</span></td><td class="backup-created-by">${esc(x.createdBy)}</td><td class="actions backup-actions-cell">${ENVIRONMENT==='demo'?`<button class="ghost-btn download-backup" data-id="${esc(x.id)}">Tải xuống</button>`:'—'}</td></tr>`).join('')||'<tr><td colspan="5" class="muted">Chưa có bản sao.</td></tr>'}</tbody></table></div></div></section>`;
    if(conflicts.length){content.insertAdjacentHTML('beforeend',`<section class="card table-card section"><div class="section-header card-pad"><div><h2>Xung đột đồng bộ <span class="sync-conflict-badge">${conflicts.length}</span></h2><p>Không tự ghi đè dữ liệu khi hai thiết bị cùng sửa một bản ghi.</p></div></div><div class="table-wrap"><table><thead><tr><th>Phân hệ</th><th>Bản ghi</th><th>Phát hiện</th><th>Chọn phiên bản</th></tr></thead><tbody>${conflicts.map(c=>`<tr><td>${esc(c.collection)}</td><td>${esc(c.id)}</td><td>${fmtDateTime(c.detectedAt)}</td><td><button class="ghost-btn resolve-sync" data-write-action data-key="${esc(c.key)}" data-strategy="server">Dùng bản Cloud</button><button class="ghost-btn resolve-sync" data-write-action data-key="${esc(c.key)}" data-strategy="local">Giữ bản thiết bị</button></td></tr>`).join('')}</tbody></table></div></section>`)}
    document.querySelectorAll('.resolve-sync').forEach(b=>b.onclick=()=>{if(!ensureCloudWritable())return;window.AlphaOnline.resolveConflict(b.dataset.key,b.dataset.strategy);toast('Đã chọn phiên bản; hệ thống đang đồng bộ lại');renderCloudAdmin()});
    if(el('testSync'))el('testSync').onclick=syncCloud;
    if(el('backupNow'))el('backupNow').onclick=()=>{createBackup(false);toast('Đã tạo bản sao Demo');renderCloudAdmin()};
    document.querySelectorAll('.download-backup').forEach(b=>b.onclick=()=>{const r=meta.backups.find(x=>x.id===b.dataset.id);if(r)downloadBackup(r)});
  }

  const gateLabels={deployment:'Triển khai staging',rls:'RLS & cô lập công ty',mfa:'MFA AAL2',golden_dataset:'Golden dataset',backup:'Backup mã hóa',restore:'Restore drill',load:'Load test',parallel_run:'Parallel run',browser_smoke:'Browser smoke',secret_scan:'Secret scan'};
  async function cloudApi(path,{method='GET',body}={}){
    const client=window.AlphaOnline?.getClient?.();if(!client)throw new Error('Chưa đăng nhập Supabase Auth.');
    const {data}=await client.auth.getSession();const token=data?.session?.access_token;if(!token)throw new Error('Phiên đăng nhập đã hết hạn.');
    const base=String(RUNTIME.apiBaseUrl||'').replace(/\/$/,'');
    const response=await fetch(`${base}${path}`,{method,headers:{Authorization:`Bearer ${token}`,'content-type':'application/json','x-request-id':globalThis.crypto?.randomUUID?.()||uid('req')},body:body===undefined?undefined:JSON.stringify(body)});
    const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(payload.error||`HTTP ${response.status}`);return payload;
  }
  function demoReadiness(){
    const items=Object.entries(gateLabels).map(([gate_code,gate_name])=>({gate_code,gate_name,status:'blocked',passed:false,executed_at:null,summary:{reason:'Cần chạy trên Supabase staging thật'}}));
    return {release_version:'4.5.54',schema_version:'local-demo',operational_mode:'pilot',go_live_status:'blocked',production_writes_enabled:false,can_go_live:false,gates:{items,total:items.length,passed:0,failed:items.length,critical_passed:false},approvals:{accounting:null,director:null,dual_signoff_passed:false}};
  }
  function readinessBadge(item){const passed=item.passed===true;return `<span class="badge ${passed?'success':item.status==='warning'?'warning':'neutral'}">${passed?'PASS':esc(String(item.status||'BLOCKED').toUpperCase())}</span>`;}
  async function renderReadiness(){
    setCloudHeader('Sẵn sàng vận hành','Bằng chứng kỹ thuật, phê duyệt và khóa chuyển Production','✓');
    content.innerHTML='<div class="card card-pad"><p>Đang kiểm tra trạng thái phát hành…</p></div>';
    let r;
    try{r=ENVIRONMENT==='demo'?demoReadiness():(await cloudApi('/api/production-readiness')).result;}catch(error){content.innerHTML=`<div class="card card-pad"><div class="note danger-note"><strong>Không tải được Production Readiness.</strong><br>${esc(error.message)}</div></div>`;return;}
    const gates=r?.gates?.items||[];const approvals=r?.approvals||{};const passed=Number(r?.gates?.passed||0),total=Number(r?.gates?.total||gates.length);
    content.innerHTML=`<section class="cloud-hero"><div><h2>${r.can_go_live?'Đủ điều kiện phê duyệt Production':'Production đang bị khóa'}</h2><p>Database chỉ cho phép chuyển sang Production khi mọi gate còn hiệu lực và hai người có thẩm quyền ký độc lập bằng MFA AAL2.</p></div><div class="cloud-health"><div><strong>${passed}/${total}</strong><span>Gate đã đạt</span></div><div><strong>${esc(String(r.operational_mode||'pilot').toUpperCase())}</strong><span>Chế độ vận hành</span></div><div><strong>${r.can_go_live?'READY':'BLOCKED'}</strong><span>Quyết định kỹ thuật</span></div></div></section>
    <div class="grid kpi-grid section">${statCard('Schema',r.schema_version||'—','Migration hiện tại')}${statCard('Ghi Production',r.production_writes_enabled?'Đang mở':'Đang khóa','Kill switch database')}${statCard('Kế toán ký',approvals.accounting?'Đã ký':'Chưa ký','MFA AAL2')}${statCard('Giám đốc ký',approvals.director?'Đã ký':'Chưa ký','MFA AAL2')}</div>
    <div class="card table-card section"><div class="section-header card-pad"><div><h2>Gate bắt buộc</h2><p>Bằng chứng hết hạn phải được chạy lại; không thể đánh dấu đạt chỉ bằng giao diện.</p></div><button class="secondary-btn" id="refreshReadiness">Làm mới</button></div><div class="table-wrap"><table><thead><tr><th>Gate</th><th>Trạng thái</th><th>Thời điểm</th><th>Bằng chứng</th></tr></thead><tbody>${gates.map(g=>`<tr><td><strong>${esc(g.gate_name||gateLabels[g.gate_code]||g.gate_code)}</strong><div class="muted">${esc(g.gate_code)}</div></td><td>${readinessBadge(g)}</td><td>${g.executed_at?fmtDateTime(g.executed_at):'Chưa chạy'}</td><td>${esc(g.summary?.detail||g.summary?.reason||g.evidence_uri||'—')}</td></tr>`).join('')}</tbody></table></div></div>
    <div class="grid two-col section"><div class="card admin-card"><div class="section-header"><div><h2>Phê duyệt độc lập</h2><p>Chỉ mở sau khi toàn bộ gate kỹ thuật đạt.</p></div></div><div class="alert-list"><div class="alert-item"><i class="alert-icon">₫</i><div><h4>Kế toán phụ trách</h4><p>${approvals.accounting?'Đã ký lúc '+fmtDateTime(approvals.accounting.approved_at):'Chưa ký xác nhận số liệu'}</p></div>${!approvals.accounting&&ENVIRONMENT!=='demo'?'<button class="secondary-btn" id="approveAccounting" data-write-action>Ký kế toán</button>':''}</div><div class="alert-item"><i class="alert-icon">✓</i><div><h4>Giám đốc</h4><p>${approvals.director?'Đã ký lúc '+fmtDateTime(approvals.director.approved_at):'Chưa ký quyết định go-live'}</p></div>${!approvals.director&&ENVIRONMENT!=='demo'?'<button class="secondary-btn" id="approveDirector" data-write-action>Ký giám đốc</button>':''}</div></div></div>
    <div class="card admin-card"><div class="section-header"><div><h2>Chế độ vận hành</h2><p>Maintenance và Suspended khóa mọi ghi dữ liệu ở database.</p></div></div><div class="mode-selector" role="group" aria-label="Chế độ vận hành"><button class="secondary-btn mode-btn ${r.operational_mode==='pilot'?'active':''}" data-mode="pilot" data-write-action>Pilot</button><button class="secondary-btn mode-btn ${r.operational_mode==='parallel'?'active':''}" data-mode="parallel" data-write-action>Parallel</button><button class="secondary-btn mode-btn ${r.operational_mode==='maintenance'?'active':''}" data-mode="maintenance" data-write-action>Maintenance</button><button class="primary-btn mode-btn ${r.operational_mode==='production'?'active':''}" data-mode="production" data-write-action ${r.can_go_live?'':'disabled'}>Mở Production</button></div><div class="note ${r.can_go_live?'':'danger-note'}"><strong>${r.can_go_live?'Có thể xin phê duyệt':'Chưa thể go-live'}:</strong> ${r.can_go_live?'Hai phê duyệt độc lập còn lại sẽ quyết định mở Production.':'Một hoặc nhiều gate/phê duyệt chưa đạt.'}</div></div></div>`;
    el('refreshReadiness').onclick=renderReadiness;
    async function approve(type){try{await cloudApi('/api/release-approval',{method:'POST',body:{release:r.release_version,approvalType:type,note:'Phê duyệt trên Production Readiness Center'}});toast('Đã ghi nhận phê duyệt');renderReadiness();}catch(error){toast(`Không thể phê duyệt: ${error.message}`);}}
    if(el('approveAccounting'))el('approveAccounting').onclick=()=>approve('accounting');
    if(el('approveDirector'))el('approveDirector').onclick=()=>approve('director');
    document.querySelectorAll('.mode-btn').forEach(button=>button.onclick=async()=>{if(button.disabled)return;const mode=button.dataset.mode;if(!confirm(`Chuyển hệ thống sang chế độ ${mode.toUpperCase()}?`))return;try{await cloudApi('/api/operational-mode',{method:'POST',body:{mode,release:r.release_version}});toast(`Đã chuyển sang ${mode}`);await window.AlphaProductionGuard?.refreshContext?.();renderReadiness();}catch(error){toast(`Không thể chuyển chế độ: ${error.message}`);}});
  }

  async function loadProductionAccess(){
    const client=window.AlphaOnline?.getClient?.();
    if(!client)throw new Error('Chưa đăng nhập Supabase Auth.');
    const [{data:users,error:userError},{data:roles,error:roleError}]=await Promise.all([
      client.rpc('list_company_users'),
      client.rpc('list_company_roles')
    ]);
    if(userError)throw userError;if(roleError)throw roleError;
    productionUsers=Array.isArray(users)?users:[];
    productionRoles=Array.isArray(roles)?roles:[];
  }
  function accessStatus(value){return value==='active'?'Active':'Locked'}
  function renderRoleAccessCards(roles,editable,production){
    return `<div class="card card-pad section"><div class="section-header"><div><h2>Vai trò & phạm vi phân hệ</h2><p>Giám đốc là vai trò duy nhất được thay đổi phạm vi truy cập. Vai trò Giám đốc luôn giữ toàn quyền.</p></div></div><div class="role-access-grid">${roles.map(role=>{const code=production?(role.role_code||role.code):role.id;const name=production?(role.role_name||role.name):role.name;const isDirector=Boolean(role.is_admin)||/giám đốc|director/i.test(String(name||''))||(role.permissions||[]).includes('*');const labels=isDirector?['Toàn quyền hệ thống']:roleModuleLabels(role);return `<article class="role-access-card"><div class="role-access-head"><div><strong>${esc(name)}</strong><p>${esc(role.description||role.role_description||'Phạm vi truy cập theo vai trò')}</p></div>${editable&&!isDirector?`<button class="ghost-btn edit-role-access" data-role="${esc(code)}" data-write-action>Chỉnh quyền</button>`:'<span class="badge info">'+(isDirector?'Cố định':'Chỉ xem')+'</span>'}</div><div class="role-permission-list">${labels.map(label=>`<span class="role-tag">${esc(label)}</span>`).join('')||'<span class="muted">Chưa được cấp phân hệ</span>'}</div></article>`}).join('')}</div></div>`;
  }
  function openRoleAccessModal(roleKey,production=false){
    if(!canManageRoles()){toast('Chỉ Giám đốc được quyền phân hệ cho các vai trò khác.');return;}
    const role=production?productionRoles.find(r=>String(r.role_code||r.code)===String(roleKey)):meta.roles.find(r=>String(r.id)===String(roleKey));
    if(!role)return;
    const roleName=production?(role.role_name||role.name):role.name;
    if(Boolean(role.is_admin)||/giám đốc|director/i.test(String(roleName||''))||(role.permissions||[]).includes('*')){toast('Vai trò Giám đốc luôn có toàn quyền và không thể giảm quyền.');return;}
    el('modalTitle').textContent=`Phân quyền: ${roleName}`;
    el('modalHelp').textContent='Chọn các phân hệ vai trò được phép nhìn thấy và sử dụng. Thay đổi có hiệu lực sau khi lưu.';
    el('modalForm').innerHTML=`<div class="role-permission-form">${MODULE_ACCESS.map(module=>`<label class="form-check"><input class="form-check-input" type="checkbox" name="module" value="${esc(module.key)}" ${roleHasModule(role,module)?'checked':''}><span class="form-check-label"><strong>${esc(module.label)}</strong><small>${esc(module.permissions.join(' • '))}</small></span></label>`).join('')}</div><div class="form-actions"><button type="button" class="secondary-btn" id="cloudCancelModal">Hủy</button><button class="primary-btn" data-write-action>Lưu phạm vi truy cập</button></div>`;
    el('modalBackdrop').classList.remove('hidden');el('cloudCancelModal').onclick=()=>el('modalBackdrop').classList.add('hidden');
    el('modalForm').onsubmit=async event=>{event.preventDefault();const selected=[...event.target.querySelectorAll('input[name="module"]:checked')].map(input=>input.value);if(!selected.includes('dashboard'))selected.unshift('dashboard');try{if(production){if(!window.AlphaProductionGuard?.canWrite?.())throw new Error(window.AlphaProductionGuard?.reason?.()||'Production đang khóa ghi.');const permissions=[...new Set(MODULE_ACCESS.filter(module=>selected.includes(module.key)).flatMap(module=>module.permissions))];const client=window.AlphaOnline?.getClient?.();const {error}=await client.rpc('update_role_module_permissions',{p_role_code:String(role.role_code||role.code),p_permissions:permissions});if(error)throw error;addAudit('Cập nhật phân quyền','Vai trò',roleName,'approve');}else{role.permissions=selected;persist();addAudit('Cập nhật phân quyền','Vai trò Demo',roleName,'approve');applySession();}el('modalBackdrop').classList.add('hidden');await renderUsers();toast('Đã cập nhật phạm vi truy cập');}catch(error){toast(`Không thể cập nhật quyền: ${error.message}`)}};
  }
  async function renderUsers(){
    setCloudHeader('Người dùng & Phân quyền','Giám đốc cấu hình phạm vi truy cập theo vai trò','♙');
    const director=canManageRoles();
    if(ENVIRONMENT!=='demo'){
      content.innerHTML='<div class="card card-pad"><p>Đang tải người dùng và quyền từ PostgreSQL…</p></div>';
      try{await loadProductionAccess();}catch(error){content.innerHTML=`<div class="card card-pad"><div class="note danger-note"><strong>Không tải được danh sách phân quyền.</strong><br>${esc(error.message)}<br>Cần chạy migration 028 và đăng nhập vai trò Giám đốc với MFA AAL2.</div></div>`;return;}
      const active=productionUsers.filter(x=>x.membership_status==='active'&&x.profile_status==='active').length;
      content.innerHTML=`<div class="grid kpi-grid">${statCard('Người dùng',productionUsers.length,'Tài khoản PostgreSQL/Auth')}${statCard('Vai trò',productionRoles.length,'RBAC theo công ty')}${statCard('Đang hoạt động',active,'Membership được phép truy cập')}${statCard('Quản trị quyền',director?'Giám đốc':'Chỉ xem',director?'Được phép cấu hình':'Không được sửa vai trò')}</div>
      <div class="card table-card section"><div class="section-header card-pad"><div><h2>Danh sách người dùng thực</h2><p>Mật khẩu do Supabase Auth quản lý; ERP không lưu hoặc hiển thị mật khẩu.</p></div>${director?'<button class="primary-btn" id="addUser" data-write-action>+ Gửi lời mời</button>':''}</div><div class="table-wrap"><table><thead><tr><th>Người dùng</th><th>Email</th><th>Vai trò</th><th>Trạng thái</th><th>Ngày tham gia</th><th></th></tr></thead><tbody>${productionUsers.map(u=>`<tr><td><strong>${esc(u.full_name)}</strong></td><td>${esc(u.email||'')}</td><td><span class="role-tag">${esc(u.role_name)}</span></td><td><span class="badge ${u.membership_status==='active'&&u.profile_status==='active'?'success':'neutral'}">${accessStatus(u.membership_status)}</span></td><td>${u.created_at?fmtDateTime(u.created_at):''}</td><td class="cloud-table-actions">${director?`<button class="ghost-btn edit-user" data-id="${esc(u.user_id)}" data-write-action>Sửa vai trò</button>`:''}</td></tr>`).join('')||'<tr><td colspan="6" class="muted">Chưa có người dùng.</td></tr>'}</tbody></table></div></div>
      ${renderRoleAccessCards(productionRoles,director,true)}`;
      if(director){el('addUser').onclick=()=>openUserModal();document.querySelectorAll('.edit-user').forEach(b=>b.onclick=()=>openUserModal(b.dataset.id));document.querySelectorAll('.edit-role-access').forEach(b=>b.onclick=()=>openRoleAccessModal(b.dataset.role,true));}return;
    }
    content.innerHTML=`<div class="grid kpi-grid">${statCard('Người dùng',meta.users.length,'Tài khoản mô phỏng')}${statCard('Vai trò',meta.roles.length,'Nhóm phân quyền demo')}${statCard('Đang hoạt động',meta.users.filter(x=>x.status==='Active').length,'Tài khoản được phép đăng nhập')}${statCard('Quản trị quyền',director?'Giám đốc':'Chỉ xem',director?'Được phép cấu hình':'Không được sửa vai trò')}</div>
    <div class="card table-card section"><div class="section-header card-pad"><div><h2>Danh sách người dùng Demo</h2><p>Chỉ là dữ liệu mô phỏng; không lưu mật khẩu.</p></div>${director?'<button class="primary-btn" id="addUser">+ Người dùng</button>':''}</div><div class="table-wrap"><table><thead><tr><th>Người dùng</th><th>Email</th><th>Vai trò</th><th>Bộ phận</th><th>Trạng thái</th><th></th></tr></thead><tbody>${meta.users.map(u=>`<tr><td><strong>${esc(u.name)}</strong></td><td>${esc(u.email)}</td><td><span class="role-tag">${esc(u.role)}</span></td><td>${esc(u.department)}</td><td><span class="badge ${u.status==='Active'?'success':'neutral'}">${esc(u.status)}</span></td><td class="cloud-table-actions">${director?`<button class="ghost-btn edit-user" data-id="${esc(u.id)}">Sửa</button>`:''}</td></tr>`).join('')}</tbody></table></div></div>
    ${renderRoleAccessCards(meta.roles,director,false)}`;
    if(director){el('addUser').onclick=()=>openUserModal();document.querySelectorAll('.edit-user').forEach(b=>b.onclick=()=>openUserModal(b.dataset.id));document.querySelectorAll('.edit-role-access').forEach(b=>b.onclick=()=>openRoleAccessModal(b.dataset.role,false));}
  }
  function openUserModal(id=''){
    const production=ENVIRONMENT!=='demo';
    const u=production?(productionUsers.find(x=>x.user_id===id)||{full_name:'',email:'',role_code:productionRoles[0]?.code||'EMPLOYEE',membership_status:'active'}):(meta.users.find(x=>x.id===id)||{name:'',email:'',role:'Quản lý dự án',department:'Kiến trúc',status:'Active'});
    const name=production?u.full_name:u.name;const email=u.email||'';const status=production?u.membership_status:(u.status==='Active'?'active':'disabled');
    const roleOptions=production?productionRoles.map(r=>`<option value="${esc(r.code)}" ${r.code===u.role_code?'selected':''}>${esc(r.name)}</option>`).join(''):meta.roles.map(r=>`<option value="${esc(r.name)}" ${r.name===u.role?'selected':''}>${esc(r.name)}</option>`).join('');
    el('modalTitle').textContent=id?'Cập nhật quyền người dùng':production?'Gửi lời mời người dùng':'Thêm người dùng Demo';
    el('modalHelp').textContent=production?'Supabase Auth gửi liên kết thiết lập mật khẩu; ERP không tiếp nhận mật khẩu.':'Tài khoản mô phỏng không có mật khẩu.';
    el('modalForm').innerHTML=`<div class="form-grid"><div class="field"><label>Họ tên</label><input name="name" required maxlength="160" value="${esc(name)}"></div><div class="field"><label>Email</label><input name="email" type="email" required ${id?'readonly':''} value="${esc(email)}"></div><div class="field"><label>Vai trò</label><select name="role">${roleOptions}</select></div>${production?'':`<div class="field"><label>Bộ phận</label><input name="department" value="${esc(u.department||'')}"></div>`}<div class="field"><label>Trạng thái</label><select name="status"><option value="active" ${status==='active'?'selected':''}>Active</option><option value="disabled" ${status!=='active'?'selected':''}>Locked</option></select></div><div class="form-actions"><button type="button" class="secondary-btn" id="cloudCancelModal">Hủy</button><button class="primary-btn" data-write-action>${id?'Lưu quyền':production?'Gửi lời mời':'Lưu Demo'}</button></div></div>`;
    el('modalBackdrop').classList.remove('hidden');el('cloudCancelModal').onclick=()=>el('modalBackdrop').classList.add('hidden');
    el('modalForm').onsubmit=async e=>{e.preventDefault();if(production&&!window.AlphaProductionGuard?.canWrite?.()){toast(window.AlphaProductionGuard?.reason?.()||'Production đang khóa ghi.');return;}const fd=new FormData(e.target);const obj={name:String(fd.get('name')||'').trim(),email:String(fd.get('email')||'').trim(),role:String(fd.get('role')||''),department:String(fd.get('department')||''),status:String(fd.get('status')||'active')};
      try{
        if(production){const client=window.AlphaOnline?.getClient?.();if(!client)throw new Error('Chưa đăng nhập Supabase Auth.');if(id){const {error}=await client.rpc('update_company_user',{p_user:id,p_role_code:obj.role,p_status:obj.status,p_full_name:obj.name});if(error)throw error;}else{const {data,error}=await client.functions.invoke('invite-user',{body:{email:obj.email,fullName:obj.name,roleCode:obj.role}});if(error)throw error;if(data?.ok===false)throw new Error(data.error||'Không gửi được lời mời.');}}
        else{const local={name:obj.name,email:obj.email,role:obj.role,department:obj.department,status:obj.status==='active'?'Active':'Locked'};local.initials=local.name.split(' ').slice(-2).map(x=>x[0]).join('').toUpperCase();if(id)Object.assign(u,local);else meta.users.push({id:uid('u'),...local});persist();addAudit(id?'Cập nhật':'Tạo mới','Người dùng Demo',local.email,id?'update':'create');}
        el('modalBackdrop').classList.add('hidden');await renderUsers();toast(id?'Đã cập nhật quyền':'Đã gửi lời mời');
      }catch(error){toast(`Không thể lưu: ${error.message}`)}
    };
  }

  function renderAudit(){
    setCloudHeader('Nhật ký hệ thống','Theo dõi ai tạo, sửa, duyệt, xóa và đăng nhập','◷');
    content.innerHTML=`<div class="grid kpi-grid">${statCard('Hoạt động hôm nay',meta.audit.filter(x=>x.time.slice(0,10)===nowISO().slice(0,10)).length,'Tất cả thao tác')}${statCard('Sự kiện bảo mật',meta.audit.filter(x=>x.type==='security').length,'Đăng nhập và tài khoản')}${statCard('Phê duyệt',meta.audit.filter(x=>x.type==='approve').length,'Hành động duyệt')}${statCard('Tổng nhật ký',meta.audit.length,'Lưu tối đa 500 dòng')}</div><div class="card table-card section"><div class="table-tools"><input id="auditSearch" class="search-input" aria-label="Tìm kiếm nhật ký hệ thống" placeholder="Tìm người dùng, hành động hoặc nội dung..."><button class="secondary-btn" id="exportAudit">Xuất CSV</button></div><div id="auditTable">${auditTable(meta.audit)}</div></div>`;
    el('auditSearch').oninput=e=>{const q=e.target.value.toLowerCase();el('auditTable').innerHTML=auditTable(meta.audit.filter(x=>(x.user+x.action+x.module+x.detail).toLowerCase().includes(q)))};el('exportAudit').onclick=exportAudit;
  }
  function auditTable(rows){return `<div class="table-wrap"><table><thead><tr><th>Thời gian</th><th>Người dùng</th><th>Hành động</th><th>Phân hệ</th><th>Chi tiết</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${fmtDateTime(x.time)}</td><td><strong>${esc(x.user)}</strong></td><td><span class="audit-action-cell"><span class="audit-dot"></span><span>${esc(x.action)}</span></span></td><td><span class="role-tag">${esc(x.module)}</span></td><td>${esc(x.detail)}</td></tr>`).join('')}</tbody></table></div>`}
  function exportAudit(){const rows=[['Thời gian','Người dùng','Hành động','Phân hệ','Chi tiết'],...meta.audit.map(x=>[fmtDateTime(x.time),x.user,x.action,x.module,x.detail])];const safeCsvCell=(v)=>{let s=String(v??'');if(/^[\t\r\n ]*[=+\-@]/.test(s))s=`'${s}`;return `"${s.replace(/"/g,'""')}"`;};const csv='\ufeff'+rows.map(r=>r.map(safeCsvCell).join(',')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='ALPHA_DESIGN_AUDIT_LOG.csv';a.click();URL.revokeObjectURL(a.href);addAudit('Xuất dữ liệu','Nhật ký hệ thống','Xuất tệp CSV','read')}

  function renderStorage(){
    setCloudHeader('Lưu trữ tệp','Hợp đồng, bản vẽ, hồ sơ và phiên bản tài liệu','▤');
    const core=window.AlphaERP?.getDB?.()||{};
    const synced=(core.documents||[]).filter(x=>x.storagePath).map(x=>({id:x.id,name:x.fileName||x.title,type:x.mimeType||x.type,size:Number(x.sizeBytes||0),uploadedAt:x.uploadedAt||nowISO(),uploadedBy:x.uploadedBy||'Cloud',project:x.projectId||'Không gắn dự án',storagePath:x.storagePath,cloud:true}));
    const files=[...synced,...meta.files.filter(x=>!synced.some(y=>y.id===x.id))];
    const total=files.reduce((sum,x)=>sum+(x.size||0),0),online=window.AlphaOnline?.isConfigured?.();
    content.innerHTML=`<div class="grid kpi-grid">${statCard('Tổng tệp',files.length,online?'Đồng bộ nhiều thiết bị':'Đã lưu trên thiết bị')}${statCard('Dung lượng',`${(total/1024/1024).toFixed(1)} MB`,online?'Supabase Storage':'IndexedDB cục bộ')}${statCard('Dự án có hồ sơ',new Set(files.map(x=>x.project)).size,'Nhóm tài liệu')}${statCard('Sao lưu',meta.backups.length,'Bản sao hệ thống')}</div><div class="card card-pad section storage-upload-card"><label class="upload-drop" id="uploadDrop"><span class="upload-drop-icon">⇧</span><span class="upload-drop-copy"><strong>Kéo thả hoặc chọn tệp để tải lên</strong><span>${online?'Tệp được mã hóa đường truyền và lưu trên Cloud để máy tính, iPhone và iPad cùng truy cập.':'Hợp đồng, PDF, DWG, Excel, ảnh và hồ sơ dự án.'}</span></span><span class="secondary-btn">Chọn tệp</span><input id="fileUpload" data-write-action type="file" multiple hidden></label></div><div class="card table-card section"><div class="section-header card-pad"><div><h2>Kho hồ sơ</h2><p>${online?'Dữ liệu tệp dùng Supabase Storage riêng tư và liên kết theo công ty.':'Chế độ cục bộ chưa đồng bộ tệp sang thiết bị khác.'}</p></div></div><div class="table-wrap"><table><thead><tr><th>Tệp</th><th>Dự án</th><th>Dung lượng</th><th>Người tải lên</th><th>Thời gian</th><th></th></tr></thead><tbody>${files.map(f=>`<tr><td><strong>${esc(f.name)}</strong><div class="muted">${esc(f.type||'Tệp dữ liệu')} ${f.cloud?'• Cloud':''}</div></td><td>${esc(f.project||'Không gắn dự án')}</td><td>${(f.size/1024/1024).toFixed(2)} MB</td><td>${esc(f.uploadedBy)}</td><td>${fmtDateTime(f.uploadedAt)}</td><td><button class="ghost-btn download-file" data-id="${esc(f.id)}">Tải xuống</button><button class="ghost-btn delete-file" data-write-action data-id="${esc(f.id)}">Xóa</button></td></tr>`).join('')||'<tr><td colspan="6" class="muted">Chưa có tệp. Nhấn vào vùng tải lên để chọn tệp.</td></tr>'}</tbody></table></div></div>`;
    const upload=el('fileUpload'),drop=el('uploadDrop');const process=async fileList=>{try{for(const file of fileList)await storeFile(file);toast(`Đã tải lên ${fileList.length} tệp`);renderStorage()}catch(err){toast(`Tải lên thất bại: ${err.message}`)}};upload.onchange=e=>process([...e.target.files]);['dragenter','dragover'].forEach(type=>drop.addEventListener(type,e=>{e.preventDefault();drop.classList.add('drag-active')}));['dragleave','drop'].forEach(type=>drop.addEventListener(type,e=>{e.preventDefault();drop.classList.remove('drag-active')}));drop.addEventListener('drop',e=>process([...e.dataTransfer.files]));
    document.querySelectorAll('.download-file').forEach(b=>b.onclick=async()=>{try{const f=await getFile(b.dataset.id);if(!f)return;const a=document.createElement('a');a.href=URL.createObjectURL(f.blob);a.download=f.name;a.click();URL.revokeObjectURL(a.href);addAudit('Tải xuống','Lưu trữ tệp',f.name,'read')}catch(err){toast(`Tải xuống thất bại: ${err.message}`)}});
    document.querySelectorAll('.delete-file').forEach(b=>b.onclick=async()=>{if(confirm('Chuyển tệp này vào Thùng rác? Tệp có thể khôi phục và sẽ tự xóa sau 30 ngày.')){try{await removeFile(b.dataset.id);renderStorage();toast('Đã chuyển tệp vào Thùng rác')}catch(err){toast(`Không thể xóa: ${err.message}`)}}});
  }

  function openAutomationConfig(kind){
    const integration=meta.integrations.find(x=>x.id===kind);if(!integration)return;
    const production=ENVIRONMENT!=='demo';const config=integration.config||{};
    const isEmail=kind==='email';
    el('modalTitle').textContent=isEmail?'Cấu hình Email tự động':'Liên kết Đồng bộ ngân hàng';
    el('modalHelp').textContent=production?'Thông tin bí mật phải lưu ở backend/secret manager; trình duyệt chỉ hiển thị trạng thái cấu hình.':'Thiết lập này mô phỏng luồng cấu hình. Không nhập mật khẩu, token hoặc khóa bí mật thật.';
    const emailFields=`<div class="form-grid"><div class="field"><label for="integration-email-provider">Nhà cung cấp</label><select id="integration-email-provider" name="provider"><option value="smtp" ${config.provider==='smtp'?'selected':''}>SMTP doanh nghiệp</option><option value="microsoft365" ${config.provider==='microsoft365'?'selected':''}>Microsoft 365</option><option value="gmail" ${config.provider==='gmail'?'selected':''}>Google Workspace</option></select></div><div class="field"><label for="integration-email-sender">Email người gửi</label><input id="integration-email-sender" name="sender" type="email" value="${esc(config.sender||'')}" placeholder="erp@alphadesign.vn"></div><div class="field"><label for="integration-email-host">Máy chủ / Tenant</label><input id="integration-email-host" name="host" value="${esc(config.host||'')}" placeholder="smtp.example.com hoặc tenant ID"></div><div class="field"><label for="integration-email-port">Cổng</label><input id="integration-email-port" name="port" type="number" min="1" max="65535" value="${esc(config.port||587)}"></div><div class="field full"><label for="integration-email-secretRef">Tên tham chiếu secret phía backend</label><input id="integration-email-secretRef" name="secretRef" value="${esc(config.secretRef||'SMTP_CREDENTIALS')}" readonly></div><div class="field full"><label><input type="checkbox" name="enabled" ${integration.status?'checked':''}> Kích hoạt lịch gửi sau khi backend xác thực kết nối</label></div></div>`;
    const bankFields=`<div class="form-grid"><div class="field"><label for="integration-bank-provider">Phương thức</label><select id="integration-bank-provider" name="provider"><option value="statement" ${config.provider==='statement'?'selected':''}>Nhập sao kê định kỳ</option><option value="openbanking" ${config.provider==='openbanking'?'selected':''}>Open Banking API</option></select></div><div class="field"><label for="integration-bank-bankName">Ngân hàng</label><input id="integration-bank-bankName" name="bankName" value="${esc(config.bankName||'')}" placeholder="Tên ngân hàng"></div><div class="field"><label for="integration-bank-accountAlias">Tên tài khoản</label><input id="integration-bank-accountAlias" name="accountAlias" value="${esc(config.accountAlias||'')}" placeholder="Tài khoản vận hành"></div><div class="field"><label for="integration-bank-last4">4 số cuối tài khoản</label><input id="integration-bank-last4" name="last4" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" value="${esc(config.last4||'')}"></div><div class="field full"><label for="integration-bank-endpoint">Endpoint / thư mục sao kê</label><input id="integration-bank-endpoint" name="endpoint" value="${esc(config.endpoint||'')}" placeholder="Backend endpoint hoặc thư mục nhập sao kê"></div><div class="field full"><label><input type="checkbox" name="enabled" ${integration.status?'checked':''}> Kích hoạt sau khi kiểm tra kết nối thành công</label></div></div>`;
    el('modalForm').innerHTML=`${production?'<div class="note danger-note"><strong>Chế độ Staging/Production:</strong> cấu hình này phải được DevOps thực hiện ở backend. Không lưu API key, mật khẩu hoặc token trong trình duyệt.</div>':''}${isEmail?emailFields:bankFields}<div class="form-actions"><button type="button" class="secondary-btn" id="cloudCancelModal">Đóng</button>${production?'':'<button class="primary-btn" data-write-action>Lưu cấu hình Demo</button>'}</div>`;
    el('modalBackdrop').classList.remove('hidden');el('cloudCancelModal').onclick=()=>el('modalBackdrop').classList.add('hidden');
    if(production)el('modalForm').querySelectorAll('input,select,textarea').forEach(control=>{control.disabled=true;control.setAttribute('aria-disabled','true');});
    el('modalForm').onsubmit=e=>{e.preventDefault();if(production)return;const fd=new FormData(e.target);if(isEmail){integration.config={provider:String(fd.get('provider')||''),sender:String(fd.get('sender')||'').trim(),host:String(fd.get('host')||'').trim(),port:Number(fd.get('port')||587),secretRef:String(fd.get('secretRef')||'SMTP_CREDENTIALS')};if(!integration.config.sender||!integration.config.host){toast('Cần nhập email người gửi và máy chủ/tenant.');return;}}else{integration.config={provider:String(fd.get('provider')||''),bankName:String(fd.get('bankName')||'').trim(),accountAlias:String(fd.get('accountAlias')||'').trim(),last4:String(fd.get('last4')||'').trim(),endpoint:String(fd.get('endpoint')||'').trim()};if(!integration.config.bankName||!integration.config.endpoint){toast('Cần nhập ngân hàng và endpoint/thư mục sao kê.');return;}if(integration.config.last4&&!/^\d{4}$/.test(integration.config.last4)){toast('Bốn số cuối tài khoản phải gồm đúng 4 chữ số.');return;}}integration.status=fd.get('enabled')==='on';integration.note=integration.status?(isEmail?'Đã cấu hình lịch gửi Demo':'Đã cấu hình đồng bộ Demo'):(isEmail?'Đã lưu cấu hình; chưa kích hoạt':'Đã lưu liên kết; chưa kích hoạt');persist();addAudit('Cập nhật cấu hình','Tích hợp',integration.name,'update');el('modalBackdrop').classList.add('hidden');renderIntegrations();toast('Đã lưu cấu hình mô phỏng');};
  }
  function renderIntegrations(){
    setCloudHeader('Tích hợp','Hóa đơn điện tử, ngân hàng, chữ ký số và thông báo','⌁');
    content.innerHTML=`<div class="grid two-col"><div class="card admin-card"><div class="section-header"><div><h2>Kết nối dịch vụ</h2><p>Bật trạng thái sau khi hoàn thành thông tin nhà cung cấp.</p></div></div>${meta.integrations.map(i=>`<div class="integration-row"><span class="integration-logo">${esc(i.name.slice(0,2).toUpperCase())}</span><div><h4>${esc(i.name)}</h4><p>${esc(i.provider)} • ${esc(i.note)}</p></div><button class="switch ${i.status?'on':''}" data-write-action data-integration="${esc(i.id)}" aria-label="Bật tắt ${esc(i.name)}"><i></i></button></div>`).join('')}</div><div class="card admin-card"><div class="section-header"><div><h2>Thông báo & tự động hóa</h2><p>Kích hoạt thông báo trình duyệt và lịch gửi báo cáo.</p></div></div><div class="alert-list automation-list"><div class="alert-item"><i class="alert-icon">♧</i><div><h4>Thông báo đẩy PWA</h4><p>Nhắc phê duyệt, công việc quá hạn và kỳ thuế.</p></div><button class="secondary-btn" id="enablePush" data-write-action>Cấp quyền</button></div><div class="alert-item"><i class="alert-icon">✉</i><div><h4>Email tự động</h4><p>${esc(meta.integrations.find(x=>x.id==='email')?.note||'Cần cấu hình SMTP hoặc Microsoft 365 trên backend.')}</p></div><button class="secondary-btn" data-automation-config="email">Cấu hình</button></div><div class="alert-item"><i class="alert-icon">↻</i><div><h4>Đồng bộ ngân hàng</h4><p>${esc(meta.integrations.find(x=>x.id==='bank')?.note||'Kết nối API ngân hàng hoặc tải sao kê định kỳ.')}</p></div><button class="secondary-btn" data-automation-config="bank">Liên kết</button></div></div></div></div>`;
    document.querySelectorAll('[data-automation-config]').forEach(button=>button.onclick=()=>openAutomationConfig(button.dataset.automationConfig));
    if(ENVIRONMENT!=='demo'){
      document.querySelectorAll('[data-integration],#enablePush').forEach(button=>{button.disabled=true;button.setAttribute('aria-disabled','true');});
      content.insertAdjacentHTML('beforeend','<div class="note section"><strong>STAGING/PRODUCTION:</strong> trạng thái tích hợp chỉ được thay đổi qua backend được kiểm soát và audit. Các nút cấu hình bên phải chỉ hiển thị yêu cầu kết nối, không lưu bí mật trong trình duyệt.</div>');
      return;
    }
    document.querySelectorAll('[data-integration]').forEach(b=>b.onclick=()=>{
      const i=meta.integrations.find(x=>x.id===b.dataset.integration);if(!i)return;
      if(['email','bank'].includes(i.id)&&!i.config){toast('Cần hoàn thành biểu mẫu cấu hình Demo trước khi bật trạng thái.');openAutomationConfig(i.id);return;}
      if(['einvoice','signature','webhook'].includes(i.id)&&!i.config?.adapterVerified){toast('Tích hợp này chưa có backend adapter; không thể đánh dấu đã kết nối.');return;}
      i.status=!i.status;i.note=i.status?'Đã bật mô phỏng — chưa phải kết nối thật':'Chờ cấu hình API';persist();addAudit(i.status?'Bật mô phỏng':'Tắt mô phỏng','Tích hợp',i.name,'update');renderIntegrations();
    });el('enablePush').onclick=async()=>{if(!('Notification'in window)){toast('Trình duyệt không hỗ trợ thông báo');return;}const p=await Notification.requestPermission();const i=meta.integrations.find(x=>x.id==='push');i.status=p==='granted';i.note=p==='granted'?'Đã được trình duyệt cấp quyền':'Chưa được cấp quyền';persist();if(p==='granted')new Notification('ALPHA DESIGN ERP',{body:'Thông báo đẩy đã được kích hoạt.'});renderIntegrations()};
  }

  window.AlphaERP?.registerTrashHandler?.('cloud-local-file',{
    restore:async entry=>{const record=entry.record||{};if(!meta.files.some(file=>String(file.id)===String(record.id)))meta.files.unshift({id:record.id,name:record.fileName||record.title||record.id,type:record.type||'application/octet-stream',size:Number(record.size||0),uploadedAt:record.uploadedAt||nowISO(),uploadedBy:record.uploadedBy||currentUser().name,project:record.project||record.projectId||'Không gắn dự án'});persist();setTimeout(()=>{renderCloud('storage');history.replaceState(null,'','#storage');},0);},
    purge:async entry=>{const dbFile=await openFileDB();await new Promise((resolve,reject)=>{const tx=dbFile.transaction('files','readwrite');tx.objectStore('files').delete(entry.recordId||entry.record?.id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});meta.files=meta.files.filter(file=>String(file.id)!==String(entry.recordId||entry.record?.id));persist();}
  });

  // Intercept the cloud-only navigation before the core application handles it.
  nav.addEventListener('click',e=>{
    const b=e.target.closest('.nav-item');if(!b)return;
    if(b.classList.contains('cloud-nav')){e.preventDefault();e.stopPropagation();if(!hasPermission(b.dataset.permission)){toast('Tài khoản không có quyền truy cập');return;}if(window.AlphaResponsive?.setSidebarOpen)window.AlphaResponsive.setSidebarOpen(false);else document.getElementById('sidebar').classList.remove('open');renderCloud(b.dataset.view);history.replaceState(null,'',`#${b.dataset.view}`);window.scrollTo({top:0,behavior:'smooth'});}
    else {cloudView='';addAudit('Mở phân hệ','Điều hướng',b.querySelector('.nav-label')?.textContent||b.dataset.view,'read');}
  },true);

  // Audit core actions by listening at document level.
  document.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.matches('.approval-action')) setTimeout(()=>addAudit('Phê duyệt','Phê duyệt',b.dataset.status||'Cập nhật trạng thái','approve'),0);
    if(b.matches('.journal-post')) setTimeout(()=>addAudit('Ghi sổ / Bỏ ghi sổ','Kế toán',`Chứng từ ${b.dataset.id}`,'approve'),0);
    if(b.matches('.edit-row')) addAudit('Mở chỉnh sửa','Dữ liệu',`${b.dataset.type} • ${b.dataset.id}`,'read');
  });
  window.addEventListener('alpha:trash-action',event=>{const detail=event.detail||{},entry=detail.entry||{},label=entry.displayName||`${entry.entityType||'Dữ liệu'} • ${entry.recordId||''}`;const action=detail.action==='restore'?'Khôi phục từ Thùng rác':detail.action==='purge'?'Xóa vĩnh viễn':detail.action==='auto-purge'?'Tự động xóa sau 30 ngày':'Chuyển vào Thùng rác';addAudit(action,'Thùng rác',label,detail.action==='restore'?'update':'delete');});
  el('modalForm').addEventListener('submit',()=>{ if(!cloudView) setTimeout(()=>addAudit('Tạo / cập nhật','Dữ liệu nghiệp vụ',pageTitle.textContent,'create'),50); },true);

  if(window.AlphaOnline?.isConfigured?.()){
    document.querySelector('.demo-accounts')?.classList.add('hidden');
    const note=document.querySelector('#loginForm>small');if(note)note.textContent=ENVIRONMENT==='demo'?'Chế độ trình diễn chỉ dùng dữ liệu mô phỏng; không nhập dữ liệu thật.':'Đăng nhập bằng Supabase Auth. PostgreSQL là nguồn dữ liệu duy nhất và quyền truy cập được kiểm soát bằng RLS.';
  }
  el('loginForm').onsubmit=async e=>{e.preventDefault();const btn=e.target.querySelector('button[type=submit]');btn.disabled=true;await login(el('loginEmail').value,el('loginPassword').value);btn.disabled=false;};
  document.querySelectorAll('[data-demo-login]').forEach(b=>b.onclick=async()=>{el('loginEmail').value=b.dataset.demoLogin;el('loginPassword').value='';await login(b.dataset.demoLogin,'');});
  el('logoutBtn').onclick=()=>logout();
  el('syncBtn').onclick=syncCloud;
  el('mobileQuickAdd').onclick=()=>primaryAction.click();

  // Automatic local backup once per day.
  if(ENVIRONMENT==='demo'){const todayKey=nowISO().slice(0,10);if(!meta.backups.some(x=>x.type==='Auto'&&x.createdAt.startsWith(todayKey)))createBackup(true);}
  setInterval(()=>{if(session&&meta.cloud.autoSync) syncCloud()},5*60*1000);
  for(const eventName of ['pointerdown','keydown','touchstart','scroll'])document.addEventListener(eventName,recordSessionActivity,{capture:true,passive:true});
  setInterval(async()=>{const reason=sessionExpiryReason();if(!reason||sessionExpiryRunning)return;sessionExpiryRunning=true;try{await logout({reason,reload:true});}finally{sessionExpiryRunning=false;}},60000);
  document.addEventListener('visibilitychange',()=>{setPrivacyShield(document.visibilityState==='hidden');if(document.visibilityState==='visible')recordSessionActivity();});
  window.addEventListener('pagehide',()=>setPrivacyShield(true));

  const hash=location.hash.slice(1);
  applySession();
  if(session){
    const requested=document.querySelector(`[data-view="${hash}"]`);
    if(requested && !hasPermission(requested.dataset.permission||'dashboard')) history.replaceState(null,'','#dashboard');
    if(['cloud-admin','readiness','security-center','users','audit','storage','integrations'].includes(hash)&&hasPermission(requested?.dataset.permission||'admin')) setTimeout(()=>renderCloud(hash),0);
  }
  window.addEventListener('alpha:sync-status',e=>{const st=e.detail||{};meta.cloud.status=st.status||meta.cloud.status;meta.cloud.lastSync=st.lastSync||meta.cloud.lastSync;persist();if(st.context){completeCloudSession(st.context).catch(error=>{session=null;clearCloudSessionData();applySession();if(error?.message)toast(error.message);});}else if(ENVIRONMENT!=='demo'&&['offline','error'].includes(st.status||'')){const signedOut=/đã đăng xuất|chưa đăng nhập cloud/i.test(String(st.message||''));if(signedOut){clearCloudSessionData();session=null;applySession();reloadForCleanSession();}else applySession();}if(el('syncText'))el('syncText').textContent=st.conflicts?`${st.conflicts} xung đột`:st.status==='online'?'Đã đồng bộ':st.status==='syncing'?'Đang đồng bộ':st.status==='error'?'Lỗi đồng bộ':'Ngoại tuyến';});
  window.addEventListener('alpha:force-login',event=>{clearCloudSessionData();session=null;setPrivacyShield(false);applySession();window.dispatchEvent(new CustomEvent('alpha:auth-changed'));if(event.detail?.message)toast(event.detail.message);reloadForCleanSession();});
  if('serviceWorker' in navigator && location.protocol!=='file:'){let reloading=false;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(reloading)return;reloading=true;location.reload();});navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(reg=>reg.update()).catch(()=>{});}
  if(el('syncText'))el('syncText').textContent=meta.cloud.lastSync?'Đã đồng bộ':'Cloud-ready';
})();
