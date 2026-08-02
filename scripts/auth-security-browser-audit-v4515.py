#!/usr/bin/env python3
from pathlib import Path
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
import json, base64, mimetypes
from qa_release_context import RELEASE_VERSION, RELEASE_FILE_TOKEN, evidence_dir, launch_chromium

ROOT=Path(__file__).resolve().parents[1]
OUT=evidence_dir()
RESULTS=evidence_dir('results')


def inline_demo():
    soup=BeautifulSoup((ROOT/'index.html').read_text(encoding='utf-8'),'html.parser')
    for script in list(soup.find_all('script')): script.decompose()
    for link in list(soup.find_all('link')):
        rel=link.get('rel') or []; href=link.get('href','')
        if 'stylesheet' in rel and (ROOT/href).exists():
            st=soup.new_tag('style'); st.string=(ROOT/href).read_text(encoding='utf-8'); link.replace_with(st)
        elif 'manifest' in rel or 'icon' in rel: link.decompose()
    for img in soup.find_all('img'):
        p=ROOT/img.get('src','')
        if p.is_file():
            mime=mimetypes.guess_type(str(p))[0] or 'application/octet-stream'
            img['src']=f'data:{mime};base64,'+base64.b64encode(p.read_bytes()).decode()
    pre=soup.new_tag('script'); pre.string="window.ALPHA_RUNTIME_CONFIG={environment:'demo',requireMfaForPrivilegedRoles:true};window.AlphaOnline={isConfigured:()=>false,getClient:()=>null};"
    soup.head.insert(0,pre)
    auth=soup.new_tag('script'); auth.string=(ROOT/'auth-security.js').read_text(encoding='utf-8').replace('</script>','<\\/script>'); soup.body.append(auth)
    return str(soup)

results={'releaseVersion':RELEASE_VERSION,'checks':{},'pageErrors':[],'passed':False}
with sync_playwright() as p:
    browser=launch_chromium(p)
    page=browser.new_page(viewport={'width':1365,'height':900})
    page.on('pageerror',lambda e:results['pageErrors'].append(str(e)))
    page.set_content(inline_demo(),wait_until='domcontentloaded',timeout=60000)
    page.evaluate("document.getElementById('accountSecurityBtn').click()")
    page.wait_for_timeout(100)
    results['checks']['demoActionOpensVisibleScreen']=page.locator('#authSecurityScreen').evaluate("e=>!e.classList.contains('hidden')")
    results['checks']['demoExplainsNoRealMfa']=page.locator('#authSecurityFeedback').evaluate("e=>/Demo|Supabase Auth|MFA thật/i.test(e.textContent)")
    results['checks']['demoEnvironmentVisible']=page.locator('#accountSecurityEnvironment').text_content().strip()=='DEMO'
    results['checks']['demoActionDisabled']=page.locator('#accountSecurityAction').is_disabled()
    page.screenshot(path=str(OUT/'mfa-demo-unavailable.png'),full_page=False)

    bundle_page=browser.new_page()
    bundle_page.on('pageerror',lambda e:results['pageErrors'].append('bundle: '+str(e)))
    bundle=(ROOT/'alpha-sync.bundle.js').read_text(encoding='utf-8').replace('</script>','<\\/script>')
    html=f'''<!doctype html><html><body><script>(()=>{{class MemoryStorage{{constructor(){{this.m=new Map()}}get length(){{return this.m.size}}key(i){{return [...this.m.keys()][i]??null}}getItem(k){{return this.m.has(String(k))?this.m.get(String(k)):null}}setItem(k,v){{this.m.set(String(k),String(v))}}removeItem(k){{this.m.delete(String(k))}}clear(){{this.m.clear()}}}};Object.defineProperty(window,'localStorage',{{value:new MemoryStorage(),configurable:true}});Object.defineProperty(window,'sessionStorage',{{value:new MemoryStorage(),configurable:true}});window.ALPHA_RUNTIME_CONFIG={{environment:'staging',supabaseUrl:'https://fake.supabase.co',supabaseAnonKey:'eyJaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',enableRealtime:false}};window.AlphaERP={{getDB:()=>({{}})}};}})();</script><script>{bundle}</script></body></html>'''
    bundle_page.set_content(html,wait_until='domcontentloaded',timeout=60000); bundle_page.wait_for_timeout(250)
    contract=bundle_page.evaluate("""()=>{const m=window.AlphaOnline?.getClient?.()?.auth?.mfa;return {client:!!window.AlphaOnline?.getClient?.(),mfa:!!m,enroll:typeof m?.enroll==='function',list:typeof m?.listFactors==='function',verify:typeof m?.challengeAndVerify==='function',aal:typeof m?.getAuthenticatorAssuranceLevel==='function'};}""")
    results['bundleContract']=contract
    results['checks']['bundledSupabaseClientExposesMfa']=all(contract.values())
    browser.close()

results['passed']=all(v is True for v in results['checks'].values()) and not results['pageErrors']
(RESULTS/'mfa-browser-audit.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(results,ensure_ascii=False))
raise SystemExit(0 if results['passed'] else 1)
