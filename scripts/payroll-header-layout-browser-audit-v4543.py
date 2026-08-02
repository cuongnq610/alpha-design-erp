#!/usr/bin/env python3
from __future__ import annotations
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
from qa_release_context import RELEASE_VERSION, evidence_dir, launch_chromium

ROOT=Path(__file__).resolve().parents[1]
OUT=evidence_dir('payroll-header-v4543')
VIEWPORTS=[(1440,720),(1280,720),(1024,720),(430,720)]
HEADERS=['Mã / Họ tên','Bộ môn','Loại','Ngày công chuẩn','Ngày hưởng lương','Giờ duyệt','Giờ billable','Lương / tiền công','Phụ cấp','Làm thêm','Thưởng','Thu nhập khác','Tổng thu nhập','BH người lao động','Thuế TNCN','Tạm ứng','Khấu trừ khác','Thực nhận','BH doanh nghiệp','Tổng chi phí DN','Phân bổ dự án','Doanh thu thu hồi','Utilization','Cost Recovery','Thao tác']
NUMERIC=set(range(3,24))

def fixture_html():
    css=(ROOT/'alpha-design-system.css').read_text(encoding='utf-8')
    th=[]
    for i,label in enumerate(HEADERS):
        classes=[]
        if i==0:classes=['payroll-sticky-col','payroll-col-person']
        elif i==1:classes=['payroll-sticky-col','payroll-col-dept']
        if i in NUMERIC:classes.append('numeric')
        th.append(f'<th class="{" ".join(classes)}"><span class="payroll-header-label">{label}</span></th>')
    cells=['<td class="payroll-sticky-col payroll-col-person"><strong>AD-002</strong><div class="muted">Kiến trúc sư Demo</div></td>','<td class="payroll-sticky-col payroll-col-dept">Kiến trúc</td>','<td>Fixed</td>']
    cells += [f'<td class="numeric">{value}</td>' for value in ['23','23','8','8','28.000.000 đ','1.500.000 đ','0 đ','1.000.000 đ','0 đ','30.500.000 đ','0 đ','1.200.000 đ','0 đ','0 đ','29.300.000 đ','0 đ','30.500.000 đ','8.000.000 đ','3.360.000 đ','100%','11%']]
    cells += ['<td><button>Chi tiết</button></td>']
    cols=''.join(f'<col class="payroll-width-{i}">' for i in range(1,26))
    return f'''<!doctype html><html data-theme="light"><head><meta charset="utf-8"><style>{css}\nbody{{margin:0;padding:24px;background:#eef7fb}}.fixture{{max-width:calc(100vw - 48px);margin:auto;background:var(--card,#fff);border:1px solid var(--line,#d8e3ed);border-radius:14px;overflow:hidden}}.fixture h2{{margin:0;padding:16px}}button{{padding:7px 10px}}</style></head><body><div class="fixture"><h2>Bảng lương chi tiết theo nhân viên</h2><div class="table-wrap payroll-detail-wrap" role="region" aria-label="Bảng lương chi tiết có thể cuộn ngang" tabindex="0"><table class="payroll-detail-table"><colgroup>{cols}</colgroup><thead><tr>{''.join(th)}</tr></thead><tbody><tr>{''.join(cells)}</tr></tbody></table></div></div></body></html>'''

AUDIT='''expected => {const wrap=document.querySelector('.payroll-detail-wrap'),table=document.querySelector('.payroll-detail-table'),headers=[...table.querySelectorAll('thead th')];const details=headers.map((th,index)=>{const label=th.querySelector('.payroll-header-label'),tr=th.getBoundingClientRect(),lr=label.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(label);return {index,text:label.textContent.trim(),cellWidth:th.clientWidth,cellHeight:th.clientHeight,labelWidth:label.clientWidth,labelHeight:label.clientHeight,labelScrollWidth:label.scrollWidth,labelScrollHeight:label.scrollHeight,inside:lr.left>=tr.left-1&&lr.right<=tr.right+1&&lr.top>=tr.top-1&&lr.bottom<=tr.bottom+1,lines:[...range.getClientRects()].filter(r=>r.width>.5&&r.height>.5).length};});return {headerTexts:details.map(x=>x.text),headers:details,tableWidth:table.getBoundingClientRect().width,wrapWidth:wrap.clientWidth,internalOverflow:wrap.scrollWidth-wrap.clientWidth,bodyOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,role:wrap.getAttribute('role'),tabindex:wrap.getAttribute('tabindex'),aria:wrap.getAttribute('aria-label'),expected};}'''

