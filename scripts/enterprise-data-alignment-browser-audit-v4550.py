#!/usr/bin/env python3
from __future__ import annotations
import base64, json, re
from pathlib import Path
from playwright.sync_api import sync_playwright
from qa_release_context import RELEASE_VERSION, evidence_dir, launch_chromium, wait_for_layout, wait_for_ui_ready, navigate_view

ROOT=Path(__file__).resolve().parents[1]
OUT=evidence_dir('enterprise-data-alignment-v4550')
VIEWPORTS=[(1792,900)]
THEMES=['light']


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


def table_by_headers(page, required):
    return page.evaluate_handle(r'''required=>{const norm=s=>String(s||'').replace(/\s+/g,' ').trim().toLowerCase();return [...document.querySelectorAll('.table-wrap table')].find(table=>{const labels=[...table.querySelectorAll('thead th')].map(th=>norm(th.textContent));return required.every(label=>labels.includes(norm(label)));})||null;}''', required)


def audit_center_columns(page, headers, target_labels):
    return page.evaluate(r'''({headers,targetLabels})=>{const norm=s=>String(s||'').replace(/\s+/g,' ').trim().toLowerCase();const table=[...document.querySelectorAll('.table-wrap table')].find(t=>{const labels=[...t.querySelectorAll('thead th')].map(th=>norm(th.textContent));return headers.every(x=>labels.includes(norm(x)));});if(!table)return {missing:true};const ths=[...table.querySelectorAll('thead tr:last-child th')];const labels=ths.map(th=>norm(th.textContent));const result={missing:false,columns:[],tableClass:table.className};for(const target of targetLabels){const index=labels.indexOf(norm(target));if(index<0){result.columns.push({target,index,missing:true});continue;}const th=ths[index];const cells=[...table.tBodies].flatMap(body=>[...body.rows]).slice(0,12).map(row=>row.cells[index]).filter(Boolean);const details=cells.map(cell=>{const cr=cell.getBoundingClientRect();const child=cell.querySelector('.badge,.role-tag,.table-action-group,.audit-action-cell')||cell.firstElementChild;const rr=child?.getBoundingClientRect();return {align:getComputedStyle(cell).textAlign,vertical:getComputedStyle(cell).verticalAlign,content:String(cell.textContent||'').replace(/\s+/g,' ').trim(),childOffset:rr?Math.abs((rr.left+rr.width/2)-(cr.left+cr.width/2)):0};});result.columns.push({target,index,headerAlign:getComputedStyle(th).textAlign,headerVertical:getComputedStyle(th).verticalAlign,details});}return result;}''', {'headers':headers,'targetLabels':target_labels})


def issues_for_center(result):
    issues=[]
    if result.get('missing'): return ['table missing']
    for col in result['columns']:
        if col.get('missing'): issues.append(f"missing column {col['target']}");continue
        if col['headerAlign']!='center': issues.append(f"header {col['target']} not centered: {col['headerAlign']}")
        for d in col['details']:
            if d['align']!='center': issues.append(f"cell {col['target']} not centered: {d['align']} / {d['content']}")
            if d['childOffset']>5: issues.append(f"child {col['target']} off center {d['childOffset']:.1f}px")
    return issues


