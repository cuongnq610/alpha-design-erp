#!/usr/bin/env python3
from __future__ import annotations
import base64, json, re
from pathlib import Path
from playwright.sync_api import sync_playwright
from qa_release_context import RELEASE_VERSION, evidence_dir, launch_chromium, wait_for_layout, wait_for_ui_ready
ROOT=Path(__file__).resolve().parents[1]
OUT=evidence_dir('ui')
VIEWPORTS=[(1280,900),(1440,1000),(1536,1000),(1792,1000)]

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

INIT="""document.getElementById('loginScreen')?.classList.add('hidden');document.getElementById('appShell')?.classList.remove('hidden');document.body.classList.remove('auth-required');"""
AUDIT=r'''() => {
 const visible=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>.5&&r.height>.5&&s.display!=='none'&&s.visibility!=='hidden'};
 const tables=[];
 [...document.querySelectorAll('.table-wrap')].filter(visible).forEach((wrap,index)=>{
  const table=wrap.querySelector('table');if(!table)return;
  const headers=[...table.querySelectorAll('thead th')];const columns=headers.length;
  const rows=[...table.querySelectorAll('tbody tr')];
  const simpleHeader=headers.length===columns&&headers.every(cell=>Number(cell.colSpan||1)===1&&Number(cell.rowSpan||1)===1);
  const comparableRows=simpleHeader?rows.filter(row=>row.cells.length===columns&&[...row.cells].every(cell=>Number(cell.colSpan||1)===1&&Number(cell.rowSpan||1)===1)).slice(0,20):[];
  const gridAlignment=[];
  if(simpleHeader){
    headers.forEach((header,columnIndex)=>{
      const hr=header.getBoundingClientRect();
      comparableRows.forEach((row,rowIndex)=>{
        const cr=row.cells[columnIndex].getBoundingClientRect();
        gridAlignment.push({column:columnIndex,row:rowIndex,leftDelta:Math.abs(hr.left-cr.left),rightDelta:Math.abs(hr.right-cr.right),widthDelta:Math.abs(hr.width-cr.width)});
      });
    });
  }
  const actionIndex=headers.findIndex((h,i)=>i===headers.length-1&&(/thao tác|hành động|action/i.test(h.textContent)||rows.some(r=>r.cells[i]?.querySelector('button,[role="button"],.table-lock-state'))));
  const actionRows=actionIndex>=0?rows.filter(r=>r.cells[actionIndex]?.querySelector('button,[role="button"],.table-lock-state')):[];
  const actionAlignment=[];const overlaps=[];
  if(actionIndex>=0){
   const hr=headers[actionIndex].getBoundingClientRect(),headerCenter=(hr.left+hr.right)/2;
   actionRows.forEach((row,rowIndex)=>{
    const cell=row.cells[actionIndex],group=cell.querySelector('.table-action-group')||cell;
    const gr=group.getBoundingClientRect(),cellRect=cell.getBoundingClientRect();
    actionAlignment.push({row:rowIndex,headerDelta:Math.abs(headerCenter-(cellRect.left+cellRect.right)/2),groupDelta:Math.abs((gr.left+gr.right)/2-(cellRect.left+cellRect.right)/2),cellOverflow:cell.scrollWidth-cell.clientWidth});
    const buttons=[...cell.querySelectorAll('button,[role="button"]')].filter(visible);
    for(let i=0;i<buttons.length;i++)for(let j=i+1;j<buttons.length;j++){
      const a=buttons[i].getBoundingClientRect(),b=buttons[j].getBoundingClientRect();
      if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>.5&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>.5)overlaps.push({row:rowIndex,a:buttons[i].textContent.trim(),b:buttons[j].textContent.trim()});
    }
   });
  }
  const clipped=[...table.querySelectorAll('th,td')].filter(visible).filter(cell=>cell.scrollWidth>cell.clientWidth+1&&getComputedStyle(cell).overflow!=='visible').map(cell=>({text:cell.textContent.trim().slice(0,60),delta:cell.scrollWidth-cell.clientWidth}));
  const scrollRegion=wrap.classList.contains('is-scrollable')&&wrap.getAttribute('role')==='region'&&wrap.tabIndex===0;
  tables.push({index,columns,overflow:wrap.scrollWidth-wrap.clientWidth,bodyWidth:table.getBoundingClientRect().width,wrapWidth:wrap.clientWidth,actionIndex,actionHeader:actionIndex>=0?headers[actionIndex].textContent.trim():'',actionAlignment,gridAlignment,overlaps,clipped,auto:table.classList.contains('table-auto-columns'),gridClass:table.classList.contains('table-grid-exact'),gridContract:table.dataset.gridContract||'',scrollRegion,hasColgroup:Boolean(table.querySelector(':scope > colgroup')),simpleHeader});
 });
 return {tables,bodyOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
}'''


