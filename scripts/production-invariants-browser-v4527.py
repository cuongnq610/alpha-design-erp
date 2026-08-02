#!/usr/bin/env python3
"""Exercise the v4.5.29 production invariants through the real browser UI."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import base64
import json
import re
import sys

from qa_release_context import RELEASE_VERSION, evidence_dir, launch_chromium


root = Path(__file__).resolve().parents[1]
out = evidence_dir("production-invariants")
html = (root / "index.html").read_text(encoding="utf-8")
css = (root / "alpha-design-system.css").read_text(encoding="utf-8")
html = re.sub(
    r'<link rel="stylesheet" href="alpha-design-system\.css"\s*/?>',
    f"<style>{css}</style>",
    html,
)
for src in re.findall(r'<script src="([^"]+)"></script>', html):
    path = root / src
    if path.exists():
        html = html.replace(
            f'<script src="{src}"></script>',
            f"<script>\n{path.read_text(encoding='utf-8')}\n</script>",
            1,
        )
for name in [
    "logo-alpha-on-dark.png",
    "logo-alpha-transparent.png",
    "icon-192.png",
    "icon-512.png",
]:
    path = root / name
    html = html.replace(
        name, "data:image/png;base64," + base64.b64encode(path.read_bytes()).decode()
    )

# set_content has an opaque origin, so replace browser storage with deterministic memory storage.
html = html.replace("localStorage", "window.alphaStorage").replace(
    "sessionStorage", "window.alphaSessionStorage"
)
memory_storage = """<script>
function makeAlphaStorage(){let store={};return {
  getItem:k=>Object.prototype.hasOwnProperty.call(store,k)?store[k]:null,
  setItem:(k,v)=>{store[k]=String(v)},removeItem:k=>{delete store[k]},
  clear:()=>{store={}},key:i=>Object.keys(store)[i]||null,
  get length(){return Object.keys(store).length},dump:()=>({...store})
};}
window.alphaStorage=makeAlphaStorage();
window.alphaSessionStorage=makeAlphaStorage();
</script>"""
html = html.replace("<head>", "<head>" + memory_storage, 1)

results = {
    "releaseVersion": RELEASE_VERSION,
    "scope": [
        "finance-to-posted-cash-journal",
        "one-finance-row-per-cash-journal",
        "recognized-allocation-parent-lock",
        "posted-schedule-history-lock",
        "non-financial-asset-edit",
        "cross-module-delete-protection-by-soft-archive",
    ],
    "checks": [],
    "screenshots": [],
    "errors": [],
}


def check(name, actual, expected):
    passed = actual == expected
    results["checks"].append(
        {"name": name, "actual": actual, "expected": expected, "pass": passed}
    )
    if not passed:
        results["errors"].append(f"{name}: actual={actual!r}, expected={expected!r}")
    return passed


def check_contains(name, actual, expected_fragment):
    passed = expected_fragment.lower() in str(actual).lower()
    results["checks"].append(
        {
            "name": name,
            "actual": actual,
            "expectedContains": expected_fragment,
            "pass": passed,
        }
    )
    if not passed:
        results["errors"].append(
            f"{name}: actual={actual!r}, expected fragment={expected_fragment!r}"
        )
    return passed


def fill(page, name, value):
    locator = page.locator(f'#modalForm [name="{name}"]')
    tag = locator.evaluate("element => element.tagName")
    if tag == "SELECT":
        locator.select_option(str(value))
    else:
        locator.fill(str(value))


def feedback(page):
    box = page.locator("#modalForm .form-feedback")
    return box.inner_text() if box.count() else ""


def snapshot(page, name):
    path = out / f"{name}.png"
    page.screenshot(path=str(path), full_page=False, timeout=10_000)
    results["screenshots"].append(str(path.relative_to(root)))


def navigate(page, view):
    page.evaluate(
        """view => document.querySelector(`.nav-item[data-view="${view}"]`).click()""",
        view,
    )
    page.wait_for_timeout(180)


with sync_playwright() as playwright:
    browser = launch_chromium(playwright)
    page = browser.new_page(
        viewport={"width": 1440, "height": 1000}, device_scale_factor=1
    )
    page.set_default_timeout(7_000)
    page.on("pageerror", lambda error: results["errors"].append("pageerror: " + str(error)))
    page.set_content(html, wait_until="load", timeout=60_000)
    page.wait_for_timeout(450)
    page.evaluate(
        """() => {
          document.getElementById('loginScreen')?.classList.add('hidden');
          document.getElementById('appShell')?.classList.remove('hidden');
          document.body.classList.remove('auth-required');
          window.__qaAlerts=[];
          window.__qaConfirms=[];
          window.alert=message=>window.__qaAlerts.push(String(message));
          window.confirm=message=>{window.__qaConfirms.push(String(message));return true;};
        }"""
    )

    # 1. A Paid expense must not accept a Posted journal without the exact cash movement.
    navigate(page, "finance")
    page.locator("#primaryAction").click()
    fill(page, "date", "2026-07-05")
    fill(page, "type", "Expense")
    fill(page, "category", "QA mismatch")
    fill(page, "projectId", "pr1")
    fill(page, "amount", 48_000_000)
    fill(page, "status", "Paid")
    fill(page, "journalEntryId", "je3")
    fill(page, "description", "Phải bị chặn vì chứng từ không có biến động tiền")
    page.locator('#modalForm button[type="submit"]').click()
    page.wait_for_timeout(160)
    mismatch_feedback = feedback(page)
    check_contains(
        "Paid finance blocks a non-cash Posted journal",
        mismatch_feedback,
        "không khớp ngày, dự án, số tiền hoặc chiều",
    )
    check("Mismatched finance modal stays open", page.locator("#modalBackdrop").is_visible(), True)
    snapshot(page, "01-finance-exact-match-block")
    page.locator("#closeModal").click()

    # Add a cryptographically sealed Posted cash journal, then link it through the form.
    page.evaluate(
        """() => {
          const db=window.AlphaERP.getDB();
          const entry={
            id:'je-qa-cash-4527',date:'2026-07-28',
            documentNo:'UNC-2026-9999',sourceType:'Ủy nhiệm chi',
            cashFlowCode:'07',description:'QA chi tiền exact-match',
            status:'Posted',projectId:'pr1',partnerType:'',partnerId:'',
            lines:[
              {id:'jl-qa-1',accountCode:'6422',debit:1234567,credit:0,projectId:'pr1',description:'QA expense'},
              {id:'jl-qa-2',accountCode:'1121',debit:0,credit:1234567,projectId:'pr1',description:'QA bank payment'}
            ]
          };
          entry.postingHash=window.AlphaCalc.postingHash(entry);
          db.journalEntries.push(entry);
          if(!window.AlphaERP.commit(db))throw new Error('Could not seed exact cash journal');
        }"""
    )
    navigate(page, "finance")
    before_finance = page.evaluate("() => window.AlphaERP.getDB().finance.length")
    page.locator("#primaryAction").click()
    fill(page, "date", "2026-07-28")
    fill(page, "type", "Expense")
    fill(page, "category", "QA exact cash")
    fill(page, "projectId", "pr1")
    fill(page, "amount", 1_234_567)
    fill(page, "status", "Paid")
    fill(page, "journalEntryId", "je-qa-cash-4527")
    fill(page, "description", "Khoản chi QA khớp tuyệt đối chứng từ")
    page.locator('#modalForm button[type="submit"]').click()
    page.wait_for_timeout(320)
    after_exact = page.evaluate("() => window.AlphaERP.getDB().finance")
    exact_rows = [
        row for row in after_exact if row.get("journalEntryId") == "je-qa-cash-4527"
    ]
    check("Exact Paid finance is saved", len(after_exact), before_finance + 1)
    check("Exact journal has one Paid finance row", len(exact_rows), 1)
    check("Exact Paid amount remains integer VND", exact_rows[0]["amount"], 1_234_567)
    snapshot(page, "02-finance-exact-match-saved")

    # A second Paid row cannot reuse the same cash journal.
    page.locator("#primaryAction").click()
    fill(page, "date", "2026-07-28")
    fill(page, "type", "Expense")
    fill(page, "category", "QA duplicate")
    fill(page, "projectId", "pr1")
    fill(page, "amount", 1_234_567)
    fill(page, "status", "Paid")
    fill(page, "journalEntryId", "je-qa-cash-4527")
    fill(page, "description", "Phải bị chặn vì tái sử dụng chứng từ")
    page.locator('#modalForm button[type="submit"]').click()
    page.wait_for_timeout(160)
    duplicate_feedback = feedback(page)
    check_contains(
        "Cash journal cannot be reused by another Paid row",
        duplicate_feedback,
        "đã được liên kết với một khoản Paid khác",
    )
    check(
        "Duplicate link does not create finance row",
        page.evaluate("() => window.AlphaERP.getDB().finance.length"),
        before_finance + 1,
    )
    snapshot(page, "03-finance-one-to-one-block")
    page.locator("#closeModal").click()

    # 2. A recognized allocation protects the invoice's amount and business identity.
    navigate(page, "tax")
    original_invoice = page.evaluate(
        "() => window.AlphaERP.getDB().taxInvoices.find(row=>row.id==='txi1')"
    )
    page.locator('.edit-row[data-type="taxInvoices"][data-id="txi1"]').first.click()
    fill(page, "taxBase", 100_000_000)
    fill(page, "vatAmount", 10_000_000)
    page.locator('#modalForm button[type="submit"]').click()
    page.wait_for_timeout(160)
    allocation_feedback = feedback(page)
    check_contains(
        "Recognized allocation protects invoice total",
        allocation_feedback,
        "không được thấp hơn số đã phân bổ",
    )
    check(
        "Blocked invoice edit preserves total",
        page.evaluate(
            "() => window.AlphaERP.getDB().taxInvoices.find(row=>row.id==='txi1').totalAmount"
        ),
        original_invoice["totalAmount"],
    )
    snapshot(page, "04-invoice-allocation-parent-lock")
    page.locator("#closeModal").click()

    # 3. Once one schedule period is Posted, financial drivers and rebuild are locked,
    # while operational metadata remains editable.
    schedule_state = page.evaluate(
        """() => {
          const db=window.AlphaERP.getDB();
          const row=db.toolAllocationSchedules.find(item=>item.sourceId==='tool1');
          const entry=db.journalEntries.find(item=>item.id===row.journalEntryId);
          row.status='Posted';
          entry.status='Posted';
          entry.postedAt='2026-07-28T00:00:00.000Z';
          entry.postedBy='qa-runtime';
          entry.postingHash=window.AlphaCalc.postingHash(entry);
          const scheduleIds=db.toolAllocationSchedules
            .filter(item=>item.sourceId==='tool1').map(item=>item.id);
          if(!window.AlphaERP.commit(db))throw new Error('Could not seed Posted schedule');
          return {scheduleIds,originalCost:db.tools.find(item=>item.id==='tool1').originalCost};
        }"""
    )
    navigate(page, "procurement")
    page.locator('[data-procurement-tab="tools"]').click()
    page.wait_for_timeout(180)
    alert_count = page.evaluate("() => window.__qaAlerts.length")
    page.locator('.rebuild-tool-schedule[data-id="tool1"]').click()
    page.wait_for_timeout(100)
    rebuild_alerts = page.evaluate(
        "(start) => window.__qaAlerts.slice(start)", alert_count
    )
    check("Posted schedule rebuild raises one alert", len(rebuild_alerts), 1)
    check_contains(
        "Posted schedule rebuild is blocked",
        rebuild_alerts[0] if rebuild_alerts else "",
        "không thể tạo lại lịch",
    )
    check(
        "Blocked rebuild preserves schedule identity",
        page.evaluate(
            """() => window.AlphaERP.getDB().toolAllocationSchedules
              .filter(item=>item.sourceId==='tool1').map(item=>item.id)"""
        ),
        schedule_state["scheduleIds"],
    )
    snapshot(page, "05-posted-schedule-rebuild-lock")

    # Non-financial metadata remains editable.
    page.locator('.edit-row[data-type="tools"][data-id="tool1"]').click()
    fill(page, "department", "Vận hành QA")
    page.locator('#modalForm button[type="submit"]').click()
    page.wait_for_timeout(260)
    check(
        "Operational tool metadata remains editable",
        page.evaluate(
            "() => window.AlphaERP.getDB().tools.find(item=>item.id==='tool1').department"
        ),
        "Vận hành QA",
    )
    check(
        "Metadata edit preserves schedule identity",
        page.evaluate(
            """() => window.AlphaERP.getDB().toolAllocationSchedules
              .filter(item=>item.sourceId==='tool1').map(item=>item.id)"""
        ),
        schedule_state["scheduleIds"],
    )

    # Financial driver mutation must be rejected.
    page.locator('.edit-row[data-type="tools"][data-id="tool1"]').click()
    fill(page, "originalCost", schedule_state["originalCost"] + 1)
    page.locator('#modalForm button[type="submit"]').click()
    page.wait_for_timeout(160)
    driver_feedback = feedback(page)
    check_contains(
        "Posted schedule protects financial drivers",
        driver_feedback,
        "không thể tạo lại lịch",
    )
    check(
        "Blocked driver edit preserves original cost",
        page.evaluate(
            "() => window.AlphaERP.getDB().tools.find(item=>item.id==='tool1').originalCost"
        ),
        schedule_state["originalCost"],
    )
    snapshot(page, "06-posted-schedule-driver-lock")
    page.locator("#closeModal").click()

    # 4. Cross-module dependencies prevent hard deletion and use an auditable soft archive.
    navigate(page, "projects")
    confirm_count = page.evaluate("() => window.__qaConfirms.length")
    project_count = page.evaluate("() => window.AlphaERP.getDB().projects.length")
    contract_count = page.evaluate(
        "() => window.AlphaERP.getDB().contracts.filter(item=>item.projectId==='pr1').length"
    )
    page.locator('.delete-row[data-type="projects"][data-id="pr1"]').first.click()
    page.wait_for_timeout(100)
    deletion_confirms = page.evaluate(
        "(start) => window.__qaConfirms.slice(start)", confirm_count
    )
    check("Referenced project archival raises one confirmation", len(deletion_confirms), 1)
    check_contains(
        "Referenced project confirmation explains hard-delete protection",
        deletion_confirms[0] if deletion_confirms else "",
        "không được xóa vật lý",
    )
    check(
        "Soft archive preserves project row",
        page.evaluate("() => window.AlphaERP.getDB().projects.length"),
        project_count,
    )
    check(
        "Soft archive marks project Archived",
        page.evaluate(
            "() => window.AlphaERP.getDB().projects.find(item=>item.id==='pr1')?.status"
        ),
        "Archived",
    )
    check(
        "Soft archive records archival marker",
        page.evaluate(
            "() => window.AlphaERP.getDB().projects.find(item=>item.id==='pr1')?.isArchived"
        ),
        True,
    )
    check(
        "Soft archive preserves project identity",
        page.evaluate(
            "() => window.AlphaERP.getDB().projects.some(item=>item.id==='pr1')"
        ),
        True,
    )
    check(
        "Soft archive preserves linked contracts",
        page.evaluate(
            "() => window.AlphaERP.getDB().contracts.filter(item=>item.projectId==='pr1').length"
        ),
        contract_count,
    )
    snapshot(page, "07-cross-module-delete-protection")
    browser.close()

results["passedChecks"] = sum(item["pass"] for item in results["checks"])
results["failedChecks"] = sum(not item["pass"] for item in results["checks"])
results["passed"] = results["failedChecks"] == 0 and len(results["errors"]) == 0
(out / "production-invariants-browser-results.json").write_text(
    json.dumps(results, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
)
print(
    json.dumps(
        {
            "releaseVersion": RELEASE_VERSION,
            "passedChecks": results["passedChecks"],
            "failedChecks": results["failedChecks"],
            "errors": results["errors"],
        },
        ensure_ascii=False,
        indent=2,
    )
)
if not results["passed"]:
    sys.exit(1)
