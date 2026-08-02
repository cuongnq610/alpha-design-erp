#!/usr/bin/env python3
from __future__ import annotations
import base64, json, re
from pathlib import Path
from playwright.sync_api import sync_playwright
from qa_release_context import RELEASE_VERSION, evidence_dir, launch_chromium, wait_for_ui_ready, navigate_view, wait_for_layout

ROOT=Path(__file__).resolve().parents[1]
OUT=evidence_dir('ui-tax-accounting-refinement-v4556')

def inline_application():
    h=(ROOT/'index.html').read_text(encoding='utf-8')
    css=(ROOT/'alpha-design-system.css').read_text(encoding='utf-8')
    h=re.sub(r'<link rel="stylesheet" href="alpha-design-system\.css"\s*/?>',f'<style>{css}</style>',h)
    for src in re.findall(r'<script src="([^"]+)"></script>',h):
        p=ROOT/src
        if p.exists():
            h=h.replace(f'<script src="{src}"></script>',f'<script>\n{p.read_text(encoding="utf-8")}\n</script>',1)
    for name in ('logo-alpha-on-dark.png','logo-alpha-transparent.png','icon-192.png','icon-512.png'):
        p=ROOT/name
        h=h.replace(name,'data:image/png;base64,'+base64.b64encode(p.read_bytes()).decode())
    h=h.replace('localStorage','window.alphaStorage').replace('sessionStorage','window.alphaSessionStorage')
    storage='''<script>function makeAlphaStorage(){let store={};return {getItem:k=>Object.prototype.hasOwnProperty.call(store,k)?store[k]:null,setItem:(k,v)=>{store[k]=String(v)},removeItem:k=>{delete store[k]},clear:()=>{store={}},key:i=>Object.keys(store)[i]||null,get length(){return Object.keys(store).length}};}window.alphaStorage=makeAlphaStorage();window.alphaSessionStorage=makeAlphaStorage();window.confirm=()=>true;window.alert=()=>{};</script>'''
    return h.replace('<head>','<head>'+storage,1)

