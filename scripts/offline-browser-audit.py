#!/usr/bin/env python3
from pathlib import Path
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
import json, base64, mimetypes
from qa_release_context import RELEASE_VERSION, RELEASE_FILE_TOKEN, evidence_dir, launch_chromium

ROOT=Path(__file__).resolve().parents[1]
OUT=evidence_dir('browser')
CONTEXT={
 'user_id':'22222222-2222-4222-8222-222222222222','email':'audit@alpha.local','full_name':'Offline Audit User',
 'company_id':'11111111-1111-4111-8111-111111111111','company_code':'ALPHA','company_name':'ALPHA DESIGN',
 'role_name':'Project Manager','permissions':['dashboard.read','projects.read','projects.write','documents.read','documents.write'],
 'aal':'aal1','mfa_required':False,'operational_mode':'pilot','production_writes_enabled':False
}
DB={
 'people':[{'id':'p-offline','code':'P-OFF','name':'Offline Manager','status':'Active'}],'clients':[{'id':'c-offline','code':'C-OFF','name':'Offline Client'}],'projects':[{'id':'prj-offline-audit','code':'OFF-001','name':'Dự án kiểm thử ngoại tuyến','clientId':'c-offline','pmId':'p-offline','status':'In Progress','startDate':'2026-07-01','endDate':'2026-12-31','contractValue':100000000,'budget':70000000,'progress':25}],
 'tasks':[],'timesheets':[],'finance':[],'quotes':[],'approvals':[],'documents':[],'vendors':[],'accounts':[],'journalEntries':[],'taxInvoices':[],'pitWithholdings':[],'citAdjustments':[],'taxFilings':[],
 'contracts':[],'billingMilestones':[],'paymentAllocations':[],'projectBudgetVersions':[],'projectBudgetLines':[],'resourcePlans':[],'commitments':[],'projectStages':[],'purchaseRequests':[],'purchaseOrders':[],'tools':[],'fixedAssets':[],'toolAllocationSchedules':[],'depreciationSchedules':[],'financialForecastScenarios':[],'financialAnalysisSnapshots':[],'financialLinkAuditRuns':[],'notificationReads':[],'openingBalances':[],'accountingPeriods':[],'exportLogs':[],'importLogs':[],
 'settings':{'companyName':'ALPHA DESIGN','currency':'VND','fiscalYear':2026}
}

PRELUDE='''<script>
(()=>{
 class MemoryStorage{constructor(){this.m=new Map()}get length(){return this.m.size}key(i){return [...this.m.keys()][i]??null}getItem(k){return this.m.has(String(k))?this.m.get(String(k)):null}setItem(k,v){this.m.set(String(k),String(v))}removeItem(k){this.m.delete(String(k))}clear(){this.m.clear()}}
 Object.defineProperty(window,'localStorage',{value:new MemoryStorage(),configurable:true});Object.defineProperty(window,'sessionStorage',{value:new MemoryStorage(),configurable:true});
 window.ALPHA_RUNTIME_CONFIG={environment:'production',dataMode:'server-authoritative',apiBaseUrl:'',apiAuthRequired:true,allowDemoLogin:false,allowLocalBusinessData:false,allowOfflineWritesInProduction:false,requireMfaForPrivilegedRoles:true,supabaseUrl:'https://audit.supabase.co',supabaseAnonKey:'eyJaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'};
 window.__AUDIT_CONTEXT=null;
 window.AlphaOnline={isConfigured:()=>true,getClient:()=>({auth:{getSession:async()=>({data:{session:{access_token:'offline-audit-token'}}}),signOut:async()=>({})}}),getContext:()=>window.__AUDIT_CONTEXT,status:()=>({status:navigator.onLine?'online':'offline'}),signOut:async()=>{}};
 const NativeResponse=window.Response;
 window.fetch=async(url)=>{if(!navigator.onLine)throw new TypeError('offline');if(String(url).includes('/api/session'))return new NativeResponse(JSON.stringify({ok:true,context:window.__AUDIT_CONTEXT,user:{id:window.__AUDIT_CONTEXT?.user_id||''}}),{status:200,headers:{'content-type':'application/json'}});return new NativeResponse('{}',{status:200,headers:{'content-type':'application/json'}})};
 window.confirm=()=>true; window.alert=()=>{};
})();
</script>'''

