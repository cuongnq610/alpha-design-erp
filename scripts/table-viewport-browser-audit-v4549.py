#!/usr/bin/env python3
from __future__ import annotations
import base64, json, re
from pathlib import Path
from playwright.sync_api import sync_playwright
from qa_release_context import RELEASE_VERSION, evidence_dir, launch_chromium, wait_for_layout, wait_for_ui_ready

ROOT=Path(__file__).resolve().parents[1]
OUT=evidence_dir('table-viewport-v4549')
VIEWPORTS=[(1440,900),(1792,900)]

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

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    records=[]; errors=[]; screenshots=[]
    html=inline_application()
    with sync_playwright() as p:
        browser=launch_chromium(p)
        try:
            for width,height in VIEWPORTS:
                page=browser.new_page(viewport={'width':width,'height':height})
                local_errors=[];page.on('pageerror',lambda e,sink=local_errors:sink.append(str(e)))
                try:
                    page.set_content(html,wait_until='domcontentloaded',timeout=60000);wait_for_ui_ready(page)
                    page.evaluate("document.getElementById('loginScreen')?.classList.add('hidden');document.getElementById('appShell')?.classList.remove('hidden');document.body.classList.remove('auth-required');")
                    # Project page: the long-table viewport should use the available screen height.
                    page.evaluate("document.querySelector('.nav-item[data-view=\"projects\"]')?.click()");wait_for_layout(page,14)
                    project=page.eval_on_selector('.project-list-table-wrap','''wrap=>{const r=wrap.getBoundingClientRect(),table=wrap.querySelector('table'),guard=document.querySelector('.demo-disclaimer,.production-guard-banner');const gr=guard?.getBoundingClientRect();return {clientHeight:wrap.clientHeight,scrollHeight:wrap.scrollHeight,top:r.top,bottom:r.bottom,gapToViewport:innerHeight-r.bottom,gapToGuard:gr?Math.max(0,gr.top-r.bottom):null,rowCount:table?.tBodies?.[0]?.rows?.length||0,visibleRows:[...(table?.tBodies?.[0]?.rows||[])].filter(row=>{const q=row.getBoundingClientRect();return q.bottom>r.top&&q.top<r.bottom}).length,topScroller:!!document.querySelector('.table-scroll-top'),hint:!!document.querySelector('.table-scroll-hint')};}''')
                    project_issues=[]
                    if project['clientHeight']<500 and height>=900: project_issues.append(f'project viewport too short: {project["clientHeight"]}')
                    if project['gapToViewport']>100: project_issues.append(f'excess blank below project table: {project["gapToViewport"]}')
                    if project['visibleRows']<7: project_issues.append(f'not enough visible project rows: {project["visibleRows"]}')
                    if project['topScroller'] or project['hint']: project_issues.append('legacy top scroller/hint visible on project table')
                    if width==1792:
                        shot=OUT/'v4549-project-expanded-viewport.png';page.screenshot(path=str(shot),full_page=False);screenshots.append(str(shot))
                    records.append({'viewport':[width,height],'view':'projects','metrics':project,'issues':project_issues,'passed':not project_issues})
                    # Payroll page: only the native bottom scrollbar remains and is functional.
                    page.evaluate("document.querySelector('.nav-item[data-view=\"payroll\"]')?.click()");wait_for_layout(page,14)
                    payroll=page.eval_on_selector('.payroll-detail-wrap','''wrap=>{const before=wrap.scrollLeft,maximum=wrap.scrollWidth-wrap.clientWidth;wrap.scrollLeft=Math.min(420,maximum);wrap.dispatchEvent(new Event('scroll'));const after=wrap.scrollLeft;return {overflow:maximum,scrollMoved:after>before,scrollLeft:after,topScroller:!!document.querySelector('.table-scroll-top'),hint:!!document.querySelector('.table-scroll-hint'),policy:wrap.dataset.horizontalScrollbar||'',headerSticky:getComputedStyle(wrap.querySelector('thead th')).position==='sticky'};}''')
                    payroll_issues=[]
                    if payroll['overflow']<=100: payroll_issues.append('payroll table no longer horizontally scrollable')
                    if not payroll['scrollMoved']: payroll_issues.append('native bottom horizontal scroll is not functional')
                    if payroll['topScroller'] or payroll['hint']: payroll_issues.append('duplicated top scrollbar/hint still exists')
                    if payroll['policy']!='native-bottom-only': payroll_issues.append(f'wrong scrollbar policy: {payroll["policy"]}')
                    if not payroll['headerSticky']: payroll_issues.append('payroll header is not sticky')
                    if width==1792:
                        shot=OUT/'v4549-payroll-bottom-scroll-only.png';page.screenshot(path=str(shot),full_page=False);screenshots.append(str(shot))
                    records.append({'viewport':[width,height],'view':'payroll','metrics':payroll,'issues':payroll_issues,'passed':not payroll_issues})
                    errors.extend(local_errors)
                finally:
                    page.close()
        finally:
            browser.close()
    summary={'releaseVersion':RELEASE_VERSION,'states':len(records),'passedStates':sum(x['passed'] for x in records),'failedStates':sum(not x['passed'] for x in records),'runtimeErrors':errors,'screenshots':screenshots,'passed':all(x['passed'] for x in records) and not errors}
    (OUT/'table-viewport-browser-audit.json').write_text(json.dumps({'summary':summary,'records':records},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(summary,ensure_ascii=False))
    if not summary['passed']: raise SystemExit(1)

if __name__=='__main__': main()
