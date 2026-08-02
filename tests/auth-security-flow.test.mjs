import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=fs.readFileSync(path.join(root,'auth-security.js'),'utf8');

class Classes{
  constructor(initial=[]){this.items=new Set(initial);}
  add(...names){names.forEach(name=>this.items.add(name));}
  remove(...names){names.forEach(name=>this.items.delete(name));}
  contains(name){return this.items.has(name);}
  toggle(name,force){if(force===undefined)force=!this.items.has(name);force?this.items.add(name):this.items.delete(name);return force;}
}
class Element{
  constructor(id,{hidden=false}={}){this.id=id;this.classList=new Classes(hidden?['hidden']:[]);this.dataset={};this.listeners={};this.value='';this.textContent='';this.src='';this.disabled=false;this.onclick=null;}
  addEventListener(type,handler){(this.listeners[type]??=[]).push(handler);}
  async fire(type,extra={}){for(const handler of this.listeners[type]||[])await handler({target:this,preventDefault(){},stopImmediatePropagation(){},...extra});}
  focus(){}
  select(){this.selected=true;}
}
const hiddenIds=new Set(['authSecurityScreen','mfaSetupBlock','mfaVerificationForm','passwordRecoveryRequestForm','passwordUpdateForm','accountSecuritySummary','mfaQrCode','authSecurityBack','authSecurityLogout']);
const ids=['authSecurityScreen','authSecurityTitle','authSecurityMessage','authSecurityFeedback','authSecurityBack','authSecurityLogout','mfaSetupBlock','mfaVerificationForm','mfaQrCode','mfaSecret','mfaCode','passwordRecoveryRequestForm','recoveryEmail','passwordUpdateForm','newPassword','confirmPassword','accountSecuritySummary','accountSecurityEnvironment','accountSecurityConnection','accountSecurityAal','accountSecurityFactors','accountSecurityAction','forgotPasswordBtn','accountSecurityBtn'];
const elements=Object.fromEntries(ids.map(id=>[id,new Element(id,{hidden:hiddenIds.has(id)})]));
const controls=ids.filter(id=>/Btn|Action|Back|Logout|Form|Code|Email|Password/.test(id)).map(id=>elements[id]);
const body={classList:new Classes()};
const document={body,getElementById:id=>elements[id]||null,querySelectorAll:()=>controls};

let context={user_id:'user-1',company_id:'company-1',permissions:['*'],mfa_required:true,aal:'aal1'};
let currentLevel='aal1';
let resetCalls=0,updateCalls=0,globalSignOutCalls=0,enrollCalls=0,verifyCalls=0;
let authStateCallback=null;
let factors=[];
const client={
  rpc:async()=>({data:true,error:null}),
  auth:{
    mfa:{
      listFactors:async()=>({data:{all:[...factors],totp:[...factors]},error:null}),
      getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel,nextLevel:currentLevel==='aal2'?'aal2':'aal2'},error:null}),
      enroll:async()=>{enrollCalls++;factors=[{id:'factor-1',status:'unverified',friendly_name:'ALPHA ERP Test'}];return {data:{id:'factor-1',totp:{qr_code:'<svg xmlns="http://www.w3.org/2000/svg"></svg>',secret:'ABCDEF123456'}},error:null};},
      challengeAndVerify:async({factorId,code})=>{assert.equal(factorId,'factor-1');assert.equal(code,'123456');verifyCalls++;currentLevel='aal2';factors=[{id:'factor-1',status:'verified',verified_at:'2026-07-27T00:00:00Z',friendly_name:'ALPHA ERP Test'}];context={...context,aal:'aal2'};return {data:{},error:null};},
      unenroll:async({factorId})=>{factors=factors.filter(f=>f.id!==factorId);return {data:{},error:null}}
    },
    resetPasswordForEmail:async(email,{redirectTo})=>{assert.equal(email,'director@alphadesign.vn');assert.match(redirectTo,/auth=recovery/);resetCalls++;return {data:{},error:null};},
    exchangeCodeForSession:async()=>({data:{},error:null}),
    setSession:async()=>({data:{},error:null}),
    verifyOtp:async()=>({data:{},error:null}),
    getSession:async()=>({data:{session:{}},error:null}),
    updateUser:async({password})=>{assert.equal(password,'StrongPassword#123');updateCalls++;return {data:{},error:null};},
    signOut:async(options)=>{if(options?.scope==='global')globalSignOutCalls++;return {error:null};},
    onAuthStateChange:callback=>{authStateCallback=callback;return {data:{subscription:{unsubscribe(){}}}};}
  }
};
const dispatched=[];
const location={href:'https://staging-erp.alphadesign.vn/',pathname:'/',search:'',hash:''};
const history={replaceState(_a,_b,url){location.href=`https://staging-erp.alphadesign.vn${url}`;location.search='';location.hash='';}};
const window={
  ALPHA_RUNTIME_CONFIG:{environment:'staging',requireMfaForPrivilegedRoles:true},
  AlphaOnline:{isConfigured:()=>true,getClient:()=>client,initialize:async()=>true,getContext:()=>context,signOut:async()=>({})},
  AlphaProductionGuard:{refreshContext:async()=>context,getContext:()=>context},
  location,history,
  addEventListener(){},dispatchEvent:event=>{dispatched.push(event);return true;}
};
class CustomEvent{constructor(type,options={}){this.type=type;this.detail=options.detail;}}
const sandbox={window,document,location,history,CustomEvent,URL,URLSearchParams,console,setTimeout,clearTimeout};
vm.createContext(sandbox);
vm.runInContext(source,sandbox,{filename:'auth-security.js'});
await new Promise(resolve=>setTimeout(resolve,10));

