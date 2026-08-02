import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const moduleUrl=pathToFileURL(path.join(root,'backend/security.mjs')).href;
function evaluate(trustProxy,hops,headers,remoteAddress){
  const code=`import {rateLimitAddress} from ${JSON.stringify(moduleUrl)}; const req={headers:${JSON.stringify(headers)},socket:{remoteAddress:${JSON.stringify(remoteAddress)}}}; process.stdout.write(rateLimitAddress(req));`;
  return execFileSync(process.execPath,['--input-type=module','-e',code],{cwd:root,env:{...process.env,TRUST_PROXY:String(trustProxy),TRUST_PROXY_HOPS:String(hops)},encoding:'utf8'});
}
assert.equal(evaluate(false,1,{'x-forwarded-for':'198.51.100.77'},'::ffff:10.0.0.5'),'10.0.0.5','Untrusted forwarding headers must be ignored');
assert.equal(evaluate(true,1,{'x-forwarded-for':'198.51.100.77'},'10.0.0.1'),'198.51.100.77','One trusted proxy must expose the direct client');
assert.equal(evaluate(true,2,{'x-forwarded-for':'198.51.100.77, 10.0.0.2'},'10.0.0.1'),'198.51.100.77','Two trusted proxy hops must expose the original client');
assert.equal(evaluate(true,1,{'x-forwarded-for':'198.51.100.77, 10.0.0.2'},'10.0.0.1'),'10.0.0.2','With one trusted hop, attacker-controlled leftmost XFF must not be trusted');
assert.equal(evaluate(true,1,{'x-real-ip':'203.0.113.8'},'10.0.0.1'),'203.0.113.8','X-Real-IP is a fallback when XFF is absent');
assert.equal(evaluate(true,1,{'x-real-ip':'not-an-ip','x-forwarded-for':'garbage, also-bad'},'::1'),'::1','Invalid forwarding headers must fall back to the socket address');
console.log('PASS proxy-aware rate-limit identity validation with explicit trusted-hop boundary');
