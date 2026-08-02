#!/usr/bin/env python3
from __future__ import annotations
import base64, json, re
from pathlib import Path
from playwright.sync_api import sync_playwright
from qa_release_context import RELEASE_VERSION, RELEASE_FILE_TOKEN, evidence_dir, launch_chromium
ROOT=Path(__file__).resolve().parents[1]
OUT=evidence_dir('ui')
VIEWPORTS=[(1792,1000),(1536,1000),(1440,1000),(1280,900),(1024,900)]

def inline_application():
    html=(ROOT/'index.html').read_text(encoding='utf-8')
    css=(ROOT/'alpha-design-system.css').read_text(encoding='utf-8')
    html=re.sub(r'<link rel="stylesheet" href="alpha-design-system\.css"\s*/?>',f'<style>{css}</style>',html)
    for src in re.findall(r'<script src="([^"]+)"></script>',html):
        p=ROOT/src
        if p.exists(): html=html.replace(f'<script src="{src}"></script>',f'<script>\n{p.read_text(encoding="utf-8")}\n</script>',1)
    for name in ('logo-alpha-on-dark.png','logo-alpha-transparent.png','icon-192.png','icon-512.png'):
        p=ROOT/name
        html=html.replace(name,'data:image/png;base64,'+base64.b64encode(p.read_bytes()).decode())
    html=html.replace('localStorage','window.alphaStorage').replace('sessionStorage','window.alphaSessionStorage')
    storage='''<script>function makeAlphaStorage(){let store={};return {getItem:k=>Object.prototype.hasOwnProperty.call(store,k)?store[k]:null,setItem:(k,v)=>{store[k]=String(v)},removeItem:k=>{delete store[k]},clear:()=>{store={}},key:i=>Object.keys(store)[i]||null,get length(){return Object.keys(store).length}};}window.alphaStorage=makeAlphaStorage();window.alphaSessionStorage=makeAlphaStorage();</script>'''
    return html.replace('<head>','<head>'+storage,1)

CHECK_JS="""() => {
 const grid=document.querySelector('.accounting-report-grid');
 const left=document.querySelector('.accounting-management-result-card');
 const right=document.querySelector('.accounting-project-profit-card');
 const lt=document.querySelector('.accounting-management-result-table');
 const rt=document.querySelector('.accounting-project-profit-table');
 const lw=document.querySelector('.accounting-management-result-wrap');
 const rw=document.querySelector('.accounting-project-profit-wrap');
 const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}};
 const numericWraps=[...rt.querySelectorAll('td.numeric')].filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>({text:e.textContent.trim(),scrollWidth:e.scrollWidth,clientWidth:e.clientWidth}));
 const headingWraps=[...rt.querySelectorAll('th')].filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>({text:e.textContent.trim(),scrollWidth:e.scrollWidth,clientWidth:e.clientWidth}));
 return {
  viewport:innerWidth,
  gridTemplate:getComputedStyle(grid).gridTemplateColumns,
  grid:rect(grid),left:rect(left),right:rect(right),
  leftTable:rect(lt),rightTable:rect(rt),
  leftOverflow:Math.max(0,lw.scrollWidth-lw.clientWidth),
  rightOverflow:Math.max(0,rw.scrollWidth-rw.clientWidth),
  numericWraps,headingWraps,
  bodyOverflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth,
  sameTop:Math.abs(left.getBoundingClientRect().top-right.getBoundingClientRect().top)<1,
  stacked:Math.abs(right.getBoundingClientRect().top-left.getBoundingClientRect().bottom)>=8,
  desktopFit:innerWidth<1025 || (Math.max(0,lw.scrollWidth-lw.clientWidth)===0 && Math.max(0,rw.scrollWidth-rw.clientWidth)===0 && numericWraps.length===0 && headingWraps.length===0)
 };
}"""

def main():
    html=inline_application(); records=[]; errors=[]
    with sync_playwright() as p:
        browser=launch_chromium(p)
        for width,height in VIEWPORTS:
            for theme in ('light','dark'):
                page=browser.new_page(viewport={'width':width,'height':height})
                page_errors=[]; page.on('pageerror',lambda e,b=page_errors:b.append(str(e)))
                page.set_content(html,wait_until='load',timeout=60000)
                page.evaluate("document.getElementById('loginScreen')?.classList.add('hidden');document.getElementById('appShell')?.classList.remove('hidden');document.body.classList.remove('auth-required')")
                page.evaluate("theme=>document.documentElement.setAttribute('data-theme',theme)",theme)
                page.evaluate("document.querySelector(\".nav-item[data-view='accounting']\")?.click()")
                page.evaluate("document.querySelector(\"[data-accounting-tab='reports']\")?.click()")
                page.wait_for_timeout(100)
                rec=page.evaluate(CHECK_JS); rec.update({'width':width,'height':height,'theme':theme,'pageErrors':page_errors})
                rec['passed']=rec['desktopFit'] and rec['bodyOverflow']<=2 and rec['stacked'] and not page_errors
                records.append(rec)
                if width in (1792,1440,1024) and theme=='light':
                    grid=page.locator('.accounting-report-grid')
                    grid.scroll_into_view_if_needed()
                    page.wait_for_timeout(50)
                    grid.screenshot(path=str(OUT/f'accounting-report-cards-{width}-light.png'))
                page.close()
        browser.close()
    summary={'releaseVersion':RELEASE_VERSION,'states':len(records),'passedStates':sum(r['passed'] for r in records),'failedStates':sum(not r['passed'] for r in records),'passed':all(r['passed'] for r in records)}
    (OUT/'accounting-report-layout-audit.json').write_text(json.dumps({'summary':summary,'records':records},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(summary,ensure_ascii=False))
    if not summary['passed']: raise SystemExit(1)
if __name__=='__main__': main()
