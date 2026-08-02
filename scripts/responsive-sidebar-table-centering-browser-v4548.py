#!/usr/bin/env python3
from __future__ import annotations
import base64, json, re
from pathlib import Path
from playwright.sync_api import sync_playwright
from qa_release_context import RELEASE_VERSION, evidence_dir, launch_chromium, wait_for_layout, wait_for_ui_ready

ROOT=Path(__file__).resolve().parents[1]
OUT=evidence_dir('v4548')
VIEWPORTS=[(1440,920),(1792,980)]
VIEWS=['controls','tasks','commercial']

def inline_application():
    h=(ROOT/'index.html').read_text(encoding='utf-8')
    css=(ROOT/'alpha-design-system.css').read_text(encoding='utf-8')
    h=re.sub(r'<link rel="stylesheet" href="alpha-design-system\.css"\s*/?>',f'<style>{css}</style>',h)
    for src in re.findall(r'<script src="([^"]+)"></script>',h):
        p=ROOT/src
        if p.exists(): h=h.replace(f'<script src="{src}"></script>',f'<script>\n{p.read_text(encoding="utf-8")}\n</script>',1)
    for name in ('logo-alpha-on-dark.png','logo-alpha-transparent.png','icon-192.png','icon-512.png'):
        p=ROOT/name
        h=h.replace(name,'data:image/png;base64,'+base64.b64encode(p.read_bytes()).decode())
    h=h.replace('localStorage','window.alphaStorage').replace('sessionStorage','window.alphaSessionStorage')
    storage='''<script>function makeAlphaStorage(){let store={};return {getItem:k=>Object.prototype.hasOwnProperty.call(store,k)?store[k]:null,setItem:(k,v)=>{store[k]=String(v)},removeItem:k=>{delete store[k]},clear:()=>{store={}},key:i=>Object.keys(store)[i]||null,get length(){return Object.keys(store).length}};}window.alphaStorage=makeAlphaStorage();window.alphaSessionStorage=makeAlphaStorage();</script>'''
    return h.replace('<head>','<head>'+storage,1)

AUDIT=r'''() => {
 const visible=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>.5&&r.height>.5&&s.display!=='none'&&s.visibility!=='hidden'};
 const tables=[];
 [...document.querySelectorAll('.table-wrap')].filter(visible).forEach((wrap,index)=>{
   const table=wrap.querySelector('table');if(!table||!visible(table))return;
   const wr=wrap.getBoundingClientRect(),tr=table.getBoundingClientRect();
   const headers=[...table.querySelectorAll('thead th')].filter(visible);
   const semantic=[...table.querySelectorAll('tbody td.table-col-numeric,tbody td.table-col-date,tbody td.table-col-progress,tbody td.table-col-status')].filter(visible);
   tables.push({
     index,
     columns:headers.length,
     wrapWidth:wrap.clientWidth,
     tableWidth:tr.width,
     blankRight:Math.max(0,wr.right-Math.min(wr.right,tr.right)),
     headerMisaligned:headers.filter(x=>getComputedStyle(x).textAlign!=='center').map(x=>x.textContent.trim().slice(0,40)),
     semanticMisaligned:semantic.filter(x=>getComputedStyle(x).textAlign!=='center').map(x=>({text:x.textContent.trim().slice(0,40),className:x.className,align:getComputedStyle(x).textAlign})),
     gridVersion:table.dataset.gridVersion||'',
     gridContract:table.dataset.gridContract||''
   });
 });
 const shell=document.querySelector('.app-shell'),main=document.querySelector('.main');
 return {tables,shellColumns:getComputedStyle(shell).gridTemplateColumns,mainWidth:main?.getBoundingClientRect().width||0,bodyOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
}'''

def main():
    html=inline_application();records=[];screens=[]
    with sync_playwright() as p:
        browser=launch_chromium(p)
        try:
            for width,height in VIEWPORTS:
                page=browser.new_page(viewport={'width':width,'height':height})
                errors=[];page.on('pageerror',lambda e,sink=errors:sink.append(str(e)))
                try:
                    page.set_content(html,wait_until='domcontentloaded',timeout=60000);wait_for_ui_ready(page)
                    page.evaluate("document.getElementById('loginScreen')?.classList.add('hidden');document.getElementById('appShell')?.classList.remove('hidden');document.body.classList.remove('auth-required');")
                    for theme in ('light','dark'):
                        page.evaluate("t=>document.documentElement.setAttribute('data-theme',t)",theme)
                        # Start expanded, open controls and capture width.
                        page.evaluate("document.getElementById('sidebar')?.classList.remove('collapsed');window.AlphaResponsive?.enhanceResponsiveTables();")
                        page.evaluate("document.querySelector('.nav-item[data-view=\"controls\"]')?.click()");wait_for_layout(page,12)
                        before=page.evaluate(AUDIT)
                        page.locator('#collapseBtn').click();page.wait_for_timeout(420);wait_for_layout(page,12)
                        after=page.evaluate(AUDIT)
                        issues=[]
                        if after['mainWidth']<=before['mainWidth']+80:issues.append({'kind':'main-not-expanded','before':before['mainWidth'],'after':after['mainWidth']})
                        for table in after['tables']:
                            if table['blankRight']>2.5:issues.append({'kind':'collapsed-sidebar-blank','table':table})
                            if table['gridVersion']!=RELEASE_VERSION:issues.append({'kind':'stale-grid-version','table':table})
                            if table['headerMisaligned']:issues.append({'kind':'header-not-centered','table':table})
                            if table['semanticMisaligned']:issues.append({'kind':'semantic-data-not-centered','table':table})
                        records.append({'width':width,'theme':theme,'view':'controls-collapsed','before':before,'after':after,'issues':issues,'passed':not issues})
                        if width==1792 and theme=='light':
                            shot=OUT/'v4548-controls-collapsed-no-blank.png';page.screenshot(path=str(shot),full_page=False);screens.append(str(shot))
                        for view in VIEWS[1:]:
                            page.evaluate("view=>document.querySelector(`.nav-item[data-view=\"${view}\"]`)?.click()",view);page.wait_for_timeout(120);wait_for_layout(page,12)
                            result=page.evaluate(AUDIT);issues=[]
                            for table in result['tables']:
                                if table['blankRight']>2.5:issues.append({'kind':'table-blank-right','table':table})
                                if table['headerMisaligned']:issues.append({'kind':'header-not-centered','table':table})
                                if table['semanticMisaligned']:issues.append({'kind':'semantic-data-not-centered','table':table})
                            if result['bodyOverflow']>1:issues.append({'kind':'body-overflow','value':result['bodyOverflow']})
                            records.append({'width':width,'theme':theme,'view':view,'result':result,'issues':issues,'passed':not issues})
                            if width==1792 and theme=='light':
                                shot=OUT/f'v4548-{view}-centered-columns.png';page.screenshot(path=str(shot),full_page=False);screens.append(str(shot))
                finally:
                    page.close()
        finally:
            browser.close()
    summary={'releaseVersion':RELEASE_VERSION,'states':len(records),'passedStates':sum(r['passed'] for r in records),'failedStates':sum(not r['passed'] for r in records),'runtimeErrors':errors if 'errors' in locals() else [],'screenshots':screens,'passed':all(r['passed'] for r in records) and not (errors if 'errors' in locals() else [])}
    OUT.mkdir(parents=True,exist_ok=True)
    (OUT/'responsive-sidebar-table-centering-browser-audit.json').write_text(json.dumps({'summary':summary,'records':records},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(summary,ensure_ascii=False))
    if not summary['passed']:raise SystemExit(1)

if __name__=='__main__':main()