def one_row(page, selector, tolerance=4):
    boxes=page.locator(selector).evaluate_all("els=>els.filter(e=>e.offsetParent!==null).map(e=>{const r=e.getBoundingClientRect();return {top:r.top,left:r.left,width:r.width,height:r.height}})")
    if len(boxes)<2: return False, boxes
    return max(x['top'] for x in boxes)-min(x['top'] for x in boxes)<=tolerance, boxes

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    result={'releaseVersion':RELEASE_VERSION}; errors=[]
    with sync_playwright() as p:
        browser=launch_chromium(p)
        try:
            page=browser.new_page(viewport={'width':1792,'height':1000})
            page.on('pageerror',lambda e:errors.append(str(e)))
            page.set_default_timeout(15000)
            page.set_content(inline_application(),wait_until='domcontentloaded',timeout=60000)
            wait_for_ui_ready(page)

            navigate_view(page,'tax'); wait_for_layout(page,120)
            tax_text=page.locator('#content').inner_text()
            result['taxHeadingYear2026']='Lịch thuế 2026 & nhắc việc' in tax_text
            result['taxInternalVersionHidden']='2026.02-reference' not in tax_text and '2026.03-controlled' not in tax_text
            tax_lower=tax_text.lower()
            result['taxProvenanceVisible']='nguồn & độ tin cậy:' in tax_lower and 'không truy cập internet' in tax_lower and 'kế toán trưởng phê duyệt' in tax_lower
            result['taxRowsOnlySelectedYear']=all('/2026' in t for t in page.locator('.tax-calendar-row strong').all_inner_texts())
            chart=page.locator('.tax-compliance-grid .chart-card .combo-chart').first
            result['taxChartHeightExpanded']=chart.bounding_box()['height']>=340
            result['taxChartAdaptiveUnit']=page.locator('.tax-compliance-grid .chart-unit-badge').first.inner_text().strip() in {'Đơn vị: tr','Đơn vị: tỷ','tr','tỷ'}
            page.screenshot(path=str(OUT/'01-tax-calendar-and-expanded-chart.png'),full_page=False)

            page.locator('#dateFrom').fill('2027-01-01'); page.locator('#dateTo').fill('2027-12-31'); page.locator('#refreshBtn').click(); wait_for_layout(page,160)
            tax_2027=page.locator('#content').inner_text()
            result['taxAutoRollsTo2027']='Lịch thuế 2027 & nhắc việc' in tax_2027
            result['tax2027RowsGenerated']=page.locator('.tax-calendar-row').count()>=4 and all('/2027' in t for t in page.locator('.tax-calendar-row strong').all_inner_texts())

            navigate_view(page,'documents'); wait_for_layout(page,100)
            doc_wrap=page.locator('.documents-table-wrap')
            style=doc_wrap.evaluate("e=>({minHeight:getComputedStyle(e).minHeight,maxHeight:getComputedStyle(e).maxHeight,overflowY:getComputedStyle(e).overflowY})")
            result['documentViewportTall']=float(style['minHeight'].replace('px',''))>=550
            result['documentViewportScrollable']=style['overflowY'] in {'auto','scroll'}
            result['documentHeaderSticky']=page.locator('.documents-table thead th').first.evaluate("e=>getComputedStyle(e).position")=='sticky'
            page.screenshot(path=str(OUT/'02-documents-expanded-table.png'),full_page=False)

            navigate_view(page,'controls'); wait_for_layout(page,90)
            control_tabs={}
            for tab in ('actual','commercial','cash','quality'):
                button=page.locator(f'[data-control-tab="{tab}"]')
                if button.count(): button.click(); wait_for_layout(page,80)
                ok,boxes=one_row(page,'.control-kpi-row .kpi-card')
                control_tabs[tab]={'oneRow':ok,'count':len(boxes),'maxHeight':max((x['height'] for x in boxes),default=0)}
            result['controlKpisOneRowAllTabs']=all(x['oneRow'] and x['count']>=5 and x['maxHeight']<=136 for x in control_tabs.values())
            result['controlTabDetails']=control_tabs
            page.screenshot(path=str(OUT/'03-control-kpis-compact-row.png'),full_page=False)

            navigate_view(page,'planning'); wait_for_layout(page,90)
            ok,boxes=one_row(page,'.planning-kpi-row .kpi-card')
            result['planningKpisOneRow']=ok and len(boxes)>=5 and max(x['height'] for x in boxes)<=136

            navigate_view(page,'financialAnalytics'); wait_for_layout(page,90)
            ok,boxes=one_row(page,'.financial-kpi-row .kpi-card')
            result['financialKpisOneRow']=ok and len(boxes)>=6 and max(x['height'] for x in boxes)<=136
            page.screenshot(path=str(OUT/'04-financial-kpis-compact-row.png'),full_page=False)

            navigate_view(page,'settings'); wait_for_layout(page,100)
            settings_text=page.locator('#content').inner_text()
            options=page.locator('#field-accountingRegime option').all_inner_texts()
            result['threeAccountingRegimes']=len(options)>=3 and any('TT99' in x for x in options) and any('TT133' in x for x in options) and any('TT132' in x for x in options)
            result['obsoleteCitInfoRemoved']='TNDN quản trị theo ngày hiệu lực' not in settings_text
            tt132_value=page.locator('#field-accountingRegime option').evaluate_all("opts=>opts.find(o=>o.textContent.includes('TT132'))?.value||''")
            page.locator('#field-accountingRegime').select_option(tt132_value)
            page.locator('#field-accountingRegimeEffectiveDate').fill('2026-08-01')
            page.locator('#settingsForm button[type="submit"]').click(); wait_for_layout(page,140)
            state=page.evaluate("() => {const d=window.AlphaERP.getDB();return {regime:d.settings.accountingRegime,policy:d.settings.accountingPolicyVersion,applied:d.settings.accountingRegimeAppliedCode,accounts:(d.accounts||[]).map(x=>x.regime)}}")
            result['regimeSavePropagates']=('TT132' in state['regime'] and 'TT132' in state['policy'] and state['applied']=='TT132' and state['accounts'] and all(x=='TT132' for x in state['accounts']))
            navigate_view(page,'accounting'); wait_for_layout(page,100)
            accounting_text=page.locator('#content').inner_text()
            result['accountingViewReflectsRegime']='Chế độ kế toán đang vận hành:' in accounting_text and 'TT132' in accounting_text and 'BCTC TT132' in accounting_text
            page.screenshot(path=str(OUT/'05-accounting-regime-propagation.png'),full_page=False)

            navigate_view(page,'people'); wait_for_layout(page,100)
            people_text=page.locator('.department-structure-card').inner_text()
            result['departmentRowsDetailed']=page.locator('.department-structure-row').count()>=8
            result['departmentBreakdownVisible']='phòng / bộ môn' in people_text and 'chính thức' in people_text and 'CTV' in people_text and 'Phụ trách:' in people_text
            page.screenshot(path=str(OUT/'06-department-structure-detail.png'),full_page=False)
        finally:
            browser.close()
    result['pageErrors']=errors
    ignored={'releaseVersion','pageErrors','controlTabDetails'}
    result['passed']=all(v for k,v in result.items() if k not in ignored) and not errors
    (OUT/'ui-tax-accounting-refinement-browser-audit.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(result,ensure_ascii=False,indent=2))
    raise SystemExit(0 if result['passed'] else 1)

if __name__=='__main__': main()
