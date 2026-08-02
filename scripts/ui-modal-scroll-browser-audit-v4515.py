from pathlib import Path
from playwright.sync_api import sync_playwright
import re,base64,json,sys
from qa_release_context import RELEASE_VERSION, RELEASE_FILE_TOKEN, evidence_dir, launch_chromium
root=Path(__file__).resolve().parents[1]
out=evidence_dir('ui')
html=(root/'index.html').read_text(encoding='utf-8');css=(root/'alpha-design-system.css').read_text(encoding='utf-8')
html=re.sub(r'<link rel="stylesheet" href="alpha-design-system\.css"\s*/?>',f'<style>{css}</style>',html)
for src in re.findall(r'<script src="([^"]+)"></script>',html):
 p=root/src
 if p.exists(): html=html.replace(f'<script src="{src}"></script>',f'<script>\n{p.read_text(encoding="utf-8")}\n</script>',1)
for name in ['logo-alpha-on-dark.png','logo-alpha-transparent.png','icon-192.png','icon-512.png']:
 p=root/name;html=html.replace(name,'data:image/png;base64,'+base64.b64encode(p.read_bytes()).decode())
html=html.replace('localStorage','window.alphaStorage').replace('sessionStorage','window.alphaSessionStorage')
mem='''<script>function makeAlphaStorage(){let store={};return {getItem:k=>Object.prototype.hasOwnProperty.call(store,k)?store[k]:null,setItem:(k,v)=>{store[k]=String(v)},removeItem:k=>{delete store[k]},clear:()=>{store={}},key:i=>Object.keys(store)[i]||null,get length(){return Object.keys(store).length}};}window.alphaStorage=makeAlphaStorage();window.alphaSessionStorage=makeAlphaStorage();</script>'''
html=html.replace('<head>','<head>'+mem,1)
result={'release':RELEASE_VERSION,'checks':[],'errors':[],'viewports':[]}
def check(name,value,detail=''):
 ok=bool(value);result['checks'].append({'name':name,'pass':ok,'detail':detail});return ok
with sync_playwright() as p:
 browser=launch_chromium(p)
 for width,height,label in [(1792,860,'desktop'),(820,1040,'tablet'),(390,844,'mobile')]:
  page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=1)
  page.on('pageerror',lambda e:result['errors'].append(f'{label}: {e}'))
  page.set_content(html,wait_until='load',timeout=60000);page.wait_for_timeout(700)
  page.evaluate("document.getElementById('loginScreen')?.classList.add('hidden');document.getElementById('appShell')?.classList.remove('hidden');document.body.classList.remove('auth-required');if(window.AlphaProductionGuard){window.AlphaProductionGuard.canWrite=()=>true;window.AlphaProductionGuard.reason=()=>''}")
  page.evaluate("document.querySelector(`.nav-item[data-view='accounting']`)?.click()");page.wait_for_timeout(450)
  page.locator('[data-accounting-tab="overview"]').click();page.wait_for_timeout(250)
  page.locator('.adjust-journal').first.click();page.wait_for_timeout(250)
  form=page.locator('#modalForm');modal=page.locator('#modalBackdrop .modal');header=page.locator('#modalBackdrop .modal-header')
  metrics=form.evaluate('e=>({scrollHeight:e.scrollHeight,clientHeight:e.clientHeight,scrollTop:e.scrollTop,overflow:getComputedStyle(e).overflowY})')
  check(f'{label}: modal form has independent overflow',metrics['scrollHeight']>metrics['clientHeight'] and metrics['overflow'] in ('auto','scroll'),str(metrics))
  check(f'{label}: modal stays inside viewport',modal.evaluate('(m)=>{const r=m.getBoundingClientRect();return r.top>=-1&&r.bottom<=innerHeight+1}'))
  check(f'{label}: page body is scroll-locked',page.evaluate("document.body.classList.contains('modal-open')&&getComputedStyle(document.body).overflow==='hidden'"))
  check(f'{label}: modal overlays DEMO banner',page.evaluate("getComputedStyle(document.getElementById('modalBackdrop')).zIndex>getComputedStyle(document.querySelector('.production-guard-banner')).zIndex"))
  initial_header=header.bounding_box()
  form.hover();page.mouse.wheel(0,700);page.wait_for_timeout(180)
  after=form.evaluate('e=>e.scrollTop')
  check(f'{label}: wheel scroll moves form downward',after>10,f'scrollTop={after}')
  after_header=header.bounding_box()
  check(f'{label}: header remains fixed while form scrolls',initial_header and after_header and abs(initial_header['y']-after_header['y'])<1.5)
  form.evaluate('e=>e.scrollTop=e.scrollHeight');page.wait_for_timeout(120)
  actions=page.locator('#modalForm .form-actions')
  check(f'{label}: bottom action bar becomes visible',actions.evaluate('e=>{const r=e.getBoundingClientRect();return r.top<innerHeight&&r.bottom<=innerHeight+1}'))
  check(f'{label}: final journal row is reachable',page.locator('.journal-line').last.evaluate('e=>{const r=e.getBoundingClientRect(),f=e.closest("form").getBoundingClientRect();return r.bottom<=f.bottom+1}'))
  page.screenshot(path=str(out/f'journal-modal-scroll-{label}.png'),full_page=False)
  result['viewports'].append({'label':label,'width':width,'height':height,'metrics':metrics,'scrollTopAfterWheel':after})
  page.close()
 browser.close()
result['passed']=sum(x['pass'] for x in result['checks']);result['failed']=len(result['checks'])-result['passed']+len(result['errors'])
(out/'modal-scroll-audit.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'passed':result['passed'],'failed':result['failed'],'errors':result['errors'],'failedChecks':[x['name'] for x in result['checks'] if not x['pass']]},ensure_ascii=False,indent=2))
if result['failed']:sys.exit(1)