assert.equal(typeof window.AlphaAuthSecurity.ensureRequiredMfa,'function');
const mfaPromise=window.AlphaAuthSecurity.ensureRequiredMfa(context);
await new Promise(resolve=>setTimeout(resolve,10));
assert.equal(enrollCalls,1);
assert.equal(elements.authSecurityScreen.classList.contains('hidden'),false);
assert.equal(elements.mfaVerificationForm.classList.contains('hidden'),false);
assert.match(elements.mfaQrCode.src,/^data:image\/svg\+xml/);
elements.mfaCode.value='123456';
await elements.mfaVerificationForm.fire('submit');
const secured=await mfaPromise;
assert.equal(secured.aal,'aal2');
assert.equal(verifyCalls,1);
assert.equal(elements.authSecurityScreen.classList.contains('hidden'),true);

await elements.accountSecurityBtn.fire('click');
await new Promise(resolve=>setTimeout(resolve,10));
assert.equal(elements.authSecurityScreen.classList.contains('hidden'),false);
assert.equal(elements.accountSecurityEnvironment.textContent,'STAGING');
assert.equal(elements.accountSecurityConnection.textContent,'ĐÃ ĐĂNG NHẬP');
assert.equal(elements.accountSecurityAal.textContent,'AAL2');
assert.equal(elements.accountSecurityFactors.textContent,'1');
assert.match(elements.authSecurityFeedback.textContent,/MFA đang hoạt động/i);
await elements.authSecurityBack.fire('click');
assert.equal(elements.authSecurityScreen.classList.contains('hidden'),true);

await elements.forgotPasswordBtn.fire('click');
elements.recoveryEmail.value='director@alphadesign.vn';
await elements.passwordRecoveryRequestForm.fire('submit');
assert.equal(resetCalls,1);
assert.match(elements.authSecurityFeedback.textContent,/đã được gửi/i);

assert.equal(typeof authStateCallback,'function');
authStateCallback('PASSWORD_RECOVERY',{});
elements.newPassword.value='StrongPassword#123';
elements.confirmPassword.value='StrongPassword#123';
await elements.passwordUpdateForm.fire('submit');
assert.equal(updateCalls,1);
assert.equal(globalSignOutCalls,1);
assert.ok(dispatched.some(event=>event.type==='alpha:force-login'));
assert.equal(window.AlphaAuthSecurity.passwordPolicy('weak'),'Mật khẩu phải có ít nhất 12 ký tự.');
assert.equal(window.AlphaAuthSecurity.passwordPolicy('StrongPassword#123'),'');

console.log('PASS v4.5.18 mocked end-to-end MFA enrollment/verification, active-session validation and password recovery flow');