def main():
    OUT.mkdir(parents=True,exist_ok=True)
    html=inline_application(); records=[]; errors=[]; screenshots=[]
    with sync_playwright() as p:
        browser=launch_chromium(p)
        try:
            for width,height in VIEWPORTS:
                page=browser.new_page(viewport={'width':width,'height':height})
                local_errors=[];page.on('pageerror',lambda e,sink=local_errors:sink.append(str(e)))
                try:
                    page.set_content(html,wait_until='domcontentloaded',timeout=60000);wait_for_ui_ready(page)
                    for theme in THEMES:
                        page.evaluate("t=>{document.documentElement.setAttribute('data-theme',t);document.body.dataset.theme=t;}",theme);wait_for_layout(page)
                        # 1. Purchase order table
                        navigate_view(page,'procurement');page.locator('[data-procurement-tab="orders"]').click();wait_for_layout(page,70)
                        purchase=page.evaluate('''()=>{const table=document.querySelector('.table-purchase-orders');if(!table)return {missing:true};const th=[...table.querySelectorAll('thead th')],row=table.tBodies[0]?.rows[0],cell=row?.cells[0],r=th[0].getBoundingClientRect();return {missing:false,firstWidth:r.width,firstHeaderOverflow:th[0].scrollWidth-th[0].clientWidth,firstCellOverflow:cell?cell.scrollWidth-cell.clientWidth:0,firstText:cell?.textContent.trim()||'',grid:table.dataset.gridContract||'',wrapOverflow:table.closest('.table-wrap').scrollWidth-table.closest('.table-wrap').clientWidth};}''')
                        pcenter=audit_center_columns(page,['Số PO','Nhà cung cấp','Thanh toán','Chứng từ'],['Thanh toán','Chứng từ'])
                        pissues=issues_for_center(pcenter)
                        if purchase.get('missing'):pissues.append('purchase table missing')
                        else:
                            if not 108<=purchase['firstWidth']<=150:pissues.append(f"PO column width {purchase['firstWidth']:.1f}px")
                            if purchase['firstHeaderOverflow']>1 or purchase['firstCellOverflow']>1:pissues.append('PO content clipped')
                        records.append({'viewport':[width,height],'theme':theme,'view':'procurement-orders','metrics':purchase,'centering':pcenter,'issues':pissues,'passed':not pissues})
                        # 2. Payroll sticky full header
                        navigate_view(page,'payroll');wait_for_layout(page,70)
                        payroll=page.evaluate(r'''()=>{const wrap=document.querySelector('.payroll-detail-wrap'),table=wrap?.querySelector('.payroll-detail-table');if(!wrap||!table)return {missing:true};wrap.scrollTop=Math.min(260,wrap.scrollHeight-wrap.clientHeight);const wr=wrap.getBoundingClientRect(),ths=[...table.querySelectorAll('thead th')],firstBody=table.tBodies[0]?.rows[0];const heads=ths.slice(0,5).map(th=>{const r=th.getBoundingClientRect();const hit=document.elementFromPoint(Math.min(r.right-4,r.left+r.width/2),Math.min(r.bottom-4,r.top+r.height/2));return {text:th.textContent.replace(/\s+/g,' ').trim(),top:r.top,left:r.left,z:Number.parseInt(getComputedStyle(th).zIndex)||0,position:getComputedStyle(th).position,hitTag:hit?.closest('th,td')?.tagName||'',hitText:hit?.closest('th,td')?.textContent.replace(/\s+/g,' ').trim()||''};});const bodySticky=[...(firstBody?.querySelectorAll('.payroll-sticky-col')||[])].map(td=>Number.parseInt(getComputedStyle(td).zIndex)||0);return {missing:false,wrapTop:wr.top,scrollTop:wrap.scrollTop,headers:heads,bodyStickyZ:bodySticky,headerCount:ths.length};}''')
                        issues=[]
                        if payroll.get('missing'):issues.append('payroll table missing')
                        else:
                            if payroll['headerCount']!=25:issues.append(f"payroll header count {payroll['headerCount']}")
                            for h in payroll['headers']:
                                if h['position']!='sticky':issues.append(f"header not sticky {h['text']}")
                                if abs(h['top']-payroll['wrapTop'])>3:issues.append(f"header top drift {h['text']}: {h['top']-payroll['wrapTop']:.1f}")
                                if h['hitTag']!='TH':issues.append(f"header covered by {h['hitTag']} {h['hitText']}")
                            min_head=min((h['z'] for h in payroll['headers']),default=0);max_body=max(payroll['bodyStickyZ'] or [0])
                            if min_head<=max_body:issues.append(f"header z-index {min_head} <= body sticky {max_body}")
                        records.append({'viewport':[width,height],'theme':theme,'view':'payroll-sticky-header','metrics':payroll,'issues':issues,'passed':not issues})
                        # 3. Annual benefit header completeness
                        annual=page.evaluate(r'''()=>{const table=document.querySelector('.annual-benefit-table');if(!table)return {missing:true};const ths=[...table.querySelectorAll('thead th')];return {missing:false,count:ths.length,headers:ths.map(th=>{const r=th.getBoundingClientRect();return {text:th.textContent.replace(/\s+/g,' ').trim(),align:getComputedStyle(th).textAlign,width:r.width,height:r.height,overflowX:th.scrollWidth-th.clientWidth,overflowY:th.scrollHeight-th.clientHeight,whiteSpace:getComputedStyle(th).whiteSpace};})};}''')
                        issues=[]
                        if annual.get('missing'):issues.append('annual benefit table missing')
                        else:
                            if annual['count']!=10:issues.append(f"annual header count {annual['count']}")
                            for h in annual['headers']:
                                if h['align']!='center':issues.append(f"annual header not centered {h['text']}")
                                if h['overflowX']>1 or h['overflowY']>1:issues.append(f"annual header clipped {h['text']}")
                                if h['height']<54:issues.append(f"annual header too short {h['text']}: {h['height']}")
                        records.append({'viewport':[width,height],'theme':theme,'view':'annual-benefit-header','metrics':annual,'issues':issues,'passed':not issues})
                        # 4. Financial analytics evaluation
                        navigate_view(page,'financialAnalytics');wait_for_layout(page,70)
                        res=audit_center_columns(page,['Chỉ số','Giá trị','Đánh giá','Công thức'],['Đánh giá'])
                        issues=issues_for_center(res);records.append({'viewport':[width,height],'theme':theme,'view':'financial-analytics','metrics':res,'issues':issues,'passed':not issues})
                        # 5. Accounting account group/normal balance
                        navigate_view(page,'accounting');page.locator('[data-accounting-tab="accounts"]').click();wait_for_layout(page,70)
                        res=audit_center_columns(page,['Số hiệu','Tên tài khoản','Nhóm','Tính chất','Trạng thái'],['Nhóm','Tính chất'])
                        issues=issues_for_center(res);records.append({'viewport':[width,height],'theme':theme,'view':'accounting-accounts','metrics':res,'issues':issues,'passed':not issues})
                        # 6. Users role/department
                        navigate_view(page,'users');wait_for_layout(page,90)
                        res=audit_center_columns(page,['Người dùng','Email','Vai trò','Bộ phận','Trạng thái'],['Vai trò','Bộ phận'])
                        issues=issues_for_center(res);records.append({'viewport':[width,height],'theme':theme,'view':'users-roles','metrics':res,'issues':issues,'passed':not issues})
                        # 7. Audit action/module
                        navigate_view(page,'audit');wait_for_layout(page,90)
                        res=audit_center_columns(page,['Thời gian','Người dùng','Hành động','Phân hệ','Chi tiết'],['Hành động','Phân hệ'])
                        issues=issues_for_center(res);records.append({'viewport':[width,height],'theme':theme,'view':'audit-log','metrics':res,'issues':issues,'passed':not issues})
                    errors.extend(local_errors)
                finally: page.close()
        finally: browser.close()
    summary={'releaseVersion':RELEASE_VERSION,'states':len(records),'passedStates':sum(r['passed'] for r in records),'failedStates':sum(not r['passed'] for r in records),'runtimeErrors':errors,'screenshots':screenshots,'passed':all(r['passed'] for r in records) and not errors}
    (OUT/'enterprise-data-alignment-browser-audit.json').write_text(json.dumps({'summary':summary,'records':records},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(summary,ensure_ascii=False))
    if not summary['passed']:raise SystemExit(1)

if __name__=='__main__':main()
