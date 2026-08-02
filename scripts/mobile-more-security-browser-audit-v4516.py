#!/usr/bin/env python3
"""Confirm the 360/390/430 mobile More navigation exposes and activates Security Center."""
from __future__ import annotations
import base64, json, re
from pathlib import Path
from playwright.sync_api import sync_playwright
from qa_release_context import RELEASE_VERSION, RELEASE_FILE_TOKEN, evidence_dir, launch_chromium
ROOT=Path(__file__).resolve().parents[1]
OUT=evidence_dir('ui')

def inline_application():
    html=(ROOT/'index.html').read_text(encoding='utf-8');css=(ROOT/'alpha-design-system.css').read_text(encoding='utf-8')
    html=re.sub(r'<link rel="stylesheet" href="alpha-design-system\.css"\s*/?>',f'<style>{css}</style>',html)
    for src in re.findall(r'<script src="([^"]+)"></script>',html):
        path=ROOT/src
        if path.exists(): html=html.replace(f'<script src="{src}"></script>',f'<script>\n{path.read_text(encoding="utf-8")}\n</script>',1)
    for name in ('logo-alpha-on-dark.png','logo-alpha-transparent.png','icon-192.png','icon-512.png'):
        path=ROOT/name;html=html.replace(name,'data:image/png;base64,'+base64.b64encode(path.read_bytes()).decode())
    html=html.replace('localStorage','window.alphaStorage').replace('sessionStorage','window.alphaSessionStorage')
    memory='''<script>function makeAlphaStorage(){let store={};return {getItem:k=>Object.prototype.hasOwnProperty.call(store,k)?store[k]:null,setItem:(k,v)=>{store[k]=String(v)},removeItem:k=>{delete store[k]},clear:()=>{store={}},key:i=>Object.keys(store)[i]||null,get length(){return Object.keys(store).length}};}window.alphaStorage=makeAlphaStorage();window.alphaSessionStorage=makeAlphaStorage();</script>'''
    return html.replace('<head>','<head>'+memory,1)

def main():
    records=[];html=inline_application()
    with sync_playwright() as p:
        browser=launch_chromium(p)
        for width,height in ((360,800),(390,844),(430,932)):
            for theme in ('light','dark'):
                page=browser.new_page(viewport={'width':width,'height':height})
                errors=[];page.on('pageerror',lambda exc,bucket=errors:bucket.append(str(exc)))
                page.set_content(html,wait_until='load',timeout=60_000)
                page.evaluate("theme=>document.documentElement.setAttribute('data-theme',theme)",theme)
                page.click('[data-demo-login="director.demo@alpha.local"]')
                page.wait_for_timeout(200)
                page.click('#mobileMore')
                page.wait_for_timeout(150)
                security=page.locator("#nav .nav-item[data-view='security-center']")
                security.scroll_into_view_if_needed(timeout=5_000)
                before=page.evaluate('''() => {const nav=document.querySelector('#nav'),item=document.querySelector("#nav [data-view='security-center']"),r=item.getBoundingClientRect();return {sidebarOpen:document.querySelector('#sidebar').classList.contains('open'),moreMode:document.body.classList.contains('mobile-more-open'),navScrollable:nav.scrollHeight>nav.clientHeight,navScrollTop:nav.scrollTop,itemVisible:r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight};}''')
                security.click(timeout=5_000)
                page.wait_for_timeout(150)
                after=page.evaluate('''() => ({hash:location.hash,title:document.querySelector('#pageTitle')?.textContent?.trim(),sidebarOpen:document.querySelector('#sidebar').classList.contains('open'),moreMode:document.body.classList.contains('mobile-more-open')})''')
                passed=before['sidebarOpen'] and before['moreMode'] and before['itemVisible'] and after['hash']=='#security-center' and after['title']=='Trung tâm bảo mật' and not after['sidebarOpen'] and not after['moreMode'] and not errors
                records.append({'width':width,'height':height,'theme':theme,'before':before,'after':after,'errors':errors,'passed':passed})
                page.close()
        browser.close()
    summary={'releaseVersion':RELEASE_VERSION,'statesAudited':len(records),'passedStates':sum(1 for r in records if r['passed']),'failedStates':sum(1 for r in records if not r['passed']),'passed':all(r['passed'] for r in records)}
    (OUT/'mobile-more-security-audit.json').write_text(json.dumps({'summary':summary,'records':records},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(summary,ensure_ascii=False,indent=2))
    if not summary['passed']: raise SystemExit(1)
if __name__=='__main__': main()
