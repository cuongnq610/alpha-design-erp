#!/usr/bin/env python3
from __future__ import annotations
import base64, json, re
from pathlib import Path
from playwright.sync_api import sync_playwright
from qa_release_context import RELEASE_VERSION, RELEASE_FILE_TOKEN, evidence_dir, launch_chromium
ROOT=Path(__file__).resolve().parents[1]
OUT=evidence_dir('ui')


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
NAME_AUDIT=r'''() => {
 const visible=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>.5&&r.height>.5&&s.display!=='none'&&s.visibility!=='hidden'};
 const controls=[...document.querySelectorAll('input:not([type="hidden"]),select,textarea')].filter(e=>visible(e)&&!e.disabled);
 const missingControls=controls.filter(e=>{
   const labels=e.labels?[...e.labels]:[];
   return !(e.getAttribute('aria-label')||e.getAttribute('aria-labelledby')||labels.some(l=>l.textContent.trim()));
 }).map(e=>({tag:e.tagName,id:e.id,name:e.name,placeholder:e.placeholder||''}));
 const buttons=[...document.querySelectorAll('button')].filter(visible);
 const missingButtons=buttons.filter(e=>!(e.textContent.trim()||e.getAttribute('aria-label')||e.title)).map(e=>({id:e.id,className:String(e.className)}));
 return {missingControls,missingButtons};
}'''
TARGET_AUDIT=r'''() => {
 const visible=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>.5&&r.height>.5&&s.display!=='none'&&s.visibility!=='hidden'};
 const selectors='.nav-group-toggle,.nav-item,.plain-icon,.header-icon,.icon-btn,button.section-link,button.table-action-button,.control-tabs button,.metric-switch button,.procurement-tabs button,.export-tabs button,.accounting-tabs button,button.switch,#primaryAction';
 return [...document.querySelectorAll(selectors)].filter(e=>visible(e)&&!e.disabled).map(e=>{const r=e.getBoundingClientRect();return {text:(e.textContent||e.getAttribute('aria-label')||'').trim().slice(0,80),className:String(e.className),width:r.width,height:r.height}}).filter(x=>x.width<43.5||x.height<43.5);
}'''

