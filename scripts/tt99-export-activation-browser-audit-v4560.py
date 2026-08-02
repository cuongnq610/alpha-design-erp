#!/usr/bin/env python3
from __future__ import annotations

import base64
import json
import re
from pathlib import Path

from playwright.sync_api import sync_playwright

from qa_release_context import RELEASE_FILE_TOKEN, RELEASE_VERSION, evidence_dir, launch_chromium, navigate_view, wait_for_layout, wait_for_ui_ready

ROOT = Path(__file__).resolve().parents[1]
OUT = evidence_dir("tt99-export-activation")


def inline_application() -> str:
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    css = (ROOT / "alpha-design-system.css").read_text(encoding="utf-8")
    html = re.sub(r'<link rel="stylesheet" href="alpha-design-system\.css"\s*/?>', f"<style>{css}</style>", html)
    for src in re.findall(r'<script src="([^"]+)"></script>', html):
        path = ROOT / src
        if path.exists():
            html = html.replace(f'<script src="{src}"></script>', f"<script>\n{path.read_text(encoding='utf-8')}\n</script>", 1)
    for name in ("logo-alpha-on-dark.png", "logo-alpha-transparent.png", "icon-192.png", "icon-512.png"):
        path = ROOT / name
        if path.exists():
            html = html.replace(name, "data:image/png;base64," + base64.b64encode(path.read_bytes()).decode())
    html = html.replace("localStorage", "window.alphaStorage").replace("sessionStorage", "window.alphaSessionStorage")
    storage = """<script>
    function makeAlphaStorage(){let store={};return {getItem:k=>Object.prototype.hasOwnProperty.call(store,k)?store[k]:null,setItem:(k,v)=>{store[k]=String(v)},removeItem:k=>{delete store[k]},clear:()=>{store={}},key:i=>Object.keys(store)[i]||null,get length(){return Object.keys(store).length}};}
    window.alphaStorage=makeAlphaStorage();window.alphaSessionStorage=makeAlphaStorage();
    </script>"""
    return html.replace("<head>", "<head>" + storage, 1)


def log(message: str) -> None:
    print(message, flush=True)