INCLUDE=['theme-bootstrap.js','calculation-core.js','reporting-period.js','statutory-template-manager.js','statutory-template-reference.js','tax-compliance-package-manager.js','tax-compliance-reference.js','tax-calendar.js','accounting-operations.js','payroll-detail.js','annual-benefits.js','permission-map.js','production-guard.js','export-center.js','theme-manager.js','app.js','auth-security.js','cloud-v2.js','alpha-enterprise.js']
def inline_app():
    soup=BeautifulSoup((ROOT/'index.html').read_text(encoding='utf-8'),'html.parser')
    for script in list(soup.find_all('script')): script.decompose()
    soup.head.insert(0,BeautifulSoup(PRELUDE,'html.parser'))
    for link in list(soup.find_all('link')):
        rel=link.get('rel') or []; href=link.get('href','')
        if 'stylesheet' in rel and (ROOT/href).exists():
            st=soup.new_tag('style'); st.string=(ROOT/href).read_text(encoding='utf-8'); link.replace_with(st)
        elif 'manifest' in rel or 'icon' in rel: link.decompose()
    for img in soup.find_all('img'):
        p=ROOT/img.get('src','')
        if p.is_file():
            mime=mimetypes.guess_type(str(p))[0] or 'application/octet-stream'; img['src']=f'data:{mime};base64,'+base64.b64encode(p.read_bytes()).decode()
    for name in INCLUDE:
        node=soup.new_tag('script'); node.string=(ROOT/name).read_text(encoding='utf-8').replace('</script>','<\\/script>'); soup.body.append(node)
    return str(soup)

content=inline_app(); results={'releaseVersion':RELEASE_VERSION,'method':'Deterministic Chromium state simulation plus static Service Worker contract audit','checks':{},'pageErrors':[],'passed':False}
sw=(ROOT/'sw.js').read_text(encoding='utf-8')
results['checks']['serviceWorkerCachesApplicationShell']=all(x in sw for x in ["'./index.html'","'./app.js'","'./production-guard.js'","'./alpha-sync.bundle.js'"])
results['checks']['serviceWorkerNeverCachesApi']=("url.pathname.startsWith('/api/')" in sw and "fetch(event.request,{cache:'no-store'})" in sw)
results['checks']['runtimeConfigUsesNetworkOnlyFailSafe']=('RUNTIME_CONFIG_PATH' in sw and 'LOCKED_RUNTIME_CONFIG' in sw and "allowOfflineWritesInProduction:false" in sw and 'supabaseUrl:""' in sw)
results['checks']['runtimeConfigIsNotPrecached']=('runtime-config.js' not in sw.split('const SHELL=',1)[1].split('];',1)[0])
results['checks']['cacheCleanupIsApplicationScoped']=("key.startsWith(CACHE_PREFIX)&&key!==CACHE" in sw)
results['checks']['serviceWorkerDoesNotCacheBusinessRecords']=('entity_records' not in sw and 'localStorage' not in sw and 'indexedDB' not in sw)