def main():
    html=inline_application(); records=[]
    with sync_playwright() as p:
        browser=launch_chromium(p)
        # Desktop labels + focus lifecycle.
        page=browser.new_page(viewport={'width':1440,'height':1000}); page.set_default_timeout(5000); errors=[]; page.on('pageerror',lambda e:errors.append(str(e)))
        page.set_content(html,wait_until='load',timeout=60000); page.evaluate(INIT); page.wait_for_timeout(80)
        label_views=['tasks','projects','people','timesheets','documents','settings','exports']
        label_results=[]
        for view in label_views:
            page.evaluate("v=>document.querySelector(`.nav-item[data-view='${v}']`)?.click()",view); page.wait_for_timeout(40)
            label_results.append({'view':view,**page.evaluate(NAME_AUDIT)})
        # Modal focus: opener -> dialog, trap, Escape restore.
        page.evaluate("document.querySelector(`.nav-item[data-view='projects']`)?.click()"); page.wait_for_timeout(30)
        page.locator('#primaryAction').focus(); page.locator('#primaryAction').click(); page.wait_for_timeout(80)
        modal_open=page.locator('#modalBackdrop:not(.hidden)').count()==1
        focus_in_modal=page.evaluate("document.querySelector('#modalBackdrop').contains(document.activeElement)")
        focus_meta=page.evaluate("""() => {const root=document.querySelector('#modalBackdrop');const a=[...root.querySelectorAll(\"button:not([disabled]),input:not([disabled]):not([type='hidden']),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex='-1'])\")].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0});if(!a.length)return {ok:false};a[a.length-1].dataset.auditLast='1';a[0].dataset.auditFirst='1';a[a.length-1].focus();return {ok:true};}""")
        if focus_meta.get('ok'): page.keyboard.press('Tab'); page.wait_for_timeout(20)
        trap_ok=bool(focus_meta.get('ok')) and page.evaluate("document.activeElement?.dataset.auditFirst==='1'")
        page.keyboard.press('Escape'); page.wait_for_timeout(40)
        modal_restore=page.evaluate("document.activeElement===document.getElementById('primaryAction')")
        # Drawer focus and restore.
        page.locator('#notificationBtn').focus(); page.locator('#notificationBtn').click(); page.wait_for_timeout(50)
        drawer_focus=page.evaluate("document.querySelector('#notificationDrawer').contains(document.activeElement)")
        page.keyboard.press('Escape'); page.wait_for_timeout(40)
        drawer_restore=page.evaluate("document.activeElement===document.getElementById('notificationBtn')")
        # Integration truthful state and modal labels.
        page.evaluate("document.querySelector(`.nav-item[data-view='integrations']`)?.click()"); page.wait_for_timeout(80)
        einvoice=page.locator('[data-integration="einvoice"]'); before=einvoice.get_attribute('class') or ''; einvoice.click(); page.wait_for_timeout(30); after=page.locator('[data-integration="einvoice"]').get_attribute('class') or ''
        unsupported_stays_off=('on' not in before.split()) and ('on' not in after.split())
        page.locator('[data-automation-config="email"]').click(); page.wait_for_timeout(50)
        email_names=page.evaluate(NAME_AUDIT); production_note=('mô phỏng' in page.locator('#modalHelp').inner_text().lower())
        page.locator('#cloudCancelModal').click(); page.wait_for_timeout(30)
        page.screenshot(path=str(OUT/'accessibility-integration-desktop.png'),full_page=False)
        desktop={'labelViews':label_results,'modalOpen':modal_open,'focusInModal':focus_in_modal,'modalTrap':trap_ok,'modalFocusRestore':modal_restore,'drawerFocus':drawer_focus,'drawerFocusRestore':drawer_restore,'unsupportedIntegrationStaysOff':unsupported_stays_off,'integrationModalNames':email_names,'demoTruthfulnessNote':production_note,'pageErrors':errors}
        desktop['passed']=not errors and all(not r['missingControls'] and not r['missingButtons'] for r in label_results) and modal_open and focus_in_modal and trap_ok and modal_restore and drawer_focus and drawer_restore and unsupported_stays_off and not email_names['missingControls'] and not email_names['missingButtons'] and production_note
        records.append({'scope':'desktop',**desktop}); page.close()
        # Mobile target sizes on representative views.
        for width,height in [(360,800),(390,844),(430,900),(768,900),(1024,900)]:
            for theme in ('light','dark'):
                pg=browser.new_page(viewport={'width':width,'height':height}); pg.set_default_timeout(5000); errs=[]; pg.on('pageerror',lambda e,b=errs:b.append(str(e)))
                pg.set_content(html,wait_until='load',timeout=60000); pg.evaluate(INIT); pg.evaluate("t=>document.documentElement.setAttribute('data-theme',t)",theme); pg.wait_for_timeout(50)
                views=['dashboard','controls','procurement','accounting','integrations']
                issues=[]
                for view in views:
                    pg.evaluate("v=>document.querySelector(`.nav-item[data-view='${v}']`)?.click()",view); pg.wait_for_timeout(30)
                    issues.extend([{'view':view,**x} for x in pg.evaluate(TARGET_AUDIT)])
                rec={'scope':'mobileTargets','width':width,'height':height,'theme':theme,'issues':issues,'pageErrors':errs,'passed':not issues and not errs}; records.append(rec)
                if width==390 and theme=='light': pg.screenshot(path=str(OUT/'mobile-touch-targets-390.png'),full_page=False)
                pg.close()
        browser.close()
    summary={'releaseVersion':RELEASE_VERSION,'states':len(records),'passedStates':sum(bool(r.get('passed')) for r in records),'failedStates':sum(not bool(r.get('passed')) for r in records),'passed':all(bool(r.get('passed')) for r in records)}
    (OUT/'accessibility-integration-audit.json').write_text(json.dumps({'summary':summary,'records':records},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(summary,ensure_ascii=False))
    if not summary['passed']: raise SystemExit(1)
if __name__=='__main__': main()
