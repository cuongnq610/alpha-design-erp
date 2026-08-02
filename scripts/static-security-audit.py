#!/usr/bin/env python3
from pathlib import Path
import re,json,hashlib
from qa_release_context import RELEASE_VERSION, RELEASE_FILE_TOKEN, evidence_dir
ROOT=Path(__file__).resolve().parents[1]
OUT=evidence_dir('browser')
schema=(ROOT/'SUPABASE_PRODUCTION_SCHEMA.sql').read_text(encoding='utf-8')
migration33=(ROOT/'supabase/migrations/033_entity_payload_integrity_v453.sql').read_text(encoding='utf-8')
backend=(ROOT/'backend/security.mjs').read_text(encoding='utf-8')
runtime=(ROOT/'runtime-config.js').read_text(encoding='utf-8')
public_runtime=(ROOT/'public/runtime-config.js').read_text(encoding='utf-8')
sw=(ROOT/'sw.js').read_text(encoding='utf-8')
# SQL extraction is a release-contract check, not a replacement for executing migrations on a real project.
tables=sorted(set(re.findall(r'create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-zA-Z0-9_]+)',schema,re.I)))
direct_rls=set(re.findall(r'alter\s+table\s+(?:if\s+exists\s+)?(?:public\.)?([a-zA-Z0-9_]+)\s+enable\s+row\s+level\s+security',schema,re.I))
dynamic_rls=set()
for block in re.findall(r'do\s+\$\$[\s\S]*?end\s+\$\$;',schema,re.I):
    if re.search(r'enable\s+row\s+level\s+security',block,re.I):
        dynamic_rls.update(name for name in re.findall(r"'([a-zA-Z0-9_]+)'",block) if name in tables)
rls=sorted(direct_rls|dynamic_rls)
rls_exempt={'schema_versions'}
missing_rls=sorted(set(tables)-set(rls)-rls_exempt)
functions=re.findall(r'create\s+or\s+replace\s+function\s+[\s\S]*?\$\$\s*;',schema,re.I)
security_definer=[f for f in functions if re.search(r'\bsecurity\s+definer\b',f,re.I)]
missing_search=[re.search(r'function\s+([^\s(]+)',f,re.I).group(1) for f in security_definer if not re.search(r'\bset\s+search_path\s*=',f,re.I)]
public_files=[]
for p in (ROOT/'public').rglob('*'):
    if p.is_file(): public_files.append(p)
secret_patterns={
 'supabase_secret':re.compile(r'sb_secret_[A-Za-z0-9_-]{8,}'),
 'legacy_service_role_jwt':re.compile(r'eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}'),
 'private_key':re.compile(r'BEGIN (?:RSA |OPENSSH )?PRIVATE KEY')
}
secret_hits=[]
for p in public_files:
    try:text=p.read_text(encoding='utf-8')
    except Exception:continue
    for name,pat in secret_patterns.items():
        if pat.search(text):secret_hits.append({'file':str(p.relative_to(ROOT)),'pattern':name})
