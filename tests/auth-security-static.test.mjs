import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const index=read('index.html');
const auth=read('auth-security.js');
const cloud=read('cloud-v2.js');
const guard=read('production-guard.js');
const backend=read('backend/security.mjs');
const edge=read('supabase/functions/invite-user/index.ts');
const sw=read('sw.js');
const version=JSON.parse(read('VERSION.json')).version;

for(const id of [
  'forgotPasswordBtn','authSecurityScreen','mfaVerificationForm','mfaCode',
  'passwordRecoveryRequestForm','recoveryEmail','passwordUpdateForm',
  'newPassword','confirmPassword','accountSecurityBtn','accountSecurityEnvironment','accountSecurityConnection','accountSecurityAal','accountSecurityFactors','accountSecurityAction'
]) assert.match(index,new RegExp(`id="${id}"`),`Missing auth UI: ${id}`);
assert.ok(index.indexOf('alpha-sync.bundle.js')<index.indexOf('auth-security.js'),'Supabase client must load before auth security');
assert.ok(index.indexOf('auth-security.js')<index.indexOf('cloud-v2.js'),'Auth security must load before cloud session handling');

for(const api of [
  'auth.mfa.listFactors','auth.mfa.getAuthenticatorAssuranceLevel','auth.mfa.enroll',
  'auth.mfa.challengeAndVerify','auth.resetPasswordForEmail','auth.exchangeCodeForSession',
  'auth.setSession','auth.verifyOtp','auth.updateUser({password'
]) assert.ok(auth.includes(api),`Missing Supabase auth flow: ${api}`);
assert.ok(auth.includes("value.length<12"),'Password policy must enforce at least 12 characters');
assert.ok(auth.includes("/^\\d{6}$/"),'TOTP verification must require a six-digit code');
assert.ok(auth.includes("auth.signOut({scope:'global'})"),'Password reset must invalidate other sessions');
assert.ok(auth.includes("event==='PASSWORD_RECOVERY'"),'Recovery auth event must open the password update screen');

const mfaCall=cloud.indexOf('ensureRequiredMfa');
const appSession=cloud.indexOf('session={userId:secured.user_id');
assert.ok(mfaCall>=0&&appSession>mfaCall,'Privileged cloud session must be created only after MFA policy is satisfied');
for(const form of ['mfaVerificationForm','passwordRecoveryRequestForm','passwordUpdateForm'])assert.ok(guard.includes(form),`${form} must remain usable while production writes are locked`);

assert.ok(backend.includes('process.env.SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_ANON_KEY'),'Backend must prefer the new publishable key');
assert.ok(backend.includes('process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY'),'Backend must support new secret key with legacy fallback');
assert.ok(backend.includes("!String(selectedKey).startsWith('sb_')"),'New sb_ keys must not be sent as JWT bearer credentials');
assert.ok(edge.includes("keyFromJsonEnv('SUPABASE_SECRET_KEYS')"),'Edge Function must support hosted secret-key JSON variables');
assert.match(sw,new RegExp(`v${version.replaceAll('.','-')}-[a-z0-9-]+`),'PWA cache namespace must include the exact current release');
assert.ok(sw.includes("'./auth-security.js'"),'PWA shell must cache the auth security module');
assert.ok(sw.includes('allowDemoLogin:false'),'Offline runtime fallback must remain production-locked instead of silently enabling Demo mode');
const runtimeBranch=sw.split('if(url.pathname===RUNTIME_CONFIG_PATH){')[1]?.split('if(!SHELL_PATHS.has(url.pathname))')[0]||'';
assert.ok(runtimeBranch.includes("cache:'no-store'")&&runtimeBranch.includes('LOCKED_RUNTIME_CONFIG'),'Runtime configuration must use network-only fail-closed behavior');
assert.equal(/caches\.(?:match|open)/.test(runtimeBranch),false,'Runtime configuration must never use Cache Storage');

assert.ok(auth.includes("showUnavailable('account-security-unavailable'"),'Demo/offline account security action must open a visible status screen');
assert.ok(auth.includes("instance.auth.getSession()"),'MFA actions must validate an active Supabase session');
assert.ok(auth.includes('cleanupUnverifiedFactors'),'MFA enrollment must clean stale unverified factors before reenrollment');
console.log('PASS v4.5.18 MFA availability, AAL2, password recovery, Supabase session and PWA security integration checks');