def main():
    html=inline_application();records=[];view_names=[]
    batch_js=f"""async views => {{
      const audit={AUDIT};
      const rows=[];
      for(const view of views){{
        const el=document.querySelector(`.nav-item[data-view="${{view}}"]`);
        if(!el){{rows.push({{view,runnerError:`Missing navigation item: ${{view}}`}});continue;}}
        el.click();
        await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
        const active=document.querySelector('.nav-item.active')?.dataset.view;
        if(active!==view){{rows.push({{view,runnerError:`Navigation did not activate ${{view}}`}});continue;}}
        rows.push({{view,...audit()}});
      }}
      return rows;
    }}"""
    with sync_playwright() as p:
      browser=launch_chromium(p)
      try:
        # Rotate the page after two viewports and audit one view per round-trip.
        # This keeps the full 208-state matrix while preventing accumulated
        # chart observers from making Chromium nondeterministically time out.
        for group_start in range(0,len(VIEWPORTS),2):
          group=VIEWPORTS[group_start:group_start+2]
          page=browser.new_page(viewport={'width':group[0][0],'height':group[0][1]})
          errors=[];page.on('pageerror',lambda e,sink=errors:sink.append(str(e)))
          try:
            page.set_content(html,wait_until='domcontentloaded',timeout=60000);wait_for_ui_ready(page)
            current_views=page.evaluate("[...new Set([...document.querySelectorAll('.nav-item[data-view]')].map(x=>x.dataset.view))]")
            if not view_names:view_names=current_views
            elif current_views!=view_names:
              records.append({'width':group[0][0],'theme':'__setup__','view':'__runtime__','issues':[{'kind':'runner','message':'Navigation set changed between viewport sessions'}],'bodyOverflow':0,'errors':[],'passed':False})
            for width,height in group:
              page.set_viewport_size({'width':width,'height':height})
              for theme in ('light','dark'):
                page.evaluate("t=>document.documentElement.setAttribute('data-theme',t)",theme);wait_for_layout(page,10)
                before=len(errors)
                for view in current_views:
                  result=page.evaluate(f"""async view=>{{
                    const audit={AUDIT};
                    const el=document.querySelector(`.nav-item[data-view=\"${{view}}\"]`);
                    if(!el)return {{runnerError:`Missing navigation item: ${{view}}`}};
                    el.click();
                    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
                    const active=document.querySelector('.nav-item.active')?.dataset.view;
                    if(active!==view)return {{runnerError:`Navigation did not activate ${{view}}`}};
                    return audit();
                  }}""",view)
                  issues=[]
                  if result.get('runnerError'):
                    issues.append({'kind':'runner','message':result['runnerError']})
                  for t in result.get('tables',[]):
                    if not t.get('gridClass'):issues.append({'kind':'grid-class','table':t})
                    if t.get('simpleHeader') and not t.get('hasColgroup'):issues.append({'kind':'missing-colgroup','table':t})
                    if any(x['leftDelta']>1.25 or x['rightDelta']>1.25 or x['widthDelta']>1.25 for x in t.get('gridAlignment',[])):issues.append({'kind':'column-grid-alignment','table':t})
                    authored_scroll=t.get('gridContract')=='authored' and t.get('scrollRegion')
                    if t['columns']<=12 and t['overflow']>0 and not authored_scroll:issues.append({'kind':'fit','table':t})
                    if t['actionIndex']>=0:
                      if not re.search(r'thao tác',t['actionHeader'],re.I):issues.append({'kind':'heading','table':t})
                      if t['overlaps']:issues.append({'kind':'overlap','table':t})
                      if any(x['headerDelta']>1.1 or x['groupDelta']>1.1 or x['cellOverflow']>1 for x in t['actionAlignment']):issues.append({'kind':'alignment','table':t})
                    if t['clipped']:issues.append({'kind':'clipped','table':t})
                  records.append({'width':width,'theme':theme,'view':view,'issues':issues,'bodyOverflow':result.get('bodyOverflow',0),'errors':[],'passed':not issues and result.get('bodyOverflow',0)<=1})
                runtime_errors=errors[before:]
                if runtime_errors:
                  records.append({'width':width,'theme':theme,'view':'__runtime__','issues':[],'bodyOverflow':0,'errors':runtime_errors,'passed':False})
                if width==1440 and theme=='light':
                  page.evaluate("document.querySelector('.nav-item[data-view=\"commercial\"]')?.click()")
                  wait_for_layout(page,10)
                  target=page.locator('text=Lịch thanh toán hợp đồng')
                  if target.count():target.scroll_into_view_if_needed()
                  page.screenshot(path=str(OUT/'commercial-payment-schedule-columns-1440-light.png'),full_page=False)
          finally:
            page.close()
      finally:
        browser.close()
    summary={'releaseVersion':RELEASE_VERSION,'views':len(view_names),'states':sum(1 for r in records if r['view']!='__runtime__'),'passedStates':sum(r['passed'] for r in records if r['view']!='__runtime__'),'failedStates':sum(not r['passed'] for r in records),'authenticatedDemoSession':True,'passed':all(r['passed'] for r in records)}
    (OUT/'global-table-column-action-audit.json').write_text(json.dumps({'summary':summary,'records':records},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(summary,ensure_ascii=False))
    if not summary['passed']:raise SystemExit(1)

if __name__=='__main__':main()
