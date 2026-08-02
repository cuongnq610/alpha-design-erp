from pathlib import Path
from playwright.sync_api import sync_playwright
import re,base64,json
from qa_release_context import RELEASE_VERSION, RELEASE_FILE_TOKEN, evidence_dir, launch_chromium
ROOT=Path(__file__).resolve().parents[1]
h=(ROOT/'index.html').read_text(encoding='utf-8');css=(ROOT/'alpha-design-system.css').read_text(encoding='utf-8')
h=re.sub(r'<link rel="stylesheet" href="alpha-design-system\.css"\s*/?>',f'<style>{css}</style>',h)
for src in re.findall(r'<script src="([^"]+)"></script>',h):
 p=ROOT/src
 if p.exists(): h=h.replace(f'<script src="{src}"></script>',f'<script>\n{p.read_text(encoding="utf-8")}\n</script>',1)
for name in ('logo-alpha-on-dark.png','logo-alpha-transparent.png','icon-192.png','icon-512.png'):
 p=ROOT/name;h=h.replace(name,'data:image/png;base64,'+base64.b64encode(p.read_bytes()).decode())
h=h.replace('localStorage','window.alphaStorage').replace('sessionStorage','window.alphaSessionStorage')
mem='''<script>function makeAlphaStorage(){let store={};return {getItem:k=>Object.prototype.hasOwnProperty.call(store,k)?store[k]:null,setItem:(k,v)=>{store[k]=String(v)},removeItem:k=>{delete store[k]},clear:()=>{store={}},key:i=>Object.keys(store)[i]||null,get length(){return Object.keys(store).length}};}window.alphaStorage=makeAlphaStorage();window.alphaSessionStorage=makeAlphaStorage();window.confirm=()=>false;window.alert=(m)=>{window.__alerts=(window.__alerts||[]).concat(String(m))};</script>'''
h=h.replace('<head>','<head>'+mem,1)
views=['dashboard','tasks','projects','controls','documents','commercial','planning','procurement','crm','approvals','people','timesheets','payroll','finance','financialAnalytics','accounting','tax','cloud-admin','readiness','security-center','users','audit','storage','integrations','exports','settings']
results=[]
with sync_playwright() as p:
 b=launch_chromium(p)
 page=b.new_page(viewport={'width':1440,'height':1000}); errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(h,wait_until='load',timeout=60000);page.wait_for_timeout(200)
 page.evaluate("document.getElementById('loginScreen')?.classList.add('hidden');document.getElementById('appShell')?.classList.remove('hidden');document.body.classList.remove('auth-required')")
 for v in views:
  before=len(errors)
  try:
   page.evaluate("v=>document.querySelector(`.nav-item[data-view='${v}']`)?.click()",v);page.wait_for_timeout(80)
   # click all visible non-write tabs
   for sel in ['[data-accounting-tab]','[data-control-tab]','[data-procurement-tab]','[data-financial-tab]','[data-export-tab]']:
    n=page.locator(sel).count()
    for i in range(n):
     loc=page.locator(sel).nth(i)
     if loc.is_visible():
      loc.click(force=True);page.wait_for_timeout(40)
   # open primary action and close modal
   pa=page.locator('#primaryAction')
   modal_open=False
   if pa.count() and pa.is_visible() and not pa.is_disabled():
    pa.click(force=True);page.wait_for_timeout(40)
    modal_open=page.locator('#modalBackdrop:not(.hidden)').count()>0
    if modal_open: page.locator('#closeModal').click(force=True);page.wait_for_timeout(30)
   # cloud automation config buttons
   for sel in ['[data-automation-config="email"]','[data-automation-config="bank"]']:
    loc=page.locator(sel)
    if loc.count() and loc.is_visible():
     loc.click(force=True);page.wait_for_timeout(30)
     if page.locator('#modalBackdrop:not(.hidden)').count(): page.locator('#closeModal').click(force=True);page.wait_for_timeout(20)
   results.append({'view':v,'newErrors':errors[before:],'hash':page.evaluate('location.hash'),'modalOpened':modal_open})
  except Exception as e:
   results.append({'view':v,'exception':str(e),'newErrors':errors[before:]})
 b.close()
out={'passed':all(not r.get('newErrors') and not r.get('exception') for r in results),'results':results,'errors':errors}
print(json.dumps(out,ensure_ascii=False,indent=2))
out_path=evidence_dir('results')/'interaction-smoke.json';out_path.write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
raise SystemExit(0 if out['passed'] else 1)
