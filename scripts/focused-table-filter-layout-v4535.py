#!/usr/bin/env python3
from __future__ import annotations
import base64, json, re
from pathlib import Path
from playwright.sync_api import sync_playwright
from qa_release_context import RELEASE_VERSION, launch_chromium, wait_for_layout, wait_for_ui_ready, navigate_view

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'quality'/'final-v4535'/'table-filter-layout'
OUT.mkdir(parents=True,exist_ok=True)

def inline_application()->str:
    html=(ROOT/'index.html').read_text(encoding='utf-8')
    css=(ROOT/'alpha-design-system.css').read_text(encoding='utf-8')
    html=re.sub(r'<link rel="stylesheet" href="alpha-design-system\.css"\s*/?>',f'<style>{css}</style>',html)
    for src in re.findall(r'<script src="([^"]+)"></script>',html):
        path=ROOT/src
        if path.exists():
            html=html.replace(f'<script src="{src}"></script>',f'<script>\n{path.read_text(encoding="utf-8")}\n</script>',1)
    for name in ('logo-alpha-on-dark.png','logo-alpha-transparent.png','icon-192.png','icon-512.png'):
        path=ROOT/name
        if path.exists(): html=html.replace(name,'data:image/png;base64,'+base64.b64encode(path.read_bytes()).decode())
    html=html.replace('localStorage','window.alphaStorage').replace('sessionStorage','window.alphaSessionStorage')
    memory='''<script>function makeAlphaStorage(){let store={};return {getItem:k=>Object.prototype.hasOwnProperty.call(store,k)?store[k]:null,setItem:(k,v)=>{store[k]=String(v)},removeItem:k=>{delete store[k]},clear:()=>{store={}},key:i=>Object.keys(store)[i]||null,get length(){return Object.keys(store).length}};}window.alphaStorage=makeAlphaStorage();window.alphaSessionStorage=makeAlphaStorage();</script>'''
    return html.replace('<head>','<head>'+memory,1)

def visible_rows(page, selector):
    return page.locator(f'{selector} tbody tr:visible').count()

