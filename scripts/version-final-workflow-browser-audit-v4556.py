#!/usr/bin/env python3
from __future__ import annotations
import base64, json, re
from pathlib import Path
from playwright.sync_api import sync_playwright
from qa_release_context import RELEASE_VERSION, evidence_dir, launch_chromium, wait_for_ui_ready, navigate_view, wait_for_layout

ROOT=Path(__file__).resolve().parents[1]
OUT=evidence_dir('version-final-workflow-v4556')

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
    shim='''<script>
    function makeAlphaStorage(){let store={};return {getItem:k=>Object.prototype.hasOwnProperty.call(store,k)?store[k]:null,setItem:(k,v)=>{store[k]=String(v)},removeItem:k=>{delete store[k]},clear:()=>{store={}},key:i=>Object.keys(store)[i]||null,get length(){return Object.keys(store).length}};}
    window.alphaStorage=makeAlphaStorage();window.alphaSessionStorage=makeAlphaStorage();
    window.__alerts=[];window.alert=m=>window.__alerts.push(String(m));window.confirm=()=>true;window.prompt=(m,d)=>d||'1';
    </script>'''
    return h.replace('<head>','<head>'+shim,1)

def open_page(browser, errors):
    page=browser.new_page(viewport={'width':1792,'height':1000},accept_downloads=True)
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_default_timeout(15000)
    page.set_content(inline_application(),wait_until='domcontentloaded',timeout=60000)
    wait_for_ui_ready(page)
    return page

def db_eval(page, expression):
    return page.evaluate(f"() => {{const d=window.AlphaERP.getDB();return ({expression});}}")