checks={
 'allBusinessTablesHaveRls':not missing_rls,
 'allSecurityDefinerFunctionsSetSearchPath':not missing_search,
 'noServerSecretPatternInPublicFiles':not secret_hits,
 'exactCorsAllowlist':"runtime.allowedOrigins.includes(origin)" in backend and "access-control-allow-origin':origin" in backend,
 'securityHeadersPresent':all(x in backend for x in ['strict-transport-security','content-security-policy','x-frame-options','x-content-type-options','permissions-policy']),
 'newSecretKeyNotSentAsBearer':"!String(selectedKey).startsWith('sb_')" in backend,
 'proxyHeadersValidatedAsIp':all(x in backend for x in ['isIP','trustProxyHops','chain.length-1-runtime.trustProxyHops']),
 'apiNeverCachedByServiceWorker':"url.pathname.startsWith('/api/')" in sw and "cache:'no-store'" in sw,
 'businessRecordsNotPersistedByServiceWorker':all(x not in sw for x in ['entity_records','indexedDB','localStorage']),
 'offlineProductionFailSafe':"allowOfflineWritesInProduction:false" in sw and 'supabaseUrl:""' in sw and 'LOCKED_RUNTIME_CONFIG' in sw,
    'runtimeConfigNeverPersisted':('runtime-config.js' not in sw.split('const SHELL=',1)[1].split('];',1)[0] and 'url.pathname===RUNTIME_CONFIG_PATH' in sw and not re.search(r'caches\.(?:match|open)',sw.split('if(url.pathname===RUNTIME_CONFIG_PATH){',1)[1].split('if(!SHELL_PATHS.has(url.pathname))',1)[0])),
    'serviceWorkerCacheCleanupIsScoped':"key.startsWith(CACHE_PREFIX)&&key!==CACHE" in sw,
    'serviceWorkerShellMatchingIsExact':'SHELL_PATHS.has(url.pathname)' in sw,
 'privateStorageBucketDeclared':"values('company-files','company-files',false" in schema.replace(' ','').replace('\n','') or "('company-files','company-files',false" in schema.replace(' ','').replace('\n',''),
 'mfaPrivilegeIncludesReleaseApproval':"'release.approve'" in schema and 'app.permission_is_privileged(rp.permission_code)' in schema,
 'entityTriggerPreservesOperationalKillSwitch':'perform app.assert_operational_write_allowed(new.company_id)' in migration33,
 'entityValidationHelpersArePrivate':all(f'revoke all on function app.{fn}(' in migration33 for fn in ['entity_ref_exists','entity_account_code_exists','validate_entity_payload','entity_record_guard']) and not re.search(r'grant\s+execute[^;]+entity_ref_exists[^;]+authenticated',migration33,re.I|re.S),
 'allSynchronizedNamespacesValidated':all(name in migration33 for name in ['notificationReads','projects','journalEntries','contracts','taxInvoices','paymentAllocations','projectBudgetLines','purchaseOrders','fixedAssets','depreciationSchedules','financialAnalysisSnapshots','importLogs']),
 'entityDependencySafeDeletion':'DEPENDENCY_EXISTS' in migration33 and 'assert_entity_delete_safe' in migration33,
 'notificationReadsArrayCompatible':"collection='notificationReads' and jsonb_typeof(data)='array'" in migration33 and 'notificationReads payload must be a JSON array' in migration33,
 'authoritativeWritesRpcOnly':'revoke insert,update,delete on public.entity_records from authenticated' in migration33 and 'grant execute on function public.apply_entity_change' in migration33,
 'entityIdentityImmutable':'IMMUTABLE_ENTITY_IDENTITY' in migration33,
 'storageUploadCeilingAndRiskyTypes': '100*1024*1024' in (ROOT/'cloud-v2.js').read_text(encoding='utf-8') and 'BLOCKED_UPLOAD_EXTENSIONS' in (ROOT/'cloud-v2.js').read_text(encoding='utf-8') and 'BLOCKED_UPLOAD_MIME_TYPES' in (ROOT/'cloud-v2.js').read_text(encoding='utf-8'),
}
result={
 'releaseVersion':RELEASE_VERSION,'schemaSha256':hashlib.sha256(schema.encode()).hexdigest(),
 'counts':{'publicTables':len(tables),'rlsEnabledTables':len(rls),'policies':len(re.findall(r'create\s+policy\s+',schema,re.I)),'securityDefinerFunctions':len(security_definer)},
 'missingRls':missing_rls,'securityDefinerMissingSearchPath':missing_search,'publicSecretHits':secret_hits,
 'checks':checks,'passed':all(checks.values())
}
(OUT/f'STATIC_SECURITY_AUDIT_{RELEASE_FILE_TOKEN}.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(result,ensure_ascii=False))
raise SystemExit(0 if result['passed'] else 1)
