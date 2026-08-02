#!/usr/bin/env python3
from __future__ import annotations
import base64, json, re
from pathlib import Path
from playwright.sync_api import sync_playwright
from qa_release_context import RELEASE_VERSION, RELEASE_FILE_TOKEN, evidence_dir, launch_chromium
ROOT=Path(__file__).resolve().parents[1]
OUT=evidence_dir('ui')
VIEWPORTS=[(1280,900),(1440,1000),(1536,1000),(1792,1000)]
THEMES=('light','dark')

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

INIT="""document.getElementById('loginScreen')?.classList.add('hidden');document.getElementById('appShell')?.classList.remove('hidden');document.body.classList.remove('auth-required');"""

JOURNAL_AUDIT="""() => {
 const table=document.querySelector('.table-journals'); const wrap=table?.closest('.table-wrap');
 if(!table||!wrap)return {missing:true};
 const th=table.querySelector('thead th:nth-child(7)'); const rows=[...table.querySelectorAll('tbody tr')];
 const details=rows.map(row=>{const cell=row.cells[6],stack=cell?.querySelector('.journal-status-stack');if(!cell||!stack)return null;const cr=cell.getBoundingClientRect(),sr=stack.getBoundingClientRect(),hr=th.getBoundingClientRect();return {headerCellDelta:Math.abs((hr.left+hr.right)/2-(cr.left+cr.right)/2),stackCellDelta:Math.abs((sr.left+sr.right)/2-(cr.left+cr.right)/2),cellWidth:cr.width,stackWidth:sr.width};}).filter(Boolean);
 return {overflow:wrap.scrollWidth-wrap.clientWidth,headerWidth:th.getBoundingClientRect().width,details};
}"""
TAX_AUDIT="""() => {
 const table=document.querySelector('.table-tax-invoices'); const wrap=table?.closest('.table-wrap');
 if(!table||!wrap)return {missing:true};
 const widths=[...table.querySelectorAll('thead th')].map(x=>x.getBoundingClientRect().width);
 const rows=[...table.querySelectorAll('tbody tr')];
 const overlaps=[];
 rows.forEach((row,ri)=>{const cells=[...row.cells];for(let i=0;i<cells.length-1;i++){const a=cells[i].getBoundingClientRect(),b=cells[i+1].getBoundingClientRect();if(a.right>b.left+.5)overlaps.push({ri,i,delta:a.right-b.left});}});
 return {overflow:wrap.scrollWidth-wrap.clientWidth,widths,overlaps};
}"""

def main():
    html=inline_application(); records=[]
    with sync_playwright() as p:
        browser=launch_chromium(p)
        for width,height in VIEWPORTS:
            for theme in THEMES:
                page=browser.new_page(viewport={'width':width,'height':height})
                errors=[]; page.on('pageerror',lambda e,b=errors:b.append(str(e)))
                page.set_content(html,wait_until='load',timeout=60000);page.evaluate(INIT);page.evaluate("t=>document.documentElement.setAttribute('data-theme',t)",theme);page.wait_for_timeout(80)
                page.evaluate("()=>document.querySelector('.nav-item[data-view=\"accounting\"]')?.click()")
                page.wait_for_timeout(100)
                j=page.evaluate(JOURNAL_AUDIT)
                journal_pass=not j.get('missing') and j['overflow']<=0 and all(d['headerCellDelta']<=1.1 and d['stackCellDelta']<=1.1 for d in j['details'])
                if width==1440 and theme=='light':
                    page.locator('text=Bút toán kế toán gần đây').scroll_into_view_if_needed();page.screenshot(path=str(OUT/'journal-status-aligned-1440-light.png'),full_page=False)
                page.evaluate("()=>document.querySelector('.nav-item[data-view=\"tax\"]')?.click()")
                page.wait_for_timeout(100)
                t=page.evaluate(TAX_AUDIT)
                w=t.get('widths',[])
                tax_pass=(not t.get('missing') and t['overflow']<=0 and len(w)==9 and 74<=w[1]<=94 and w[7]>=132 and 118<=w[8]<=144 and not t['overlaps'])
                if width==1440 and theme=='light':
                    page.locator('text=Hóa đơn VAT cần đối chiếu').scroll_into_view_if_needed();page.screenshot(path=str(OUT/'tax-columns-spaced-1440-light.png'),full_page=False)
                records.append({'width':width,'theme':theme,'journal':j,'tax':t,'errors':errors,'passed':journal_pass and tax_pass and not errors})
                page.close()
        browser.close()
    summary={'releaseVersion':RELEASE_VERSION,'states':len(records),'passedStates':sum(r['passed'] for r in records),'failedStates':sum(not r['passed'] for r in records),'passed':all(r['passed'] for r in records)}
    (OUT/'journal-tax-column-audit.json').write_text(json.dumps({'summary':summary,'records':records},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(summary,ensure_ascii=False))
    if not summary['passed']: raise SystemExit(1)
if __name__=='__main__':main()
