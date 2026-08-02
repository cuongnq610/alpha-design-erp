#!/usr/bin/env python3
from __future__ import annotations
import base64, json, re
from pathlib import Path
from playwright.sync_api import sync_playwright
from qa_release_context import RELEASE_VERSION, evidence_dir, launch_chromium, wait_for_layout, wait_for_ui_ready

ROOT=Path(__file__).resolve().parents[1]
OUT=evidence_dir('sticky-table-workflow-v4546')

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

def inspect_table(page, selector):
    return page.eval_on_selector(selector, '''w=>{
      const table=w.querySelector('table'),headers=[...table.querySelectorAll('thead th')];
      w.scrollTop=Math.min(240,Math.max(0,w.scrollHeight-w.clientHeight));
      const wr=w.getBoundingClientRect(),hr=headers[0]?.getBoundingClientRect();
      const top=w.previousElementSibling?.classList.contains('table-scroll-top')?w.previousElementSibling:null;
      let sync=true;
      if(top&&top.scrollWidth>top.clientWidth){top.scrollLeft=Math.min(300,top.scrollWidth-top.clientWidth);top.dispatchEvent(new Event('scroll'));sync=Math.abs(top.scrollLeft-w.scrollLeft)<=1;}
      const dayCells=[...table.querySelectorAll('tbody tr:first-child td:nth-child(4),tbody tr:first-child td:nth-child(5)')];
      return {frame:w.classList.contains('table-scroll-frame'),scrollTop:w.scrollTop,stickyTop:hr?Math.abs(hr.top-wr.top)<=3:false,headerAligns:headers.map(x=>({text:x.textContent.trim(),align:getComputedStyle(x).textAlign,classes:x.className,tableClasses:table.className})),headersCentered:headers.every(x=>getComputedStyle(x).textAlign==='center'),dayCellsCentered:dayCells.length===0||dayCells.every(x=>getComputedStyle(x).textAlign==='center'),horizontalOverflow:w.scrollWidth-w.clientWidth,horizontalOverflowStyle:getComputedStyle(w).overflowX,topScroller:Boolean(top),horizontalSync:sync,bodyOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
    }''')

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    records=[]; errors=[]; dialogs=[]
    with sync_playwright() as p:
        browser=launch_chromium(p)
        page=browser.new_page(viewport={'width':1440,'height':900},accept_downloads=True)
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('dialog',lambda d:(dialogs.append(d.message),d.accept()))
        page.set_content(inline_application(),wait_until='domcontentloaded',timeout=60000); wait_for_ui_ready(page)
        # Payroll table and workflow.
        page.evaluate("document.querySelector('.nav-item[data-view=\"payroll\"]')?.click()"); wait_for_layout(page,12)
        page.wait_for_selector('.payroll-detail-wrap.table-scroll-frame')
        payroll_layout=inspect_table(page,'.payroll-detail-wrap')
        page.locator('.payroll-detail-wrap').screenshot(path=str(OUT/'payroll-sticky-centered.png'))
        missing_month=page.evaluate('''()=>{const used=new Set((AlphaERP.getDB().payrollPeriods||[]).map(x=>x.month));const sel=document.querySelector('#payrollMonthSelect');return [...sel.options].map(x=>x.value).find(x=>!used.has(x))||sel.value}''')
        page.select_option('#payrollMonthSelect',missing_month); wait_for_layout(page,8)
        page.evaluate("document.querySelector('#approvePayrollPeriod')?.click()"); wait_for_layout(page,2)
        page.evaluate("document.querySelector('#generatePayrollPeriod')?.click()"); wait_for_layout(page,8)
        def payroll_status(): return page.evaluate("m=>(AlphaERP.getDB().payrollPeriods||[]).find(x=>x.month===m)?.status||'missing'",missing_month)
        payroll_states=[payroll_status()]
        for sel in ('#reviewPayrollPeriod','#approvePayrollPeriod','#lockPayrollPeriod'):
            page.click(sel); wait_for_layout(page,8); payroll_states.append(payroll_status())
        # Annual table and workflow on an unused year.
        page.evaluate("document.querySelector('.nav-item[data-view=\"payroll\"]')?.click()"); wait_for_layout(page,8)
        year=page.evaluate('''()=>{const used=new Set((AlphaERP.getDB().annualBenefitBudgets||[]).map(x=>Number(x.year)));const sel=document.querySelector('#annualBenefitYearSelect');return [...sel.options].map(x=>Number(x.value)).find(x=>!used.has(x))||Number(sel.value)}''')
        page.select_option('#annualBenefitYearSelect',str(year)); wait_for_layout(page,8)
        page.evaluate("document.querySelector('#approveAnnualBenefitBudget')?.click()"); wait_for_layout(page,2)
        page.evaluate("document.querySelector('#generateAnnualBenefitBudget')?.click()"); wait_for_layout(page,8)
        def benefit_status(): return page.evaluate("y=>(AlphaERP.getDB().annualBenefitBudgets||[]).find(x=>Number(x.year)===Number(y))?.status||'missing'",year)
        benefit_states=[benefit_status()]
        for sel in ('#reviewAnnualBenefitBudget','#approveAnnualBenefitBudget','#lockAnnualBenefitBudget'):
            page.click(sel); wait_for_layout(page,8); benefit_states.append(benefit_status())
        page.wait_for_selector('.annual-benefit-table-wrap.table-scroll-frame')
        annual_layout=inspect_table(page,'.annual-benefit-table-wrap')
        page.locator('.annual-benefit-table-wrap').screenshot(path=str(OUT/'annual-benefit-sticky-centered.png'))
        # Embedded TT133 download fallback.
        page.evaluate("document.querySelector('.nav-item[data-view=\"settings\"]')?.click()"); wait_for_layout(page,10)
        with page.expect_download(timeout=15000) as download_info:
            page.click('#downloadStatutoryTemplateExample')
        download=download_info.value
        download_path=OUT/download.suggested_filename
        download.save_as(str(download_path))
        parsed=json.loads(download_path.read_text(encoding='utf-8'))
        template_ok=bool(parsed.get('manifest') and parsed.get('reports'))
        result={
          'releaseVersion':RELEASE_VERSION,'payrollLayout':payroll_layout,'annualLayout':annual_layout,
          'payrollStates':payroll_states,'annualStates':benefit_states,'dialogs':dialogs,
          'templateDownload':{'filename':download.suggested_filename,'valid':template_ok},
          'pageErrors':errors
        }
        issues=[]
        for name,data in [('payroll',payroll_layout),('annual',annual_layout)]:
            for key in ('frame','stickyTop','headersCentered','horizontalSync'):
                if not data.get(key): issues.append(f'{name}:{key}')
            if data.get('horizontalOverflow',0)>16 and data.get('horizontalOverflowStyle') not in {'auto','scroll'}: issues.append(f'{name}:horizontalScroll')
            if data.get('bodyOverflow',0)>1: issues.append(f'{name}:bodyOverflow={data["bodyOverflow"]}')
        if not payroll_layout.get('dayCellsCentered'): issues.append('payroll:dayCellsCentered')
        if payroll_states!=['Draft','Reviewed','Approved','Locked']: issues.append(f'payrollStates={payroll_states}')
        if benefit_states!=['Draft','Reviewed','Approved','Locked']: issues.append(f'annualStates={benefit_states}')
        if not template_ok: issues.append('templateDownload')
        if not any('Cần tạo' in x or 'trước' in x for x in dialogs): issues.append('workflowPrerequisiteFeedback')
        if errors: issues.append('pageErrors')
        result['issues']=issues; result['passed']=not issues
        (OUT/'sticky-table-workflow-browser-audit.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        print(json.dumps({'releaseVersion':RELEASE_VERSION,'passed':not issues,'issues':issues,'payrollStates':payroll_states,'annualStates':benefit_states},ensure_ascii=False))
        page.close(); browser.close()
        if issues: raise SystemExit(1)

if __name__=='__main__': main()
