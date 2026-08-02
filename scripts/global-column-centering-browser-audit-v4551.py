#!/usr/bin/env python3
from __future__ import annotations
import base64, json, re
from pathlib import Path
from playwright.sync_api import sync_playwright
from qa_release_context import RELEASE_VERSION, evidence_dir, launch_chromium, wait_for_layout, wait_for_ui_ready, navigate_view

ROOT=Path(__file__).resolve().parents[1]
OUT=evidence_dir('global-column-centering-v4551')
VIEWS=['dashboard','tasks','projects','controls','documents','commercial','planning','procurement','crm','approvals','people','timesheets','payroll','finance','financialAnalytics','accounting','tax','cloud-admin','readiness','security-center','users','audit','storage','integrations','exports','settings']
TAB_SELECTORS=['[data-control-tab]','[data-procurement-tab]','[data-accounting-tab]','[data-financial-tab]','[data-export-tab]']


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
    storage='''<script>function makeAlphaStorage(){let store={};return {getItem:k=>Object.prototype.hasOwnProperty.call(store,k)?store[k]:null,setItem:(k,v)=>{store[k]=String(v)},removeItem:k=>{delete store[k]},clear:()=>{store={}},key:i=>Object.keys(store)[i]||null,get length(){return Object.keys(store).length}};}window.alphaStorage=makeAlphaStorage();window.alphaSessionStorage=makeAlphaStorage();window.confirm=()=>false;window.alert=()=>{};</script>'''
    return h.replace('<head>','<head>'+storage,1)


def audit_visible_tables(page, state):
    result=page.evaluate(r'''state=>{
      const visible=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'};
      const tables=[...document.querySelectorAll('.table-wrap table')].filter(visible);
      const issues=[];let headers=0,cells=0,controls=0,flexChildren=0;
      const sample=[];
      tables.forEach((table,tableIndex)=>{
        const label=(table.querySelector('thead')?.innerText||table.className||`table-${tableIndex}`).replace(/\s+/g,' ').trim().slice(0,140);
        [...table.querySelectorAll('thead th')].filter(visible).forEach((cell,index)=>{
          headers++;const cs=getComputedStyle(cell);
          if(cs.textAlign!=='center'||cs.verticalAlign!=='middle')issues.push({kind:'header',table:label,index,text:cell.textContent.trim().slice(0,80),textAlign:cs.textAlign,verticalAlign:cs.verticalAlign});
        });
        [...table.querySelectorAll('tbody td,tfoot td')].filter(visible).forEach((cell,index)=>{
          cells++;const cs=getComputedStyle(cell);
          if(cs.textAlign!=='center'||cs.verticalAlign!=='middle')issues.push({kind:'cell',table:label,index,text:cell.textContent.replace(/\s+/g,' ').trim().slice(0,80),textAlign:cs.textAlign,verticalAlign:cs.verticalAlign});
          [...cell.querySelectorAll('input,select,textarea,button')].filter(visible).forEach(control=>{
            controls++;const c=getComputedStyle(control);
            if(c.textAlign!=='center')issues.push({kind:'control',table:label,tag:control.tagName,text:control.value||control.textContent.trim().slice(0,60),textAlign:c.textAlign});
          });
          [...cell.children].filter(visible).forEach(child=>{
            const c=getComputedStyle(child);
            if(['flex','inline-flex','grid','inline-grid'].includes(c.display)){
              flexChildren++;
              if(c.justifyContent!=='center'&&!child.matches('button,input,select,textarea'))issues.push({kind:'direct-layout-child',table:label,tag:child.tagName,className:child.className||'',text:child.textContent.replace(/\s+/g,' ').trim().slice(0,60),display:c.display,justifyContent:c.justifyContent});
            }
          });
        });
        sample.push({label,className:table.className,headers:table.querySelectorAll('thead th').length,cells:table.querySelectorAll('tbody td,tfoot td').length});
      });
      return {state,tableCount:tables.length,headers,cells,controls,flexChildren,issues:issues.slice(0,80),issueCount:issues.length,sample};
    }''', state)
    result['passed']=result['issueCount']==0
    return result


def main():
    OUT.mkdir(parents=True,exist_ok=True)
    records=[];runtime_errors=[]
    with sync_playwright() as p:
        browser=launch_chromium(p)
        try:
            page=browser.new_page(viewport={'width':1792,'height':1000})
            page.on('pageerror',lambda e: runtime_errors.append(str(e)))
            page.set_content(inline_application(),wait_until='domcontentloaded',timeout=60000)
            wait_for_ui_ready(page)
            for view in VIEWS:
                navigate_view(page,view)
                records.append(audit_visible_tables(page,{'view':view,'tab':'default'}))
                for selector in TAB_SELECTORS:
                    tabs=page.locator(selector)
                    for i in range(tabs.count()):
                        tab=tabs.nth(i)
                        if not tab.is_visible(): continue
                        key=tab.get_attribute('data-control-tab') or tab.get_attribute('data-procurement-tab') or tab.get_attribute('data-accounting-tab') or tab.get_attribute('data-financial-tab') or tab.get_attribute('data-export-tab') or str(i)
                        tab.click(force=True);wait_for_layout(page,55)
                        records.append(audit_visible_tables(page,{'view':view,'tab':key}))
        finally:
            browser.close()
    summary={
      'releaseVersion':RELEASE_VERSION,
      'states':len(records),
      'passedStates':sum(r['passed'] for r in records),
      'failedStates':sum(not r['passed'] for r in records),
      'tablesAudited':sum(r['tableCount'] for r in records),
      'headersAudited':sum(r['headers'] for r in records),
      'cellsAudited':sum(r['cells'] for r in records),
      'controlsAudited':sum(r['controls'] for r in records),
      'runtimeErrors':runtime_errors,
      'passed':all(r['passed'] for r in records) and not runtime_errors
    }
    output={'summary':summary,'records':records}
    (OUT/'global-column-centering-browser-audit.json').write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(summary,ensure_ascii=False))
    if not summary['passed']:
        failing=[r for r in records if not r['passed']][:5]
        print(json.dumps(failing,ensure_ascii=False,indent=2))
        raise SystemExit(1)

if __name__=='__main__': main()
