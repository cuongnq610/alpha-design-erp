#!/usr/bin/env python3
from pathlib import Path
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
import base64, mimetypes, json
from qa_release_context import RELEASE_VERSION, RELEASE_FILE_TOKEN, evidence_dir, launch_chromium, navigate_view, wait_for_ui_ready, wait_for_layout

ROOT=Path(__file__).resolve().parents[1]
OUT=evidence_dir('browser')
VIEWPORTS=[(360,800),(390,844),(430,932),(768,1024),(820,1180),(1024,1366)]
VIEWS=['dashboard','tasks','projects','controls','commercial','planning','procurement','crm','approvals','people','timesheets','payroll','documents','finance','financialAnalytics','accounting','tax','cloud-admin','readiness','users','audit','storage','integrations','exports','settings']

PRELUDE=r'''<script>
(()=>{
  class MemoryStorage{constructor(){this.m=new Map()}get length(){return this.m.size}key(i){return [...this.m.keys()][i]??null}getItem(k){return this.m.has(String(k))?this.m.get(String(k)):null}setItem(k,v){this.m.set(String(k),String(v))}removeItem(k){this.m.delete(String(k))}clear(){this.m.clear()}}
  try{Object.defineProperty(window,'localStorage',{value:new MemoryStorage(),configurable:true});Object.defineProperty(window,'sessionStorage',{value:new MemoryStorage(),configurable:true})}catch{}
  const records=new Map();
  const db={objectStoreNames:{contains:n=>n==='files'},createObjectStore:()=>({}),transaction:()=>{const tx={oncomplete:null,onerror:null,error:null,objectStore:()=>({put:r=>records.set(r.id,r),delete:id=>records.delete(id),get:id=>{const q={result:null,onsuccess:null,onerror:null};setTimeout(()=>{q.result=records.get(id);q.onsuccess&&q.onsuccess()},0);return q}})};setTimeout(()=>tx.oncomplete&&tx.oncomplete(),0);return tx}};
  try{Object.defineProperty(window,'indexedDB',{value:{open:()=>{const r={result:db,error:null,onupgradeneeded:null,onsuccess:null,onerror:null};setTimeout(()=>{r.onupgradeneeded&&r.onupgradeneeded();r.onsuccess&&r.onsuccess()},0);return r}},configurable:true})}catch{}
  try{Object.defineProperty(navigator,'serviceWorker',{value:{addEventListener:()=>{},register:()=>Promise.resolve({update:()=>Promise.resolve()})},configurable:true})}catch{}
  window.confirm=()=>true;
})();
</script>'''

def inline_app():
    soup=BeautifulSoup((ROOT/'index.html').read_text(encoding='utf-8'),'html.parser')
    soup.head.insert(0,BeautifulSoup(PRELUDE,'html.parser'))
    for link in list(soup.find_all('link')):
        rel=link.get('rel') or []; href=link.get('href','')
        if 'stylesheet' in rel and (ROOT/href).exists():
            st=soup.new_tag('style');st.string=(ROOT/href).read_text(encoding='utf-8');link.replace_with(st)
        elif 'manifest' in rel or 'icon' in rel: link.decompose()
    for img in soup.find_all('img'):
        p=ROOT/img.get('src','')
        if p.is_file():
            mime=mimetypes.guess_type(str(p))[0] or 'application/octet-stream'
            img['src']=f'data:{mime};base64,'+base64.b64encode(p.read_bytes()).decode()
    for script in list(soup.find_all('script')):
        src=script.get('src')
        if src and (ROOT/src).exists():
            node=soup.new_tag('script');node.string=(ROOT/src).read_text(encoding='utf-8').replace('</script>','<\\/script>');script.replace_with(node)
    return str(soup)

def box(locator):
    b=locator.bounding_box()
    return None if not b else {k:round(v,2) for k,v in b.items()}

