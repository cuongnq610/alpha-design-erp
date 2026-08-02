#!/usr/bin/env python3
from __future__ import annotations

import base64
import json
import re
import xml.etree.ElementTree as ET
from pathlib import Path
from zipfile import ZipFile

from playwright.sync_api import sync_playwright

from qa_release_context import (
    RELEASE_FILE_TOKEN,
    RELEASE_VERSION,
    evidence_dir,
    launch_chromium,
    navigate_view,
    wait_for_layout,
    wait_for_ui_ready,
)

ROOT = Path(__file__).resolve().parents[1]
OUT = evidence_dir("export-center-v4560")


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


def choose(page, attribute: str, value: str) -> None:
    selector = f'[{attribute}="{value}"]'
    page.locator(selector).click()
    page.wait_for_function(
        """([attribute,value]) => document.querySelector(`[${attribute}="${value}"]`)?.classList.contains('active')""",
        arg=[attribute, value],
    )
    wait_for_layout(page)


def save_download(page, trigger, output: Path) -> str:
    with page.expect_download(timeout=20_000) as info:
        trigger()
    download = info.value
    download.save_as(str(output))
    return download.suggested_filename


def validate_zip(path: Path, required: tuple[str, ...]) -> list[str]:
    with ZipFile(path) as archive:
        names = archive.namelist()
        assert archive.testzip() is None
        for member in required:
            assert member in names, (member, names)
        return names


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    checks: dict[str, bool] = {}
    dialogs: list[str] = []
    page_errors: list[str] = []
    downloads: list[str] = []
    artifacts: dict[str, str] = {}

    with sync_playwright() as playwright:
        browser = launch_chromium(playwright)
        try:
            page = browser.new_page(viewport={"width": 1720, "height": 960}, accept_downloads=True)
            page.set_default_timeout(15_000)
            page.on("pageerror", lambda error: page_errors.append(str(error)))
            page.on("download", lambda download: downloads.append(download.suggested_filename))

            def on_dialog(dialog) -> None:
                dialogs.append(dialog.message)
                dialog.dismiss()

            page.on("dialog", on_dialog)
            page.set_content(inline_application(), wait_until="domcontentloaded", timeout=60_000)
            wait_for_ui_ready(page)
            navigate_view(page, "exports")

            # Incomplete TT133 must be blocked consistently for JSON, direct print and full ZIP.
            blocked_start = len(downloads)
            choose(page, "data-export-report", "tt133")
            choose(page, "data-export-format", "json")
            page.locator("#runExport").click()
            page.wait_for_function("() => AlphaERP.getDB().exportLogs?.[0]?.format === 'JSON'")
            checks["incompleteTT133JsonBlocked"] = page.evaluate(
                "() => AlphaERP.getDB().exportLogs[0].status === 'Failed'"
            )

            page.locator("#printExport").click()
            page.wait_for_function("() => AlphaERP.getDB().exportLogs?.[0]?.format === 'PDF'")
            checks["incompleteTT133PrintBlocked"] = page.evaluate(
                "() => AlphaERP.getDB().exportLogs[0].status === 'Failed'"
            )

            page.locator("#fullPackage").click()
            page.wait_for_function("() => AlphaERP.getDB().exportLogs?.[0]?.format === 'ZIP'")
            checks["incompleteTT133ZipBlocked"] = page.evaluate(
                "() => AlphaERP.getDB().exportLogs[0].status === 'Failed'"
            )
            page.wait_for_timeout(250)
            checks["blockedActionsProducedNoDownload"] = len(downloads) == blocked_start
            checks["blockedActionsExplainReason"] = (
                any("Không thể kết xuất" in item for item in dialogs)
                and any("Không thể in/phát hành" in item for item in dialogs)
                and any("Không thể tạo gói ZIP" in item for item in dialogs)
            )

            # Non-statutory data must export in every advertised format.
            choose(page, "data-export-report", "master")
            file_specs = {
                "xlsx": ("master.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
                "csv": ("master-csv.zip", "application/zip"),
                "xml": ("master.xml", "application/xml"),
                "docx": ("master.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
                "json": ("master.json", "application/json"),
            }
            for format_name, (filename, _) in file_specs.items():
                choose(page, "data-export-format", format_name)
                path = OUT / filename
                suggested = save_download(page, lambda: page.locator("#runExport").click(), path)
                checks[f"{format_name}Downloaded"] = path.is_file() and path.stat().st_size > 100
                checks[f"{format_name}Filename"] = suggested.lower().endswith(
                    ".zip" if format_name == "csv" else f".{format_name}"
                )
                artifacts[format_name] = str(path.relative_to(ROOT))

            xlsx_names = validate_zip(
                OUT / "master.xlsx",
                ("[Content_Types].xml", "xl/workbook.xml", "xl/worksheets/sheet1.xml"),
            )
            checks["xlsxStructureValid"] = len([name for name in xlsx_names if name.startswith("xl/worksheets/")]) == 6

            csv_names = validate_zip(OUT / "master-csv.zip", ())
            with ZipFile(OUT / "master-csv.zip") as archive:
                checks["csvZipValid"] = len(csv_names) == 6 and all(name.endswith(".csv") for name in csv_names)
                checks["csvUtf8Bom"] = all(archive.read(name).startswith(b"\xef\xbb\xbf") for name in csv_names)

            xml_root = ET.parse(OUT / "master.xml").getroot()
            xml_text = (OUT / "master.xml").read_text(encoding="utf-8")
            checks["xmlValid"] = xml_root.tag == "AlphaERPExport" and xml_root.attrib.get("version") == RELEASE_VERSION
            checks["xmlContainsNoSessionSecret"] = not re.search(
                r"access[_-]?token|refresh[_-]?token|service[_-]?role|sessionStorage", xml_text, re.I
            )

            with ZipFile(OUT / "master.docx") as archive:
                docx_names = archive.namelist()
                document_xml = archive.read("word/document.xml")
                ET.fromstring(document_xml)
                checks["docxValid"] = (
                    archive.testzip() is None
                    and "[Content_Types].xml" in docx_names
                    and "_rels/.rels" in docx_names
                )

            json_payload = json.loads((OUT / "master.json").read_text(encoding="utf-8"))
            json_text = json.dumps(json_payload, ensure_ascii=False)
            checks["jsonValid"] = (
                json_payload.get("report", {}).get("id") == "master"
                and bool(json_payload.get("meta", {}).get("range", {}).get("from"))
            )
            checks["jsonContainsNoSessionSecret"] = not re.search(
                r"access[_-]?token|refresh[_-]?token|service[_-]?role|sessionStorage", json_text, re.I
            )

            choose(page, "data-export-format", "pdf")
            with page.expect_popup(timeout=15_000) as popup_info:
                page.locator("#runExport").click()
            popup = popup_info.value
            popup.wait_for_timeout(250)
            print_text = popup.locator("body").inner_text()
            checks["pdfPrintViewValid"] = (
                "ALPHA DESIGN" in print_text
                and "Danh mục và số dư" in print_text
                and "Người lập" in print_text
                and "Giám đốc" in print_text
            )
            popup.close()

            # Activate a complete TT99 workflow and verify that the full package contains
            # only TT99 statutory forms while regime-linked master/cash-flow sheets follow TT99.
            gate = page.evaluate(
                """() => {
                  const db=window.AlphaERP.getDB();
                  db.settings.accountingRegime='TT99/2025/TT-BTC';
                  db.settings.accountingRegimeEffectiveDate='2026-01-01';
                  const now='2026-07-31T01:00:00.000Z';
                  const titles={I:'Đặc điểm hoạt động của doanh nghiệp',II:'Kỳ kế toán, đơn vị tiền tệ sử dụng trong kế toán',III:'Chuẩn mực và chế độ kế toán áp dụng',IV:'Các chính sách kế toán áp dụng',V:'Thông tin bổ sung cho các khoản mục trình bày trong Báo cáo tình hình tài chính',VI:'Thông tin bổ sung cho các khoản mục trình bày trong Báo cáo kết quả hoạt động kinh doanh',VII:'Thông tin bổ sung cho Báo cáo lưu chuyển tiền tệ',VIII:'Những thông tin khác'};
                  db.reportNotesTT99=Object.entries(titles).map(([sectionCode,sectionTitle],index)=>({
                    id:`note99-export-${sectionCode}`,periodFrom:'2026-01-01',periodTo:'2026-12-31',sectionCode,sectionTitle,
                    content:`Nội dung thuyết minh TT99 đã hoàn tất cho mục ${sectionCode}; dữ liệu kiểm thử gói phát hành.`,
                    status:'approved',contentSha256:`export-hash-${index+1}`,preparedBy:'qa-preparer',preparedAt:now,
                    reviewedBy:'qa-reviewer',reviewedAt:now,approvedBy:'qa-approver',approvedAt:now,workflowVersion:1,workflowComplete:true
                  }));
                  const committed=window.AlphaERP.commit(db);
                  const wb=window.AlphaExportCenter.catalog(window.AlphaERP.getDB(),{from:'2026-01-01',to:'2026-12-31'}).tt99;
                  return {committed,checks:wb.statutoryChecks};
                }"""
            )
            checks["tt99GatePrepared"] = bool(gate["committed"]) and all(bool(value) for value in gate["checks"].values())
            navigate_view(page, "exports")
            choose(page, "data-export-report", "tt99")
            package_path = OUT / "full-package-tt99.zip"
            suggested = save_download(page, lambda: page.locator("#fullPackage").click(), package_path)
            artifacts["fullPackage"] = str(package_path.relative_to(ROOT))
            checks["fullPackageDownloaded"] = suggested.endswith(".zip") and package_path.stat().st_size > 2_000

            package_names = validate_zip(
                package_path,
                ("04_BACKUP/ALPHA_DESIGN_ERP_Backup.json", "README.txt"),
            )
            statutory_names = [name for name in package_names if name.startswith(("01_EXCEL/", "02_XML/"))]
            checks["fullPackageSectionsPresent"] = all(
                any(name.startswith(prefix) for name in package_names)
                for prefix in ("01_EXCEL/", "02_XML/", "03_CSV/", "04_BACKUP/")
            )
            checks["fullPackageHasTT99"] = any("TT99" in name for name in statutory_names)
            checks["fullPackageExcludesTT133Forms"] = not any(
                re.search(r"B01a_DNN|B02_DNN|B03_DNN|B09_DNN|F01_DNN|tai_chinh_TT133", name, re.I)
                for name in package_names
            )
            with ZipFile(package_path) as archive:
                master_xml_name = next(name for name in package_names if name.startswith("02_XML/Danh_muc_va_so_du"))
                cash_xml_name = next(name for name in package_names if name.startswith("02_XML/Dong_tien_va_thanh_khoan"))
                master_xml = archive.read(master_xml_name).decode("utf-8")
                cash_xml = archive.read(cash_xml_name).decode("utf-8")
                ET.fromstring(master_xml)
                ET.fromstring(cash_xml)
                checks["tt99MasterTitlePropagated"] = "Hệ thống tài khoản TT99" in master_xml
                checks["tt99CashFlowPropagated"] = 'name="B03_DN"' in cash_xml and "B03-DN" in cash_xml

            checks["allSuccessfulExportsLogged"] = page.evaluate(
                """() => {
                  const logs=AlphaERP.getDB().exportLogs||[];
                  const formats=new Set(logs.filter(x=>x.status==='Success').map(x=>x.format));
                  return ['XLSX','CSV','XML','DOCX','JSON','PDF','ZIP'].every(x=>formats.has(x));
                }"""
            )
        finally:
            browser.close()

    checks["noPageErrors"] = not page_errors
    result = {
        "releaseVersion": RELEASE_VERSION,
        "checks": checks,
        "passedChecks": sum(1 for value in checks.values() if value),
        "totalChecks": len(checks),
        "dialogs": dialogs,
        "pageErrors": page_errors,
        "artifacts": artifacts,
    }
    result["passed"] = all(checks.values())
    output = OUT / f"EXPORT_CENTER_BROWSER_AUDIT_{RELEASE_FILE_TOKEN}.json"
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False))
    if not result["passed"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
