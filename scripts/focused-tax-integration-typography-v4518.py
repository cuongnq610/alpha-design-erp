#!/usr/bin/env python3
from __future__ import annotations
import base64,json,re
from pathlib import Path
from playwright.sync_api import sync_playwright
from qa_release_context import RELEASE_VERSION, RELEASE_FILE_TOKEN, evidence_dir, launch_chromium
ROOT=Path(__file__).resolve().parents[1]
OUT=evidence_dir('ui')
VIEWPORTS=[(1920,1080),(1792,1000),(1440,1000),(1280,900),(1024,900),(390,844)]

def inline_application():
 h=(ROOT/'index.html').read_text(encoding='utf-8');css=(ROOT/'alpha-design-system.css').read_text(encoding='utf-8')
 h=re.sub(r'<link rel="stylesheet" href="alpha-design-system\.css"\s*/?>',f'<style>{css}</style>',h)
 for src in re.findall(r'<script src="([^"]+)"></script>',h):
  p=ROOT/src
  if p.exists():h=h.replace(f'<script src="{src}"></script>',f'<script>\n{p.read_text(encoding="utf-8")}\n</script>',1)
 for name in ('logo-alpha-on-dark.png','logo-alpha-transparent.png','icon-192.png','icon-512.png'):
  p=ROOT/name;h=h.replace(name,'data:image/png;base64,'+base64.b64encode(p.read_bytes()).decode())
 h=h.replace('localStorage','window.alphaStorage').replace('sessionStorage','window.alphaSessionStorage')
 storage='''<script>function makeAlphaStorage(){let store={};return {getItem:k=>Object.prototype.hasOwnProperty.call(store,k)?store[k]:null,setItem:(k,v)=>{store[k]=String(v)},removeItem:k=>{delete store[k]},clear:()=>{store={}},key:i=>Object.keys(store)[i]||null,get length(){return Object.keys(store).length}};}window.alphaStorage=makeAlphaStorage();window.alphaSessionStorage=makeAlphaStorage();</script>'''
 return h.replace('<head>','<head>'+storage,1)

TEXT_CLIP_JS=r'''() => {
 const selectors='.kpi-value,.kpi-label,.kpi-unit,.kpi-foot span,.accounting-tab,.primary-btn,.secondary-btn,.ghost-btn,.danger-btn,.badge,.nav-label,th,td';
 const visible=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>.5&&r.height>.5&&s.display!=='none'&&s.visibility!=='hidden'};
 const issues=[];
 document.querySelectorAll(selectors).forEach(e=>{
  if(!visible(e)||!e.textContent.trim())return;
  const s=getComputedStyle(e);if(!['hidden','clip'].includes(s.overflow)&&!['hidden','clip'].includes(s.overflowY))return;
  const range=document.createRange();range.selectNodeContents(e);const rr=range.getBoundingClientRect(),er=e.getBoundingClientRect();
  if(rr.bottom>er.bottom+1||rr.top<er.top-1||e.scrollHeight>e.clientHeight+1)issues.push({text:e.textContent.trim().slice(0,80),className:String(e.className),rangeTop:rr.top,rangeBottom:rr.bottom,elementTop:er.top,elementBottom:er.bottom,scrollHeight:e.scrollHeight,clientHeight:e.clientHeight});
 });return issues;
}'''

def main():
 html=inline_application();records=[]
 with sync_playwright() as p:
  browser=launch_chromium(p)
  for width,height in VIEWPORTS:
   for theme in ('light','dark'):
    page=browser.new_page(viewport={'width':width,'height':height});errors=[];page.on('pageerror',lambda e,b=errors:b.append(str(e)))
    page.set_content(html,wait_until='load',timeout=60000)
    page.evaluate("document.getElementById('loginScreen')?.classList.add('hidden');document.getElementById('appShell')?.classList.remove('hidden');document.body.classList.remove('auth-required')")
    page.evaluate("theme=>document.documentElement.setAttribute('data-theme',theme)",theme)
    page.evaluate("document.querySelector(\".nav-item[data-view='accounting']\")?.click()");page.wait_for_timeout(50)
    page.locator("[data-accounting-tab='control']").click();page.locator("[data-accounting-tab='tax']").click();page.wait_for_timeout(80)
    tax_ok=page.locator('.accounting-tab.active').inner_text()=='Thuế' and page.get_by_text('Khấu trừ thuế TNCN',exact=True).count()>0 and page.get_by_text('Điều chỉnh thuế TNDN',exact=True).count()>0 and page.locator('.table-pit-withholdings').count()==1 and page.locator('.table-cit-adjustments').count()==1
    if width==1440 and theme=='light': page.screenshot(path=str(OUT/'accounting-tax-functional-1440-light.png'),full_page=False)
    page.evaluate("document.querySelector(\".nav-item[data-view='integrations']\")?.click()");page.wait_for_timeout(80)
    email=page.locator('[data-automation-config="email"]');bank=page.locator('[data-automation-config="bank"]')
    integration_ok=email.is_visible() and email.is_enabled() and bank.is_visible() and bank.is_enabled()
    if width==1440 and theme=='light': page.screenshot(path=str(OUT/'integrations-actions-1440-light.png'),full_page=False)
    email.click();page.wait_for_timeout(30);email_modal=page.locator('#modalBackdrop:not(.hidden)').count()==1 and 'Email tự động' in page.locator('#modalTitle').inner_text();page.locator('#cloudCancelModal').click()
    bank.click();page.wait_for_timeout(30);bank_modal=page.locator('#modalBackdrop:not(.hidden)').count()==1 and 'Đồng bộ ngân hàng' in page.locator('#modalTitle').inner_text();page.locator('#cloudCancelModal').click()
    page.evaluate("document.querySelector(\".nav-item[data-view='dashboard']\")?.click()");page.wait_for_timeout(50)
    clipping=page.evaluate(TEXT_CLIP_JS)
    rec={'width':width,'height':height,'theme':theme,'taxOk':tax_ok,'integrationButtonsOk':integration_ok,'emailModalOk':email_modal,'bankModalOk':bank_modal,'verticalTextClipping':clipping,'pageErrors':errors}
    rec['passed']=all([tax_ok,integration_ok,email_modal,bank_modal]) and not clipping and not errors;records.append(rec)
    if width==1792 and theme=='dark':page.screenshot(path=str(OUT/'dashboard-typography-dark-1792.png'),full_page=False)
    page.close()
  browser.close()
 summary={'releaseVersion':RELEASE_VERSION,'states':len(records),'passedStates':sum(r['passed'] for r in records),'failedStates':sum(not r['passed'] for r in records),'passed':all(r['passed'] for r in records)}
 (OUT/'tax-integration-typography-audit.json').write_text(json.dumps({'summary':summary,'records':records},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print(json.dumps(summary,ensure_ascii=False))
 if not summary['passed']:raise SystemExit(1)
if __name__=='__main__':main()