def click(page, selector, delay=100):
    loc=page.locator(selector)
    loc.scroll_into_view_if_needed()
    loc.click(force=True)
    wait_for_layout(page,delay)

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    result={'releaseVersion':RELEASE_VERSION};errors=[]
    with sync_playwright() as p:
        browser=launch_chromium(p)
        try:
            # Layout, timesheet and charts.
            page=open_page(browser,errors)
            navigate_view(page,'dashboard')
            note=page.locator('.dashboard-source-card')
            result['dashboardSourceVisible']=note.count()==1 and note.is_visible()
            result['dashboardSourceNotInKpiGrid']=note.evaluate("e=>!e.closest('.dashboard-context-grid')")
            page.screenshot(path=str(OUT/'01-dashboard-layout.png'),full_page=False)
            data=page.evaluate("() => window.AlphaERP.getDB()")
            pending=next((x for x in data.get('timesheets',[]) if not x.get('approved')),None)
            result['pendingTimesheetExists']=bool(pending)
            if pending:
                navigate_view(page,'timesheets')
                selector=f'.approve-timesheet[data-id="{pending["id"]}"]'
                result['timesheetApproveButtonVisible']=page.locator(selector).count()==1
                click(page,selector,140)
                row=db_eval(page,f"d.timesheets.find(x=>x.id==={json.dumps(pending['id'])})")
                result['timesheetApprovePersists']=bool(row and row.get('approved') and row.get('approvedAt') and row.get('approvedBy'))
                result['timesheetApproveNoError']=not any('Không thể lưu trạng thái duyệt timesheet' in x for x in page.evaluate('window.__alerts'))
            navigate_view(page,'finance')
            badges=page.locator('.chart-unit-badge').all_inner_texts()
            result['highValueChartUsesBillion']=any('tỷ' in x for x in badges)
            result['twelveMonthChartsNoHorizontalScroll']=page.locator('.combo-chart .chart-horizontal-scroll').count()==0
            page.close()

            # Payroll and annual-benefit workflow controls.
            page=open_page(browser,errors)
            target_month='2026-10'
            page.evaluate("month=>{const d=window.AlphaERP.getDB();d.payrollPeriods=(d.payrollPeriods||[]).filter(x=>x.month!==month);d.payrollItems=[];window.AlphaERP.commit(d)}",target_month)
            navigate_view(page,'payroll')
            page.locator('#payrollMonthSelect').select_option(target_month);wait_for_layout(page,80)
            click(page,'#generatePayrollPeriod',120)
            result['payrollGenerated']=db_eval(page,f"Boolean(d.payrollPeriods.find(x=>x.month==={json.dumps(target_month)}))")
            click(page,'#reviewPayrollPeriod',120);result['payrollReviewed']=db_eval(page,f"d.payrollPeriods.find(x=>x.month==={json.dumps(target_month)})?.status")=='Reviewed'
            click(page,'#approvePayrollPeriod',120);result['payrollApproved']=db_eval(page,f"d.payrollPeriods.find(x=>x.month==={json.dumps(target_month)})?.status")=='Approved'
            click(page,'#lockPayrollPeriod',120);result['payrollLocked']=db_eval(page,f"d.payrollPeriods.find(x=>x.month==={json.dumps(target_month)})?.status")=='Locked'
            with page.expect_download(timeout=10000) as download:
                click(page,'#exportPayrollCsv',50)
            result['payrollCsvDownloads']=download.value.suggested_filename.endswith('.csv')
            year=2026
            page.evaluate("year=>{const d=window.AlphaERP.getDB();d.annualBenefitBudgets=(d.annualBenefitBudgets||[]).filter(x=>Number(x.year)!==year);window.AlphaERP.commit(d)}",year)
            page.locator('#annualBenefitYearSelect').select_option(str(year));wait_for_layout(page,80)
            click(page,'#generateAnnualBenefitBudget',120);result['benefitGenerated']=db_eval(page,f"Boolean(d.annualBenefitBudgets.find(x=>Number(x.year)==={year}))")
            click(page,'#editAnnualBenefitBudget',60);result['benefitParameterModalOpens']=page.locator('#modalForm').is_visible();page.keyboard.press('Escape');wait_for_layout(page,50)
            click(page,'#reviewAnnualBenefitBudget',120);result['benefitReviewed']=db_eval(page,f"d.annualBenefitBudgets.find(x=>Number(x.year)==={year})?.status")=='Reviewed'
            click(page,'#approveAnnualBenefitBudget',120);result['benefitApproved']=db_eval(page,f"d.annualBenefitBudgets.find(x=>Number(x.year)==={year})?.status")=='Approved'
            click(page,'#lockAnnualBenefitBudget',120);result['benefitLocked']=db_eval(page,f"d.annualBenefitBudgets.find(x=>Number(x.year)==={year})?.status")=='Locked'
            with page.expect_download(timeout=10000) as download:
                click(page,'#exportAnnualBenefitCsv',50)
            result['benefitCsvDownloads']=download.value.suggested_filename.endswith('.csv')
            page.screenshot(path=str(OUT/'02-payroll-benefit-workflows.png'),full_page=False)
            result['workflowNoStorageErrors']=not any('Không thể lưu' in x for x in page.evaluate('window.__alerts'))
            page.close()

            # TT99 selection and propagation.
            page=open_page(browser,errors)
            navigate_view(page,'settings')
            value=page.locator('#field-accountingRegime option').evaluate_all("opts=>opts.find(o=>o.textContent.includes('TT99'))?.value||''")
            result['tt99OptionExists']=bool(value)
            page.locator('#field-accountingRegime').select_option(value)
            page.locator('#field-accountingRegimeEffectiveDate').fill('2026-01-01')
            page.locator('#settingsForm').evaluate('f=>f.requestSubmit()');wait_for_layout(page,180)
            state=db_eval(page,"({regime:d.settings.accountingRegime,applied:d.settings.accountingRegimeAppliedCode,accounts:[...new Set(d.accounts.map(x=>x.regime))]})")
            result['tt99RegimePropagates']='TT99' in state['regime'] and state['applied']=='TT99' and state['accounts']==['TT99']
            navigate_view(page,'accounting');click(page,'[data-accounting-tab="statutory"]',140)
            text=page.locator('#content').inner_text()
            result['tt99StatutoryFormsVisible']=all(x in text for x in ('B01-DN','B02-DN','B03-DN','B09-DN'))
            result['tt133FormHiddenUnderTT99']='B01a-DNN' not in text
            page.screenshot(path=str(OUT/'03-tt99-financial-statements.png'),full_page=False)
            navigate_view(page,'exports')
            export_text=page.locator('#content').inner_text()
            result['tt99ExportSetVisible']='Bộ báo cáo tài chính TT99' in export_text and all(x in export_text for x in ('B01-DN','B02-DN','B03-DN','B09-DN'))
            page.close()

            # Structural safeguards covered in the full static and 69-check E2E suites.
            source=(ROOT/'app.js').read_text(encoding='utf-8')
            result['adaptiveMillionBillionThresholdImplemented']="max>=1000?{divisor:1000,unit:'tỷ'" in source and "{divisor:1,unit:'tr'" in source
            result['projectEditSaveHandlerPresent']='modalForm.onsubmit=async' in source and "if(!saveDB()){db=before;alert('Không thể lưu dữ liệu." in source
            result['referencedProjectSoftArchives']="target.status='Archived'" in source and "target.isArchived=true" in source
            result['storageRecoveryImplemented']='LEGACY_STORAGE_KEYS' in source and 'cleanupLegacyStorage' in source and 'localStorage.removeItem(STORAGE_KEY)' in source
        finally:
            browser.close()
    result['pageErrors']=errors
    ignored={'releaseVersion','pageErrors'}
    result['passed']=all(bool(v) for k,v in result.items() if k not in ignored) and not errors
    (OUT/'version-final-workflow-browser-audit.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(result,ensure_ascii=False,indent=2))
    raise SystemExit(0 if result['passed'] else 1)

if __name__=='__main__':main()
