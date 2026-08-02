#!/usr/bin/env python3
from __future__ import annotations
import base64,json,re
from pathlib import Path
from playwright.sync_api import sync_playwright
from qa_release_context import RELEASE_VERSION,evidence_dir,launch_chromium,wait_for_ui_ready,navigate_view,wait_for_layout

ROOT=Path(__file__).resolve().parents[1]
OUT=evidence_dir('clear-charts-tax-calendar-v4553')

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
    storage='''<script>function makeAlphaStorage(){let store={};return {getItem:k=>Object.prototype.hasOwnProperty.call(store,k)?store[k]:null,setItem:(k,v)=>{store[k]=String(v)},removeItem:k=>{delete store[k]},clear:()=>{store={}},key:i=>Object.keys(store)[i]||null,get length(){return Object.keys(store).length}};}window.alphaStorage=makeAlphaStorage();window.alphaSessionStorage=makeAlphaStorage();window.confirm=()=>true;window.alert=()=>{};</script>'''
    return h.replace('<head>','<head>'+storage,1)

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    result={'releaseVersion':RELEASE_VERSION};errors=[]
    with sync_playwright() as p:
        browser=launch_chromium(p)
        try:
            page=browser.new_page(viewport={'width':1792,'height':1000})
            page.on('pageerror',lambda e:errors.append(str(e)))
            page.set_default_timeout(12000)
            page.set_content(inline_application(),wait_until='domcontentloaded',timeout=60000)
            wait_for_ui_ready(page)

            navigate_view(page,'payroll');wait_for_layout(page,100)
            payroll=page.locator('#content').inner_text()
            result['payrollChartTitle']='Cơ cấu giờ làm việc đã duyệt theo tháng' in payroll
            result['payrollMeaning']='Giờ tính phí dự án' in payroll and 'Giờ nội bộ / không tính phí' in payroll and 'Cách đọc:' in payroll
            result['payrollSummaryCount']=page.locator('.chart-summary-strip').count()
            result['payrollNoOldTitle']='Billable và Non-billable Hours' not in payroll
            page.screenshot(path=str(OUT/'payroll-clear-hours-chart.png'),full_page=False)

            navigate_view(page,'finance');wait_for_layout(page,100)
            finance=page.locator('#content').inner_text()
            result['cashOutTitle']='Tiền đã chi theo mục đích và theo tháng' in finance
            result['cashBalanceTitle']='Số dư cuối tháng theo nơi giữ tiền' in finance
            result['cashExplanations']=finance.count('Cách đọc:')>=2
            result['cashSummaryVisible']=page.locator('.cash-balance-grid .chart-summary-strip').count()==1
            page.screenshot(path=str(OUT/'finance-clear-cash-charts.png'),full_page=False)

            navigate_view(page,'tax');wait_for_layout(page,140)
            tax=page.locator('#content').inner_text()
            result['autoCalendarTitle']='Lịch thuế ' in tax and '& nhắc việc' in tax
            result['calendarRows']=page.locator('.tax-calendar-row').count()
            result['calendarSyncVisible']=page.locator('#syncTaxCalendar').is_visible()
            result['calendarExplanation']='không đọc trực tiếp từ Internet' in tax and 'Không truy cập Internet khi chạy' in tax
            result['calendarCountdowns']=page.locator('.tax-calendar-countdown').count()
            page.screenshot(path=str(OUT/'tax-automatic-calendar-reminders.png'),full_page=False)

            navigate_view(page,'settings');wait_for_layout(page,120)
            settings=page.locator('#content').inner_text()
            result['oldCitSelectorsRemoved']=page.locator('#field-citRateMode').count()==0 and 'Điều kiện áp dụng mức 15% / 17%' not in settings
            result['manualCitFields']=page.locator('#field-corporateTaxRate').is_visible() and page.locator('#field-corporateTaxRateEffectiveDate').is_visible()
            page.locator('#field-corporateTaxRate').fill('17')
            page.locator('#field-corporateTaxRateEffectiveDate').fill('2026-07-01')
            page.locator('#settingsForm button[type="submit"]').click()
            wait_for_layout(page,140)
            configured=page.evaluate("window.AlphaERP.getDB().settings")
            result['manualCitSaved']=configured.get('citRateMode')=='Manual' and configured.get('corporateTaxRate')==17 and configured.get('corporateTaxRateEffectiveDate')=='2026-07-01'
            history=configured.get('citManualRateHistory') or []
            result['manualCitHistorySaved']=any(str(x.get('effectiveFrom'))=='2026-07-01' and float(x.get('rate',-1))==17 for x in history)
            page.screenshot(path=str(OUT/'settings-manual-effective-dated-cit.png'),full_page=False)
        finally:
            browser.close()
    result['pageErrors']=errors
    checks=[v for k,v in result.items() if k not in {'releaseVersion','pageErrors','payrollSummaryCount','calendarRows','calendarCountdowns'}]
    result['passed']=all(checks) and result['payrollSummaryCount']>=1 and result['calendarRows']>=4 and result['calendarCountdowns']>=4 and not errors
    (OUT/'clear-charts-tax-calendar-browser-audit.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(result,ensure_ascii=False,indent=2))
    raise SystemExit(0 if result['passed'] else 1)

if __name__=='__main__':main()