content=inline_app(); results=[]; screenshots=[]; passed=True
with sync_playwright() as p:
    browser=launch_chromium(p, ['--disable-web-security'])
    for width,height in VIEWPORTS:
        print(f'[responsive] viewport {width}x{height}',flush=True)
        page=browser.new_page(viewport={'width':width,'height':height},is_mobile=width<=430,has_touch=True,device_scale_factor=1)
        errors=[]
        page.on('pageerror',lambda e,errors=errors:errors.append(f'pageerror: {e}'))
        page.on('console',lambda m,errors=errors:errors.append(f'console: {m.text}') if m.type=='error' else None)
        page.set_content(content,wait_until='domcontentloaded',timeout=60000);wait_for_ui_ready(page)
        # Sidebar interaction at all certified widths.
        menu=page.locator('#menuBtn'); sidebar=page.locator('#sidebar')
        menu_visible=menu.is_visible(); initial_sidebar=box(sidebar)
        menu.click(force=True);page.wait_for_timeout(80)
        opened=sidebar.evaluate("e=>e.classList.contains('open')") and page.locator('body').evaluate("e=>e.classList.contains('sidebar-open')")
        navigate_view(page,'dashboard')
        closed=not sidebar.evaluate("e=>e.classList.contains('open')") and not page.locator('body').evaluate("e=>e.classList.contains('sidebar-open')")
        bottom_display=page.locator('.mobile-bottom-nav').evaluate('e=>getComputedStyle(e).display')
        viewport_result={'width':width,'height':height,'menuVisible':menu_visible,'sidebarInitial':initial_sidebar,'sidebarOpened':opened,'sidebarClosedAfterNavigation':closed,'bottomNavDisplay':bottom_display,'views':{},'errors':errors}
        if not(menu_visible and opened and closed): passed=False
        if width<=820 and bottom_display=='none': passed=False
        if width>820 and bottom_display!='none': passed=False
        for view in VIEWS:
            navigate_view(page,view)
            metric=page.evaluate('''()=>{const b=document.body,d=document.documentElement,c=document.getElementById('content'),tw=[...document.querySelectorAll('.table-wrap')];return {active:document.querySelector('.nav-item.active')?.dataset.view||'',bodyOverflow:Math.max(0,b.scrollWidth-b.clientWidth),documentOverflow:Math.max(0,d.scrollWidth-d.clientWidth),contentOverflow:Math.max(0,(c?.scrollWidth||0)-(c?.clientWidth||0)),tableOverflowCount:tw.filter(x=>x.scrollWidth>x.clientWidth+2).length,scrollHintCount:tw.filter(x=>x.classList.contains('is-scrollable')).length}}''')
            viewport_result['views'][view]=metric
            if metric['bodyOverflow']>1 or metric['documentOverflow']>1 or metric['contentOverflow']>1: passed=False
        # Notification drawer dimensions.
        page.locator('#notificationBtn').click(force=True);page.wait_for_timeout(70)
        drawer=page.locator('#notificationDrawer');drawer_box=box(drawer)
        viewport_result['notificationDrawer']=drawer_box
        if not drawer.is_visible() or not drawer_box or drawer_box['width']>width+1: passed=False
        page.locator('[data-close-drawer]').first.click(force=True);page.wait_for_timeout(40)
        # Project form / mobile bottom sheet.
        navigate_view(page,'projects')
        if page.locator('#primaryAction').is_visible(): page.locator('#primaryAction').click(force=True);page.wait_for_timeout(70)
        modal=page.locator('#modalBackdrop .modal');modal_box=box(modal) if modal.is_visible() else None
        input_font=page.locator('#modalForm input').first.evaluate('e=>parseFloat(getComputedStyle(e).fontSize)') if page.locator('#modalForm input').count() else 0
        viewport_result['modal']={'visible':modal.is_visible(),'box':modal_box,'inputFontPx':input_font}
        if not modal.is_visible(): passed=False
        if width<=600 and (not modal_box or modal_box['width']<max(300,width-40) or modal_box['x']<0 or modal_box['x']+modal_box['width']>width+1 or input_font<15.9): passed=False
        page.locator('#closeModal').click(force=True);page.wait_for_timeout(40)
        # Storage upload: verify touch layout and actual local upload through in-memory IDB.
        page.locator('#menuBtn').click(force=True);page.wait_for_timeout(50)
        navigate_view(page,'storage');wait_for_layout(page,100)
        drop=page.locator('#uploadDrop');drop_box=box(drop) if drop.count() else None
        upload_ok=False
        if page.locator('#fileUpload').count():
            page.locator('#fileUpload').set_input_files({'name':'mobile-uat.txt','mimeType':'text/plain','buffer':b'ALPHA mobile UAT'})
            page.wait_for_timeout(180)
            upload_ok=page.get_by_text('mobile-uat.txt',exact=True).count()>0
        viewport_result['upload']={'dropBox':drop_box,'uploaded':upload_ok}
        if not drop_box or drop_box['width']>width-16 or not upload_ok: passed=False
        # Screenshot: phone=storage, tablet/desktop=financial dashboard.
        if width>=768:
            navigate_view(page,'financialAnalytics')
        shot=OUT/f'RESPONSIVE_{width}_{RELEASE_FILE_TOKEN}.png';page.screenshot(path=str(shot),full_page=False);screenshots.append(shot.name)
        if errors: passed=False
        results.append(viewport_result);page.close();print(f'[responsive] completed {width}px',flush=True)
    # Orientation smoke at 430 px device rotated landscape.
    page=browser.new_page(viewport={'width':430,'height':932},is_mobile=True,has_touch=True)
    page.set_content(content,wait_until='domcontentloaded');wait_for_ui_ready(page)
    page.set_viewport_size({'width':844,'height':390});page.wait_for_timeout(220)
    orientation=page.evaluate('''()=>({bodyOverflow:Math.max(0,document.body.scrollWidth-document.body.clientWidth),documentOverflow:Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth),viewport:document.documentElement.dataset.viewport,bottom:getComputedStyle(document.querySelector('.mobile-bottom-nav')).display})''')
    if orientation['bodyOverflow']>1 or orientation['documentOverflow']>1:passed=False
    page.close();browser.close()

evidence={'releaseVersion':RELEASE_VERSION,'testedWidths':[w for w,_ in VIEWPORTS],'testedViews':VIEWS,'touchAndOrientation':True,'orientationSmoke':orientation,'screenshots':screenshots,'results':results,'passed':passed}
(OUT/f'RESPONSIVE_VIEWPORT_AUDIT_{RELEASE_FILE_TOKEN}.json').write_text(json.dumps(evidence,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'passed':passed,'viewports':len(results),'evidence':str(OUT/f'RESPONSIVE_VIEWPORT_AUDIT_{RELEASE_FILE_TOKEN}.json')},ensure_ascii=False))
raise SystemExit(0 if passed else 1)