with sync_playwright() as p:
    browser=launch_chromium(p, ['--disable-web-security'])
    ctx=browser.new_context(viewport={'width':1365,'height':900})
    page=ctx.new_page(); page.on('pageerror',lambda e:results['pageErrors'].append(str(e)))
    page.set_content(content,wait_until='domcontentloaded',timeout=60000)
    page.wait_for_function("() => Boolean(window.AlphaERP && window.AlphaProductionGuard)",timeout=10000)
    page.evaluate('(args)=>{window.__AUDIT_CONTEXT=args.ctx;window.AlphaERP.applyRemote(args.db);window.dispatchEvent(new CustomEvent("alpha:sync-status",{detail:{status:"online",message:"online",context:args.ctx}}));}',{'ctx':CONTEXT,'db':DB})
    page.evaluate('window.AlphaProductionGuard.refreshContext()'); page.wait_for_function("document.body.classList.contains('locked')===false",timeout=10000); page.wait_for_timeout(250)
    page.click('.nav-item[data-view="projects"]'); page.wait_for_timeout(150)
    results['checks']['onlineDataLoaded']=page.get_by_text('Dự án kiểm thử ngoại tuyến',exact=True).count()>0
    results['checks']['onlineWriteAllowed']=page.evaluate('window.AlphaProductionGuard.canWrite()') is True

    ctx.set_offline(True); page.wait_for_timeout(150)
    page.evaluate('window.dispatchEvent(new CustomEvent("alpha:sync-status",{detail:{status:"offline",message:"Mất kết nối",context:window.__AUDIT_CONTEXT}}))'); page.wait_for_timeout(150)
    results['checks']['currentScreenRetainsLoadedDataOffline']=page.get_by_text('Dự án kiểm thử ngoại tuyến',exact=True).count()>0
    reason=page.evaluate('window.AlphaProductionGuard.reason()')
    results['checks']['offlineWriteBlocked']=page.evaluate('window.AlphaProductionGuard.canWrite()===false') and page.locator('#primaryAction').is_disabled()
    results['offlineReason']=reason
    results['checks']['offlineReasonIsExplicitReadOnly']='chỉ đọc' in reason and 'không ghi dữ liệu mới' in reason
    page.screenshot(path=str(OUT/f'OFFLINE_CURRENT_SCREEN_{RELEASE_FILE_TOKEN}.png'),full_page=False)

    # Simulate a cold start served from the cached shell while the network is unavailable.
    cold=ctx.new_page(); cold.on('pageerror',lambda e:results['pageErrors'].append(f'cold: {e}'))
    cold.set_content(content,wait_until='domcontentloaded',timeout=60000)
    cold.wait_for_function("() => Boolean(window.AlphaERP && window.AlphaProductionGuard)",timeout=10000)
    results['checks']['offlineColdStartShellLoads']=cold.locator('#appShell').count()==1 and cold.locator('#loginScreen').count()==1
    results['checks']['offlineColdStartLocked']=cold.locator('body').evaluate('e=>e.classList.contains("locked")')
    results['checks']['offlineColdStartDoesNotExposeBusinessData']=cold.get_by_text('Dự án kiểm thử ngoại tuyến',exact=True).count()==0
    cold.screenshot(path=str(OUT/f'OFFLINE_RELOAD_LOCKED_{RELEASE_FILE_TOKEN}.png'),full_page=False)

    # Restore connectivity and rehydrate only after a fresh verified context and Cloud payload are available.
    ctx.set_offline(False); cold.wait_for_timeout(100)
    cold.evaluate('(args)=>{window.__AUDIT_CONTEXT=args.ctx;window.AlphaProductionGuard.refreshContext();window.AlphaERP.applyRemote(args.db);window.dispatchEvent(new CustomEvent("alpha:sync-status",{detail:{status:"online",message:"online",context:args.ctx}}));}',{'ctx':CONTEXT,'db':DB})
    cold.wait_for_function("document.body.classList.contains('locked')===false",timeout=10000); cold.wait_for_timeout(300); cold.click('.nav-item[data-view="projects"]'); cold.wait_for_timeout(150)
    results['checks']['reconnectRestoresVerifiedData']=cold.get_by_text('Dự án kiểm thử ngoại tuyến',exact=True).count()>0 and cold.evaluate('window.AlphaProductionGuard.canWrite()') is True
    browser.close()

results['passed']=all(v is True for v in results['checks'].values()) and not results['pageErrors']
(OUT/f'OFFLINE_BROWSER_AUDIT_{RELEASE_FILE_TOKEN}.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(results,ensure_ascii=False))
raise SystemExit(0 if results['passed'] else 1)
