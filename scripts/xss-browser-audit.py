#!/usr/bin/env python3
from pathlib import Path
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
import json, base64, mimetypes
from qa_release_context import RELEASE_VERSION, RELEASE_FILE_TOKEN, evidence_dir, launch_chromium

ROOT=Path(__file__).resolve().parents[1]
OUT=evidence_dir('browser')
PAYLOAD='<img src=x onerror="window.__xss=(window.__xss||0)+1" data-alpha-xss="1">'
CONTEXT={
 'user_id':'22222222-2222-4222-8222-222222222222','email':'security-audit@alpha.local','full_name':'Security Audit User',
 'company_id':'11111111-1111-4111-8111-111111111111','company_code':'ALPHA','company_name':'ALPHA DESIGN',
 'role_name':'Director','permissions':['admin'],'aal':'aal2','mfa_required':True,'operational_mode':'pilot','production_writes_enabled':False
}
DB={
 'people':[{'id':'p1','code':'P-XSS','name':PAYLOAD,'fullName':PAYLOAD,'email':'safe@example.com','role':'Architect','status':'Active'}],
 'clients':[{'id':'c1','code':'C-XSS','name':PAYLOAD,'companyName':PAYLOAD,'contactPerson':PAYLOAD,'email':'safe@example.com','status':'Active'}],
 'projects':[{'id':'pr1','code':'SEC-001','name':PAYLOAD,'clientId':'c1','pmId':'p1','client':PAYLOAD,'status':'In Progress','startDate':'2026-07-01','endDate':'2026-12-31','contractValue':100000000,'budget':70000000,'progress':25}],
 'tasks':[{'id':'t1','projectId':'pr1','title':PAYLOAD,'name':PAYLOAD,'assigneeId':'p1','status':'In Progress','priority':'High','dueDate':'2026-08-01'}],
 'documents':[{'id':'d1','projectId':'pr1','name':PAYLOAD,'fileName':PAYLOAD,'type':'PDF','status':'Current'}],
 'vendors':[{'id':'v1','name':PAYLOAD,'taxCode':'0100000000','email':'safe@example.com'}],
 'contracts':[{'id':'ct1','projectId':'pr1','clientId':'c1','contractNo':'CT-001','name':PAYLOAD,'title':PAYLOAD,'status':'Signed','value':100000000}],
 'purchaseRequests':[{'id':'r1','requestNo':'PR-XSS','date':'2026-07-01','itemName':PAYLOAD,'purpose':PAYLOAD,'category':'Office','requesterId':'p1','projectId':'pr1','quantity':1,'unitPrice':1000,'suggestedClass':'Expense','status':'Pending'}],
 'purchaseOrders':[],
 'tools':[],
 'fixedAssets':[],
 'timesheets':[],'finance':[],'quotes':[{'id':'q1','date':'2026-07-01','clientId':'c1','projectName':PAYLOAD,'amount':1000,'probability':50,'status':'Proposal'}],'approvals':[],'accounts':[],'journalEntries':[],'taxInvoices':[],'pitWithholdings':[],'citAdjustments':[],'taxFilings':[],
 'billingMilestones':[],'paymentAllocations':[],'projectBudgetVersions':[],'projectBudgetLines':[],'resourcePlans':[],'commitments':[],'projectStages':[],
 'toolAllocationSchedules':[],'depreciationSchedules':[],'financialForecastScenarios':[],'financialAnalysisSnapshots':[],'financialLinkAuditRuns':[],
 'notificationReads':[],'openingBalances':[],'accountingPeriods':[],'exportLogs':[],'importLogs':[],
 'settings':{'companyName':'ALPHA DESIGN','currency':'VND','fiscalYear':2026}
}