def main():
    errors=[];console=[];checks={}
    with sync_playwright() as p:
        browser=launch_chromium(p)
        page=browser.new_page(viewport={'width':1792,'height':1000},device_scale_factor=1)
        page.set_default_timeout(18000)
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('console',lambda m:console.append(m.text) if m.type=='error' else None)
        try:
            page.set_content(inline_application(),wait_until='domcontentloaded',timeout=60000)
            wait_for_ui_ready(page)

            navigate_view(page,'planning')
            tools=page.locator('[data-local-table-filter="resourcePlansTable"]');assert tools.is_visible()
            total=visible_rows(page,'#resourcePlansTable'); assert total>1,total
            opts=tools.locator('select option').all_text_contents(); selected=next((x for x in opts if x and x!='Tất cả dự án'),None);assert selected,opts
            tools.locator('select').select_option(label=selected);wait_for_layout(page,80)
            filtered=visible_rows(page,'#resourcePlansTable');assert 0<filtered<total,(selected,total,filtered)
            checks['resourcePlanFilter']={'total':total,'filtered':filtered,'project':selected}

            navigate_view(page,'procurement')
            page.locator('[data-procurement-tab="tools"]').click();wait_for_layout(page,100)
            tool_filter=page.locator('[data-local-table-filter="toolsTable"]');assert tool_filter.is_visible()
            schedule_filter=page.locator('[data-local-table-filter="toolAllocationScheduleTable"]');assert schedule_filter.is_visible()
            tool_total=visible_rows(page,'#toolsTable');assert tool_total>=1
            tool_filter.locator('[data-filter-search]').fill('không tồn tại');wait_for_layout(page,60)
            assert visible_rows(page,'#toolsTable')==1  # empty-state row only
            tool_filter.locator('[data-filter-search]').fill('');wait_for_layout(page,60)
            assert visible_rows(page,'#toolsTable')==tool_total
            sched_total=visible_rows(page,'#toolAllocationScheduleTable');assert sched_total>1
            schedule_filter.locator('[data-filter-search]').fill('2026-07');wait_for_layout(page,60)
            sched_filtered=visible_rows(page,'#toolAllocationScheduleTable');assert 0<sched_filtered<sched_total,(sched_total,sched_filtered)
            checks['procurementFilters']={'tools':tool_total,'scheduleTotal':sched_total,'scheduleFiltered':sched_filtered}

            navigate_view(page,'crm')
            mix=page.locator('.crm-mix-stage-grid > .card');assert mix.count()==2
            b0,b1=mix.nth(0).bounding_box(),mix.nth(1).bounding_box();assert b0 and b1
            assert abs(b0['y']-b1['y'])<=2,(b0,b1)
            assert abs(b0['width']-b1['width'])<=4,(b0,b1)
            customer=page.locator('.crm-customer-revenue-grid > .card').first.bounding_box();assert customer
            assert customer['width']>b0['width']*1.8,(customer,b0)
            checks['crmLayout']={'peerWidthDifference':round(abs(b0['width']-b1['width']),1),'customerWidth':round(customer['width'],1)}

            navigate_view(page,'financialAnalytics')
            page.locator('[data-financial-tab="forecast"]').click();wait_for_layout(page,100)
            forecast_filter=page.locator('[data-local-table-filter="financialForecastTable"]');assert forecast_filter.is_visible()
            f_total=visible_rows(page,'#financialForecastTable');assert f_total==12,f_total
            first_month=page.locator('#financialForecastTable tbody tr').first.locator('td').first.inner_text().strip()
            forecast_filter.locator('[data-filter-search]').fill(first_month);wait_for_layout(page,60)
            f_filtered=visible_rows(page,'#financialForecastTable');assert f_filtered==1,(first_month,f_filtered)
            checks['forecastFilter']={'total':f_total,'filtered':f_filtered,'month':first_month}

            navigate_view(page,'accounting')
            page.locator('[data-accounting-tab="tax"]').click();wait_for_layout(page,100)
            filing=page.locator('.table-tax-filings').first;assert filing.is_visible()
            filing_widths=page.evaluate('''() => [...document.querySelector('.table-tax-filings thead tr').cells].map(x=>Math.round(x.getBoundingClientRect().width))''')
            assert len(filing_widths)==9 and filing_widths[0]>filing_widths[1] and filing_widths[7]>filing_widths[1] and filing_widths[8]>=110,filing_widths
            filing_overflow=page.evaluate('''() => {const w=document.querySelector('.table-tax-filings').closest('.table-wrap');return Math.round(w.scrollWidth-w.clientWidth)}''')
            assert filing_overflow<=2,filing_overflow
            checks['taxFilingColumns']={'widths':filing_widths,'overflow':filing_overflow}

            navigate_view(page,'tax')
            invoice=page.locator('.table-tax-invoices').first;assert invoice.is_visible()
            invoice_widths=page.evaluate('''() => [...document.querySelector('.table-tax-invoices thead tr').cells].map(x=>Math.round(x.getBoundingClientRect().width))''')
            assert len(invoice_widths)==9 and invoice_widths[3]>invoice_widths[1] and invoice_widths[2]>invoice_widths[1] and invoice_widths[8]>=110,invoice_widths
            invoice_overflow=page.evaluate('''() => {const w=document.querySelector('.table-tax-invoices').closest('.table-wrap');return Math.round(w.scrollWidth-w.clientWidth)}''')
            assert invoice_overflow<=2,invoice_overflow
            checks['taxInvoiceColumns']={'widths':invoice_widths,'overflow':invoice_overflow}

            page.screenshot(path=str(OUT/'v4535-targeted-layout.png'),full_page=False)
        finally:
            browser.close()
    result={'releaseVersion':RELEASE_VERSION,'checks':checks,'pageErrors':errors,'consoleErrors':console,'passed':not errors and not console}
    (OUT/'focused-table-filter-layout-v4535.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(result,ensure_ascii=False,indent=2))
    if errors or console: raise SystemExit(1)

if __name__=='__main__':main()
