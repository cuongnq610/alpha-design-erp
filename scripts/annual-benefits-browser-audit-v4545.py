#!/usr/bin/env python3
from __future__ import annotations
import base64, json, re
from pathlib import Path
from playwright.sync_api import sync_playwright
from qa_release_context import RELEASE_VERSION, evidence_dir, launch_chromium, wait_for_layout, wait_for_ui_ready

ROOT=Path(__file__).resolve().parents[1]
OUT=evidence_dir('annual-benefits-v4545')
VIEWPORTS=[(1440,1000),(1280,900),(820,1180),(390,844)]

def inline_application():
    h=(ROOT/'index.html').read_text(encoding='utf-8')
    css=(ROOT/'alpha-design-system.css').read_text(encoding='utf-8')
    h=re.sub(r'<link rel="stylesheet" href="alpha-design-system\.css"\s*/?>',f'<style>{css}</style>',h)
    for src in re.findall(r'<script src="([^"]+)"></script>',h):
        p=ROOT/src
        if p.exists(): h=h.replace(f'<script src="{src}"></script>',f'<script>\n{p.read_text(encoding="utf-8")}\n</script>',1)
    for name in ('logo-alpha-on-dark.png','logo-alpha-transparent.png','icon-192.png','icon-512.png'):
        p=ROOT/name; h=h.replace(name,'data:image/png;base64,'+base64.b64encode(p.read_bytes()).decode())
    h=h.replace('localStorage','window.alphaStorage').replace('sessionStorage','window.alphaSessionStorage')
    storage='''<script>function makeAlphaStorage(){let store={};return {getItem:k=>Object.prototype.hasOwnProperty.call(store,k)?store[k]:null,setItem:(k,v)=>{store[k]=String(v)},removeItem:k=>{delete store[k]},clear:()=>{store={}},key:i=>Object.keys(store)[i]||null,get length(){return Object.keys(store).length}};}window.alphaStorage=makeAlphaStorage();window.alphaSessionStorage=makeAlphaStorage();</script>'''
    return h.replace('<head>','<head>'+storage,1)

AUDIT='''() => {
 const section=document.querySelector('.annual-benefit-section');
 if(!section)return {missing:true};
 const visible=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>.5&&r.height>.5&&s.display!=='none'&&s.visibility!=='hidden'};
 const buttons=[...section.querySelectorAll('button')].filter(visible).map(x=>x.textContent.trim());
 const kpis=[...section.querySelectorAll('.kpi-value,.metric-value,.value,strong')].filter(visible).map(x=>x.textContent.trim()).filter(Boolean);
 const tables=[...section.querySelectorAll('.table-wrap')].filter(visible).map(w=>({overflow:w.scrollWidth-w.clientWidth,bodyOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,headers:[...w.querySelectorAll('thead th')].map(x=>x.textContent.trim()),rows:w.querySelectorAll('tbody tr').length}));
 const select=section.querySelector('#annualBenefitYearSelect');
 return {missing:false,title:section.textContent.includes('Ngân sách thưởng tháng lương 13 và quỹ du lịch'),buttons,kpis,tables,year:select?.value||'',bodyOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,sectionWidth:section.getBoundingClientRect().width,viewport:document.documentElement.clientWidth};
}'''

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    html=inline_application(); records=[]; screenshots=[]
    with sync_playwright() as p:
        browser=launch_chromium(p)
        try:
            page=browser.new_page(viewport={'width':1440,'height':1000})
            errors=[]; page.on('pageerror',lambda e:errors.append(str(e)))
            page.set_content(html,wait_until='domcontentloaded',timeout=60000); wait_for_ui_ready(page)
            for width,height in VIEWPORTS:
                page.set_viewport_size({'width':width,'height':height})
                for theme in ('light','dark'):
                    page.evaluate("t=>document.documentElement.setAttribute('data-theme',t)",theme)
                    page.evaluate("document.querySelector('.nav-item[data-view=\"payroll\"]')?.click()")
                    wait_for_layout(page,10)
                    result=page.evaluate(AUDIT); issues=[]
                    if result.get('missing'): issues.append({'kind':'missing-section'})
                    else:
                        required=['Cập nhật tính toán','Thiết lập tham số','Soát xét','Phê duyệt','Khóa năm','Xuất CSV']
                        for label in required:
                            if not any(label in b for b in result['buttons']): issues.append({'kind':'missing-button','label':label})
                        if not result['year']: issues.append({'kind':'missing-year'})
                        if result['bodyOverflow']>1: issues.append({'kind':'body-overflow','px':result['bodyOverflow']})
                        if not result['tables'] or not any(t['rows']>0 for t in result['tables']): issues.append({'kind':'missing-detail-rows'})
                        expected=['Mã / Họ tên','Lương bình quân','Tỷ lệ thời gian','Hệ số cá nhân','Hệ số công ty','Thưởng dự kiến','Ngân sách tiền mặt']
                        headers=' | '.join(h for t in result['tables'] for h in t['headers'])
                        for label in expected:
                            if label not in headers: issues.append({'kind':'missing-header','label':label})
                    if errors: issues.append({'kind':'page-errors','errors':errors[:]})
                    records.append({'width':width,'theme':theme,'result':result,'issues':issues,'passed':not issues})
                    if theme=='light' and width in (1440,390) and not result.get('missing'):
                        section=page.locator('.annual-benefit-section')
                        section.scroll_into_view_if_needed()
                        path=OUT/f'annual-benefits-{width}.png'; section.screenshot(path=str(path)); screenshots.append(str(path))
            page.close()
        finally: browser.close()
    summary={'releaseVersion':RELEASE_VERSION,'states':len(records),'passedStates':sum(r['passed'] for r in records),'failedStates':sum(not r['passed'] for r in records),'screenshots':screenshots,'passed':all(r['passed'] for r in records)}
    (OUT/'annual-benefits-browser-audit.json').write_text(json.dumps({'summary':summary,'records':records},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(summary,ensure_ascii=False))
    if not summary['passed']: raise SystemExit(1)

if __name__=='__main__': main()