PRELUDE='''<script>
(()=>{
 class MemoryStorage{constructor(){this.m=new Map()}get length(){return this.m.size}key(i){return [...this.m.keys()][i]??null}getItem(k){return this.m.has(String(k))?this.m.get(String(k)):null}setItem(k,v){this.m.set(String(k),String(v))}removeItem(k){this.m.delete(String(k))}clear(){this.m.clear()}}
 Object.defineProperty(window,'localStorage',{value:new MemoryStorage(),configurable:true});Object.defineProperty(window,'sessionStorage',{value:new MemoryStorage(),configurable:true});
 window.__xss=0;
 window.ALPHA_RUNTIME_CONFIG={environment:'production',dataMode:'server-authoritative',apiBaseUrl:'',apiAuthRequired:true,allowDemoLogin:false,allowLocalBusinessData:false,allowOfflineWritesInProduction:false,requireMfaForPrivilegedRoles:true,supabaseUrl:'https://audit.supabase.co',supabaseAnonKey:'eyJaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'};
 window.__AUDIT_CONTEXT=null;
 window.AlphaOnline={isConfigured:()=>true,getClient:()=>({auth:{getSession:async()=>({data:{session:{access_token:'xss-audit-token'}}}),signOut:async()=>({})}}),getContext:()=>window.__AUDIT_CONTEXT,status:()=>({status:'online'}),signOut:async()=>{}};
 const NativeResponse=window.Response;
 window.fetch=async(url)=>{if(String(url).includes('/api/session'))return new NativeResponse(JSON.stringify({ok:true,context:window.__AUDIT_CONTEXT,user:{id:window.__AUDIT_CONTEXT?.user_id||''}}),{status:200,headers:{'content-type':'application/json'}});return new NativeResponse('{}',{status:200,headers:{'content-type':'application/json'}})};
 window.confirm=()=>true;window.alert=()=>{};
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
            st=soup.new_tag('style');st.string=(ROOT/href).read_text(encoding='utf-8');link.replace_with(st)
        elif 'manifest' in rel or 'icon' in rel: link.decompose()
    for img in soup.find_all('img'):
        p=ROOT/img.get('src','')
        if p.is_file():
            mime=mimetypes.guess_type(str(p))[0] or 'application/octet-stream';img['src']=f'data:{mime};base64,'+base64.b64encode(p.read_bytes()).decode()
    for name in INCLUDE:
        node=soup.new_tag('script');node.string=(ROOT/name).read_text(encoding='utf-8').replace('</script>','<\\/script>');soup.body.append(node)
    return str(soup)

results={'releaseVersion':RELEASE_VERSION,'payload':PAYLOAD,'views':{},'pageErrors':[],'passed':False}
with sync_playwright() as p:
    browser=launch_chromium(p, ['--disable-web-security'])
    ctx=browser.new_context(viewport={'width':1440,'height':960})
    page=ctx.new_page();page.on('pageerror',lambda e:results['pageErrors'].append(str(e)))
    page.set_content(inline_app(),wait_until='domcontentloaded',timeout=60000)
    page.wait_for_function("() => Boolean(window.AlphaERP && window.AlphaProductionGuard)",timeout=10000)
    page.evaluate('(args)=>{window.__AUDIT_CONTEXT=args.ctx;window.AlphaERP.applyRemote(args.db);window.dispatchEvent(new CustomEvent("alpha:sync-status",{detail:{status:"online",message:"online",context:args.ctx}}));}',{'ctx':CONTEXT,'db':DB})
    page.evaluate('window.AlphaProductionGuard.refreshContext()');page.wait_for_function("document.body.classList.contains('locked')===false",timeout=10000)
    for view in ['projects','tasks','commercial','crm','people','documents','procurement']:
        activated=page.evaluate("v=>{const el=document.querySelector(`.nav-item[data-view='${v}']`);if(!el)return false;el.click();return document.querySelector('.nav-item.active')?.dataset.view===v;}",view)
        page.wait_for_timeout(160)
        xss_count=page.evaluate('window.__xss||0')
        injected_nodes=page.locator('[data-alpha-xss="1"]').count()
        payload_visible=page.evaluate('(p)=>document.body.innerText.includes(p)',PAYLOAD)
        results['views'][view]={'activated':activated,'scriptExecutions':xss_count,'injectedDomNodes':injected_nodes,'escapedPayloadRenderedAsText':payload_visible,'passed':activated and xss_count==0 and injected_nodes==0}
    page.screenshot(path=str(OUT/f'XSS_RENDERING_AUDIT_{RELEASE_FILE_TOKEN}.png'),full_page=False)
    browser.close()
results['renderedCoverage']=sum(1 for v in results['views'].values() if v['escapedPayloadRenderedAsText'])
results['passed']=all(v['passed'] for v in results['views'].values()) and results['renderedCoverage']==len(results['views']) and not results['pageErrors']
(OUT/f'XSS_BROWSER_AUDIT_{RELEASE_FILE_TOKEN}.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(results,ensure_ascii=False))
raise SystemExit(0 if results['passed'] else 1)