def main():
    OUT.mkdir(parents=True,exist_ok=True);records=[];screenshots=[];html=fixture_html()
    with sync_playwright() as p:
        browser=launch_chromium(p);page=browser.new_page(viewport={'width':1440,'height':720})
        try:
            page.set_content(html,wait_until='domcontentloaded',timeout=30000)
            for width,height in VIEWPORTS:
                page.set_viewport_size({'width':width,'height':height})
                for theme in ('light','dark'):
                    page.evaluate("t=>document.documentElement.setAttribute('data-theme',t)",theme)
                    result=page.evaluate(f'({AUDIT})',HEADERS);issues=[]
                    if result['headerTexts']!=HEADERS:issues.append({'kind':'header-text','actual':result['headerTexts']})
                    for h in result['headers']:
                        if h['labelScrollWidth']>h['labelWidth']+1 or h['labelScrollHeight']>h['labelHeight']+1 or not h['inside']:issues.append({'kind':'clipped-heading','header':h})
                        if h['lines']>3:issues.append({'kind':'too-many-lines','header':h})
                        if h['cellHeight']<60:issues.append({'kind':'header-height','header':h})
                    if result['bodyOverflow']>1:issues.append({'kind':'body-overflow','px':result['bodyOverflow']})
                    if result['internalOverflow']<=0:issues.append({'kind':'missing-internal-scroll'})
                    if result['role']!='region' or result['tabindex']!='0' or not result['aria']:issues.append({'kind':'accessibility-region'})
                    # Bring representative headings into view and verify their whole cell fits in the non-sticky viewport.
                    visibility=[]
                    for index in (0,4,7,13,19,24):
                        data=page.evaluate('''index=>{const wrap=document.querySelector('.payroll-detail-wrap'),th=document.querySelectorAll('.payroll-detail-table thead th')[index],sticky=index<2?0:330;wrap.scrollLeft=Math.max(0,th.offsetLeft-sticky-12);const wr=wrap.getBoundingClientRect(),r=th.getBoundingClientRect();return {index,visible:r.right>wr.left+sticky&&r.left<wr.right};}''',index)
                        visibility.append(data)
                        if not data['visible']:issues.append({'kind':'not-scroll-visible','data':data})
                    if width in (1440,430) and theme=='light':
                        page.evaluate("document.querySelector('.payroll-detail-wrap').scrollLeft=0")
                        a=OUT/f'payroll-header-{width}-start.png';page.screenshot(path=str(a),full_page=False);screenshots.append(str(a))
                        page.evaluate("const w=document.querySelector('.payroll-detail-wrap');w.scrollLeft=w.scrollWidth")
                        b=OUT/f'payroll-header-{width}-end.png';page.screenshot(path=str(b),full_page=False);screenshots.append(str(b))
                    records.append({'width':width,'theme':theme,'result':result,'visibility':visibility,'issues':issues,'passed':not issues})
        finally:
            page.close();browser.close()
    summary={'releaseVersion':RELEASE_VERSION,'states':len(records),'passedStates':sum(x['passed'] for x in records),'failedStates':sum(not x['passed'] for x in records),'headingsPerState':25,'screenshots':screenshots,'passed':all(x['passed'] for x in records)}
    (OUT/'PAYROLL_HEADER_LAYOUT_AUDIT_V4_5_43.json').write_text(json.dumps({'summary':summary,'records':records},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(summary,ensure_ascii=False))
    if not summary['passed']:raise SystemExit(1)

if __name__=='__main__':main()
