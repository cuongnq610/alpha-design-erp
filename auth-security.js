(() => {
  'use strict';

  const el=id=>document.getElementById(id);
  const state={mode:'',factorId:'',pendingEnrollment:false,required:false,resolve:null,reject:null,busy:false,authSubscription:null};
  const privilegedPermissions=new Set(['accounting.post','accounting.close','accounting.period.lock','users.manage','roles.manage','reports.import','backup.restore','security.manage','release.approve']);
  const runtime=()=>window.ALPHA_RUNTIME_CONFIG||{};
  const environment=()=>String(runtime().environment||'demo').toLowerCase();
  const configured=()=>Boolean(window.AlphaOnline?.isConfigured?.());
  const isCloud=()=>environment()!=='demo'&&configured();

  function client(){return window.AlphaOnline?.getClient?.()||null;}
  function availability(){
    if(environment()==='demo')return {available:false,status:'DEMO OFFLINE',reason:'Chế độ Demo lưu dữ liệu cục bộ nên không thể cung cấp MFA thật. MFA chỉ có hiệu lực khi triển khai STAGING/PRODUCTION với Supabase Auth.'};
    if(!configured())return {available:false,status:'CHƯA CẤU HÌNH',reason:'Chưa cấu hình Supabase URL và publishable key trong runtime-config.js.'};
    const instance=client();
    if(instance&&!instance.auth?.mfa)return {available:false,status:'KHÔNG TƯƠNG THÍCH',reason:'Supabase Auth client hiện tại không có API MFA. Cần dùng bản supabase-js hỗ trợ auth.mfa.'};
    return {available:true,status:'SẴN SÀNG',reason:''};
  }
  async function readyClient({requireSession=true}={}){
    const availabilityState=availability();
    if(!availabilityState.available)throw new Error(availabilityState.reason);
    let instance=client();
    if(!instance){await window.AlphaOnline?.initialize?.().catch(()=>{});instance=client();}
    if(!instance?.auth)throw new Error('Không khởi tạo được dịch vụ Supabase Auth.');
    if(!instance.auth.mfa)throw new Error('Supabase Auth client không hỗ trợ MFA.');
    if(requireSession){
      const sessionResult=await instance.auth.getSession();
      if(sessionResult?.error)throw sessionResult.error;
      if(!sessionResult?.data?.session)throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    }
    return instance;
  }
  function permissions(context){return Array.isArray(context?.permissions)?context.permissions:[];}
  function isPrivileged(context){
    const list=permissions(context);
    return list.includes('*')||list.includes('admin')||list.some(code=>privilegedPermissions.has(code));
  }
  function requiresMfa(context){
    return Boolean(isCloud()&&runtime().requireMfaForPrivilegedRoles!==false&&context?.mfa_required!==false&&isPrivileged(context)&&context?.aal!=='aal2');
  }
  function cleanCode(value){return String(value||'').replace(/\s+/g,'').replace(/\D/g,'').slice(0,6);}
  function normalizeFactors(data){
    const source=data||{};
    const candidates=Array.isArray(source.all)?source.all:[...(Array.isArray(source.totp)?source.totp:[]),...(Array.isArray(source.phone)?source.phone:[])];
    const seen=new Set();
    return candidates.filter(factor=>{if(!factor?.id||seen.has(factor.id))return false;seen.add(factor.id);return true;});
  }
  function verifiedFactors(data){return normalizeFactors(data).filter(f=>f.status==='verified'||Boolean(f.verified_at));}
  function setFeedback(message='',kind=''){
    const node=el('authSecurityFeedback');if(!node)return;
    node.textContent=message;node.dataset.kind=kind;
  }
  function setBusy(busy){
    state.busy=Boolean(busy);
    document.querySelectorAll('#authSecurityScreen button,#authSecurityScreen input').forEach(node=>{node.disabled=state.busy;});
    const logout=el('authSecurityLogout');if(logout)logout.disabled=false;
    const back=el('authSecurityBack');if(back&&!state.required)back.disabled=false;
  }
  function hideAllPanels(){
    for(const id of ['mfaSetupBlock','mfaVerificationForm','passwordRecoveryRequestForm','passwordUpdateForm','accountSecuritySummary'])el(id)?.classList.add('hidden');
  }
  function showScreen({title,message,mode,required=false}){
    state.mode=mode;state.required=Boolean(required);hideAllPanels();setFeedback('');
    const screen=el('authSecurityScreen');screen?.classList.remove('hidden');document.body.classList.add('auth-security-open');
    if(el('authSecurityTitle'))el('authSecurityTitle').textContent=title;
    if(el('authSecurityMessage'))el('authSecurityMessage').textContent=message;
    el('authSecurityBack')?.classList.toggle('hidden',state.required);
    el('authSecurityLogout')?.classList.toggle('hidden',!state.required);
  }
  function setSummary({env=environment().toUpperCase(),connection='CHƯA KẾT NỐI',aal='—',factors='0',actionText='Thiết lập MFA',actionDisabled=false}={}){
    if(el('accountSecurityEnvironment'))el('accountSecurityEnvironment').textContent=env;
    if(el('accountSecurityConnection'))el('accountSecurityConnection').textContent=connection;
    if(el('accountSecurityAal'))el('accountSecurityAal').textContent=aal;
    if(el('accountSecurityFactors'))el('accountSecurityFactors').textContent=String(factors);
    const action=el('accountSecurityAction');
    if(action){action.textContent=actionText;action.disabled=Boolean(actionDisabled);action.onclick=null;}
  }
  function resetSecurityUi(){
    el('authSecurityScreen')?.classList.add('hidden');document.body.classList.remove('auth-security-open');
    hideAllPanels();setFeedback('');state.mode='';state.factorId='';state.pendingEnrollment=false;state.busy=false;
  }
  function closeScreen(){if(state.required)return;resetSecurityUi();}
  async function securityLog(eventType,success,severity='info',details={}){
    try{const instance=client();if(instance?.rpc)await instance.rpc('log_security_event',{p_event_type:eventType,p_success:Boolean(success),p_severity:severity,p_details:details});}catch{}
  }
  async function refreshContext(){
    await window.AlphaOnline?.initialize?.();
    await window.AlphaProductionGuard?.refreshContext?.();
    return window.AlphaOnline?.getContext?.()||window.AlphaProductionGuard?.getContext?.()||null;
  }
  async function mfaStatus(){
    const instance=await readyClient();
    const [factorResult,aalResult,sessionResult]=await Promise.all([
      instance.auth.mfa.listFactors(),
      instance.auth.mfa.getAuthenticatorAssuranceLevel(),
      instance.auth.getSession()
    ]);
    if(factorResult.error)throw factorResult.error;if(aalResult.error)throw aalResult.error;if(sessionResult.error)throw sessionResult.error;
    return {factors:normalizeFactors(factorResult.data),verified:verifiedFactors(factorResult.data),aal:aalResult.data||{},session:sessionResult.data?.session||null};
  }
  function qrSource(value){
    const source=String(value||'');
    if(source.startsWith('data:image/'))return source;
    if(source.trim().startsWith('<svg'))return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;
    return '';
  }
  async function cleanupUnverifiedFactors(instance,status){
    for(const factor of (status?.factors||[]).filter(item=>item.status!=='verified'&&!item.verified_at)){
      const result=await instance.auth.mfa.unenroll({factorId:factor.id});
      if(result?.error)await securityLog('auth.mfa.stale_factor_cleanup_failed',false,'warning',{factor_id:factor.id,message:String(result.error.message||'').slice(0,160)});
    }
  }
  async function startEnrollment(required){
    const instance=await readyClient();
    const existing=await mfaStatus();
    if(existing.verified.length){await startChallenge(existing.verified[0],required);return;}
    await cleanupUnverifiedFactors(instance,existing);
    showScreen({title:'Thiết lập xác thực hai bước',message:'Quét mã QR bằng Microsoft Authenticator, Google Authenticator hoặc ứng dụng TOTP tương thích, sau đó nhập mã 6 số.',mode:'mfa-enroll',required});
    el('mfaSetupBlock')?.classList.remove('hidden');el('mfaVerificationForm')?.classList.remove('hidden');
    setBusy(true);
    try{
      const {data,error}=await instance.auth.mfa.enroll({factorType:'totp',friendlyName:`ALPHA ERP ${new Date().toISOString().slice(0,10)}`});
      if(error)throw error;
      state.factorId=data?.id||'';state.pendingEnrollment=true;
      if(!state.factorId)throw new Error('Supabase không trả về mã phương thức MFA.');
      const qr=el('mfaQrCode'),source=qrSource(data?.totp?.qr_code);
      if(qr){qr.src=source;qr.classList.toggle('hidden',!source);}
      if(el('mfaSecret'))el('mfaSecret').textContent=data?.totp?.secret||'Không nhận được khóa thiết lập';
      if(el('mfaCode')){el('mfaCode').value='';setTimeout(()=>el('mfaCode')?.focus(),50);}
    }catch(error){setFeedback(`Không thể tạo mã MFA: ${error.message}`,'error');throw error;}
    finally{setBusy(false);}
  }
  async function startChallenge(factor,required){
    if(!factor?.id)throw new Error('Không tìm thấy phương thức MFA đã xác minh.');
    state.factorId=factor.id;state.pendingEnrollment=false;
    showScreen({title:'Xác thực bảo mật AAL2',message:`Mở ứng dụng Authenticator và nhập mã đang hiển thị${factor?.friendly_name?` cho “${factor.friendly_name}”`:''}.`,mode:'mfa-challenge',required});
    el('mfaVerificationForm')?.classList.remove('hidden');
    if(el('mfaCode')){el('mfaCode').value='';setTimeout(()=>el('mfaCode')?.focus(),50);}
  }
  function settleMfa(error,context){
    const resolve=state.resolve,reject=state.reject;state.resolve=null;state.reject=null;state.required=false;
    resetSecurityUi();
    if(error)reject?.(error);else resolve?.(context);
  }
  async function verifyMfaCode(code){
    const normalized=cleanCode(code);
    if(!/^\d{6}$/.test(normalized))throw new Error('Mã xác thực phải gồm 6 chữ số.');
    if(!state.factorId)throw new Error('Không tìm thấy phương thức xác thực. Vui lòng thực hiện lại.');
    const instance=await readyClient();
    const {error}=await instance.auth.mfa.challengeAndVerify({factorId:state.factorId,code:normalized});
    if(error)throw error;
    const aal=await instance.auth.mfa.getAuthenticatorAssuranceLevel();
    if(aal.error)throw aal.error;
    const context=await refreshContext();
    if(aal.data?.currentLevel!=='aal2'||context?.aal!=='aal2')throw new Error('Phiên chưa được nâng lên AAL2. Vui lòng đăng nhập lại.');
    await securityLog(state.pendingEnrollment?'auth.mfa.enrolled':'auth.mfa.verified',true,'info',{client:'web-v4.5.54'});
    return context;
  }
  async function ensureRequiredMfa(context){
    if(!requiresMfa(context))return context;
    if(state.resolve)throw new Error('Một yêu cầu MFA khác đang được xử lý.');
    const status=await mfaStatus();
    if(status.aal?.currentLevel==='aal2')return refreshContext();
    const promise=new Promise((resolve,reject)=>{state.resolve=resolve;state.reject=reject;});
    try{status.verified.length?await startChallenge(status.verified[0],true):await startEnrollment(true);}
    catch(error){state.resolve=null;state.reject=null;state.required=false;resetSecurityUi();await window.AlphaOnline?.signOut?.().catch(()=>{});throw error;}
    return promise;
  }
  function recoveryRedirectUrl(){const url=new URL(window.location.href);url.search='';url.hash='';url.searchParams.set('auth','recovery');return url.toString();}
  async function requestPasswordReset(email){
    const normalized=String(email||'').trim().toLowerCase();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized))throw new Error('Vui lòng nhập địa chỉ email hợp lệ.');
    const instance=await readyClient({requireSession:false});
    const {error}=await instance.auth.resetPasswordForEmail(normalized,{redirectTo:recoveryRedirectUrl()});
    if(error)throw error;
    await securityLog('auth.password_reset_requested',true,'info',{email_domain:normalized.split('@')[1]||''});
    return true;
  }
  function passwordPolicy(password){
    const value=String(password||'');
    if(value.length<12)return 'Mật khẩu phải có ít nhất 12 ký tự.';
    if(!/[a-z]/.test(value)||!/[A-Z]/.test(value))return 'Mật khẩu cần có chữ thường và chữ hoa.';
    if(!/\d/.test(value))return 'Mật khẩu cần có ít nhất một chữ số.';
    if(!/[^A-Za-z0-9]/.test(value))return 'Mật khẩu cần có ít nhất một ký tự đặc biệt.';
    return '';
  }
  async function updatePassword(password,confirmation){
    const policyError=passwordPolicy(password);if(policyError)throw new Error(policyError);
    if(password!==confirmation)throw new Error('Hai lần nhập mật khẩu chưa trùng khớp.');
    const instance=await readyClient();
    const {error}=await instance.auth.updateUser({password});if(error)throw error;
    await securityLog('auth.password_updated',true,'info',{client:'web-v4.5.54'});
    const signOutResult=await instance.auth.signOut({scope:'global'});if(signOutResult?.error)await instance.auth.signOut();
    history.replaceState(null,'',location.pathname);
    window.dispatchEvent(new CustomEvent('alpha:force-login',{detail:{message:'Mật khẩu đã được cập nhật. Vui lòng đăng nhập lại.'}}));
  }
  function showUnavailable(mode,title,message){
    const info=availability();
    showScreen({title,message,mode,required:false});
    el('accountSecuritySummary')?.classList.remove('hidden');
    setSummary({env:environment().toUpperCase(),connection:info.status,aal:'—',factors:'0',actionText:'Cần Supabase Auth',actionDisabled:true});
    setFeedback(info.reason,'info');
  }
  function openPasswordResetRequest(prefill=''){
    if(!availability().available){showUnavailable('password-unavailable','Khôi phục mật khẩu chưa khả dụng','Tính năng này cần Supabase Auth và dịch vụ email được cấu hình.');return;}
    showScreen({title:'Khôi phục mật khẩu',message:'Nhập email tài khoản. Hệ thống sẽ gửi đường dẫn đặt lại mật khẩu nếu tài khoản hợp lệ.',mode:'password-request',required:false});
    el('passwordRecoveryRequestForm')?.classList.remove('hidden');
    if(el('recoveryEmail')){el('recoveryEmail').value=String(prefill||'').trim();setTimeout(()=>el('recoveryEmail')?.focus(),50);}
  }
  function openPasswordUpdate(){
    showScreen({title:'Đặt mật khẩu mới',message:'Mật khẩu mới cần tối thiểu 12 ký tự, gồm chữ hoa, chữ thường, chữ số và ký tự đặc biệt.',mode:'password-update',required:true});
    el('authSecurityLogout')?.classList.add('hidden');el('passwordUpdateForm')?.classList.remove('hidden');
    if(el('newPassword')){el('newPassword').value='';el('confirmPassword').value='';setTimeout(()=>el('newPassword')?.focus(),50);}
  }
  async function processRecoveryCallback(){
    if(!isCloud())return false;
    const instance=await readyClient({requireSession:false});
    const query=new URLSearchParams(location.search),hash=new URLSearchParams(location.hash.replace(/^#/,''));
    const urlError=query.get('error_description')||query.get('error')||hash.get('error_description')||hash.get('error');if(urlError)throw new Error(String(urlError));
    const code=query.get('code'),accessToken=hash.get('access_token'),refreshToken=hash.get('refresh_token');
    const tokenHash=query.get('token_hash')||hash.get('token_hash'),recoveryType=query.get('type')||hash.get('type');
    let recovered=false;
    if(code){const {error}=await instance.auth.exchangeCodeForSession(code);if(error)throw error;recovered=true;}
    else if(tokenHash&&recoveryType==='recovery'){const {error}=await instance.auth.verifyOtp({token_hash:tokenHash,type:'recovery'});if(error)throw error;recovered=true;}
    else if(accessToken&&refreshToken){const {error}=await instance.auth.setSession({access_token:accessToken,refresh_token:refreshToken});if(error)throw error;recovered=true;}
    const recoveryRequested=recovered||query.get('auth')==='recovery'||hash.get('type')==='recovery';
    if(recoveryRequested){
      if(recovered){history.replaceState(null,'',location.pathname);openPasswordUpdate();return true;}
      const session=await instance.auth.getSession();if(session.error)throw session.error;
      if(session.data?.session){history.replaceState(null,'',location.pathname);openPasswordUpdate();return true;}
      throw new Error('Đường dẫn khôi phục không hợp lệ hoặc đã hết hạn.');
    }
    return false;
  }
  async function openAccountSecurity(){
    const info=availability();
    if(!info.available){showUnavailable('account-security-unavailable','Bảo mật tài khoản & MFA','Trạng thái bảo vệ tài khoản trong môi trường hiện tại.');return;}
    showScreen({title:'Bảo mật tài khoản & MFA',message:'Kiểm tra cấp xác thực, kết nối Supabase Auth và phương thức MFA của phiên đăng nhập hiện tại.',mode:'account-security',required:false});
    el('accountSecuritySummary')?.classList.remove('hidden');
    setSummary({env:environment().toUpperCase(),connection:'ĐANG KIỂM TRA',aal:'…',factors:'…',actionText:'Đang tải',actionDisabled:true});
    setBusy(true);
    try{
      const status=await mfaStatus();
      const currentLevel=status.aal?.currentLevel||'aal1';
      setSummary({env:environment().toUpperCase(),connection:status.session?'ĐÃ ĐĂNG NHẬP':'HẾT PHIÊN',aal:currentLevel.toUpperCase(),factors:status.verified.length,actionText:status.verified.length?(currentLevel==='aal2'?'Xác thực lại MFA':'Nâng phiên lên AAL2'):'Thiết lập MFA',actionDisabled:false});
      const action=el('accountSecurityAction');
      if(action)action.onclick=async()=>{try{status.verified.length?await startChallenge(status.verified[0],false):await startEnrollment(false);}catch(error){setFeedback(error.message,'error');}};
      setFeedback(status.verified.length?(currentLevel==='aal2'?'MFA đang hoạt động và phiên hiện tại đã đạt AAL2.':'MFA đã được thiết lập nhưng phiên hiện tại mới ở AAL1. Hãy xác thực lại để nâng lên AAL2.'):'Tài khoản chưa có phương thức MFA đã xác minh.','info');
    }catch(error){setSummary({env:environment().toUpperCase(),connection:'LỖI KẾT NỐI',aal:'—',factors:'0',actionText:'Thử lại',actionDisabled:false});const action=el('accountSecurityAction');if(action)action.onclick=()=>openAccountSecurity();setFeedback(`Không đọc được trạng thái bảo mật: ${error.message}`,'error');}
    finally{setBusy(false);}
  }
  async function cancelRequiredMfa(){
    try{const instance=client();if(state.pendingEnrollment&&state.factorId&&instance)await instance.auth.mfa.unenroll({factorId:state.factorId}).catch(()=>{});await window.AlphaOnline?.signOut?.();}
    finally{settleMfa(new Error('Phiên đăng nhập đã được hủy vì chưa hoàn tất MFA.'));window.dispatchEvent(new CustomEvent('alpha:force-login',{detail:{message:'Cần hoàn tất MFA để sử dụng tài khoản đặc quyền.'}}));}
  }
  function bindUi(){
    el('forgotPasswordBtn')?.addEventListener('click',()=>openPasswordResetRequest(el('loginEmail')?.value||''));
    el('accountSecurityBtn')?.addEventListener('click',()=>openAccountSecurity());
    el('authSecurityBack')?.addEventListener('click',closeScreen);
    el('authSecurityLogout')?.addEventListener('click',()=>cancelRequiredMfa());
    el('passwordRecoveryRequestForm')?.addEventListener('submit',async event=>{event.preventDefault();setBusy(true);setFeedback('Đang gửi email khôi phục…','info');try{await requestPasswordReset(el('recoveryEmail')?.value);setFeedback('Nếu email tồn tại, đường dẫn đặt lại mật khẩu đã được gửi. Vui lòng kiểm tra cả thư mục Spam.','success');}catch(error){setFeedback(`Không thể gửi yêu cầu: ${error.message}`,'error');}finally{setBusy(false);}});
    el('passwordUpdateForm')?.addEventListener('submit',async event=>{event.preventDefault();setBusy(true);setFeedback('Đang cập nhật mật khẩu…','info');try{await updatePassword(el('newPassword')?.value||'',el('confirmPassword')?.value||'');setFeedback('Mật khẩu đã được cập nhật.','success');}catch(error){setFeedback(`Không thể cập nhật mật khẩu: ${error.message}`,'error');}finally{setBusy(false);}});
    el('mfaVerificationForm')?.addEventListener('submit',async event=>{event.preventDefault();setBusy(true);setFeedback('Đang xác minh mã bảo mật…','info');try{const context=await verifyMfaCode(el('mfaCode')?.value||'');setFeedback('Xác thực MFA thành công.','success');setTimeout(()=>settleMfa(null,context),250);}catch(error){await securityLog('auth.mfa.failed',false,'warning',{message:String(error.message||'').slice(0,180)});setFeedback(`Mã xác thực không hợp lệ: ${error.message}`,'error');el('mfaCode')?.select();}finally{setBusy(false);}});
    el('mfaCode')?.addEventListener('input',event=>{event.target.value=cleanCode(event.target.value);});
  }
  async function initialize(){
    bindUi();
    if(!isCloud())return;
    try{
      const instance=await readyClient({requireSession:false});
      if(!state.authSubscription){const {data}=instance.auth.onAuthStateChange(event=>{if(event==='PASSWORD_RECOVERY')openPasswordUpdate();});state.authSubscription=data?.subscription||null;}
      await processRecoveryCallback();
    }catch(error){if(new URLSearchParams(location.search).has('code')||location.hash.includes('type=recovery')){showScreen({title:'Không thể khôi phục mật khẩu',message:'Đường dẫn khôi phục không hợp lệ hoặc đã hết hạn.',mode:'recovery-error',required:false});setFeedback(error.message,'error');}}
  }

  window.AlphaAuthSecurity={initialize,availability,requiresMfa,isPrivileged,ensureRequiredMfa,mfaStatus,openPasswordResetRequest,openAccountSecurity,processRecoveryCallback,passwordPolicy};
  initialize();
})();