def main() -> None:
    checks: dict[str, bool] = {}
    dialogs: list[str] = []
    page_errors: list[str] = []
    xlsx_path = OUT / "Bo_bao_cao_tai_chinh_TT99_2026-01-01_2026-12-31.xlsx"
    preview_path = OUT / f"TT99_EXPORT_CENTER_{RELEASE_FILE_TOKEN}.png"

    with sync_playwright() as playwright:
        browser = launch_chromium(playwright)
        try:
            page = browser.new_page(viewport={"width": 1744, "height": 920}, accept_downloads=True)
            page.on("pageerror", lambda error: page_errors.append(str(error)))
            page.on("dialog", lambda dialog: (dialogs.append(dialog.message), dialog.dismiss()))
            log("stage:set_content")
            page.set_content(inline_application(), wait_until="domcontentloaded", timeout=60_000)
            wait_for_ui_ready(page)
            log("stage:ui_ready")

            page.evaluate("""() => {
              const from=document.getElementById('dateFrom'),to=document.getElementById('dateTo');
              if(from)from.value='2026-01-01';if(to)to.value='2026-12-31';
            }""")
            navigate_view(page, "exports")
            log("stage:exports")

            tt99 = page.locator('[data-export-report="tt99"]')
            checks["tt99CardVisible"] = tt99.count() == 1 and tt99.is_visible()
            tt99.click()
            page.wait_for_function("() => document.querySelector('[data-export-report=\"tt99\"]')?.classList.contains('active')")
            checks["tt99SelectionPersistsUnderTT133"] = page.locator('[data-export-report="tt99"].active').count() == 1
            checks["tt99PreviewTitle"] = page.locator(".export-preview h3").inner_text().strip() == "Bộ báo cáo tài chính TT99"
            checks["regimeMismatchNoticeVisible"] = page.locator(".export-regime-notice").count() == 1 and "TT133" in page.locator(".export-regime-notice").inner_text()

            gate = page.evaluate("""() => {
              const db=window.AlphaERP.getDB();
              db.settings.accountingRegime='TT99/2025/TT-BTC';
              db.settings.accountingRegimeEffectiveDate='2026-01-01';
              const now='2026-07-31T01:00:00.000Z';
              const titles={I:'Đặc điểm hoạt động của doanh nghiệp',II:'Kỳ kế toán, đơn vị tiền tệ sử dụng trong kế toán',III:'Chuẩn mực và chế độ kế toán áp dụng',IV:'Các chính sách kế toán áp dụng',V:'Thông tin bổ sung cho các khoản mục trình bày trong Báo cáo tình hình tài chính',VI:'Thông tin bổ sung cho các khoản mục trình bày trong Báo cáo kết quả hoạt động kinh doanh',VII:'Thông tin bổ sung cho Báo cáo lưu chuyển tiền tệ',VIII:'Những thông tin khác'};
              db.reportNotesTT99=Object.entries(titles).map(([sectionCode,sectionTitle],index)=>({
                id:`note99-audit-${sectionCode}`,periodFrom:'2026-01-01',periodTo:'2026-12-31',sectionCode,sectionTitle,
                content:`Nội dung thuyết minh TT99 đã hoàn tất cho mục ${sectionCode}; dữ liệu dùng riêng cho kiểm thử phát hành v${window.AlphaERP.version}.`,
                status:'approved',contentSha256:`audit-hash-${index+1}`,preparedBy:'qa-preparer',preparedAt:now,
                reviewedBy:'qa-reviewer',reviewedAt:now,approvedBy:'qa-approver',approvedAt:now,workflowVersion:1,workflowComplete:true
              }));
              const committed=window.AlphaERP.commit(db);
              const range={from:'2026-01-01',to:'2026-12-31'};
              const wb=window.AlphaExportCenter.catalog(window.AlphaERP.getDB(),range).tt99;
              return {committed,checks:wb.statutoryChecks,sheets:wb.sheets.map(x=>x.name),noteCount:window.AlphaCalc.tt99B09(window.AlphaERP.getDB(),range).approvedCount};
            }""")
            wait_for_layout(page)
            checks["tt99RegimeCommitted"] = bool(gate["committed"])
            checks["tt99LocalStatutoryGatePasses"] = all(bool(value) for value in gate["checks"].values())
            checks["tt99HasExpectedForms"] = gate["sheets"] == ["B01_DN", "B02_DN", "B03_DN", "BCDSPS", "B09_DN"]
            checks["tt99B09EightOfEight"] = gate["noteCount"] == 8
            checks["regimeMismatchNoticeClears"] = page.locator(".export-regime-notice").count() == 0
            page.screenshot(path=str(preview_path), full_page=False)
            log("stage:preview_screenshot")

            with page.expect_download(timeout=15_000) as download_info:
                page.locator("#runExport").click()
            download = download_info.value
            download.save_as(str(xlsx_path))
            checks["tt99XlsxDownloaded"] = xlsx_path.is_file() and xlsx_path.stat().st_size > 2_000
            checks["tt99XlsxFilename"] = "TT99" in download.suggested_filename and download.suggested_filename.endswith(".xlsx")
            log("stage:download")

            app_source=(ROOT / "app.js").read_text(encoding="utf-8")
            checks["tt99B09EditBindingPresent"] = 'data-note-type="${isTT99?\'reportNotesTT99\':\'reportNotesTT133\'}"' in app_source
            checks["tt99B09FormConfigPresent"] = "reportNotesTT99:{title:'Thuyết minh B09-DN'" in app_source
            log("stage:source_contracts")
        finally:
            browser.close()

    checks["noUnexpectedDialogs"] = len(dialogs) == 0
    checks["noPageErrors"] = len(page_errors) == 0
    result = {
        "releaseVersion": RELEASE_VERSION,
        "checks": checks,
        "passedChecks": sum(1 for value in checks.values() if value),
        "totalChecks": len(checks),
        "dialogs": dialogs,
        "pageErrors": page_errors,
        "artifacts": {
            "xlsx": str(xlsx_path.relative_to(ROOT)),
            "exportCenterScreenshot": str(preview_path.relative_to(ROOT)),
        },
    }
    result["passed"] = all(checks.values())
    output = OUT / f"TT99_EXPORT_ACTIVATION_BROWSER_AUDIT_{RELEASE_FILE_TOKEN}.json"
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False))
    if not result["passed"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
