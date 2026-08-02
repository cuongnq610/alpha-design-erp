#!/usr/bin/env python3
"""Browser structural audit for the current ALPHA DESIGN ERP release.
Checks table balance, overflow, circular markers, KPI clipping and runtime errors.
Intermediate responsive widths are also covered by responsive-browser-audit.py.
This structural matrix retains all seven viewport boundaries and rotates the page
after two viewports to prevent accumulated chart observers from slowing Chromium.
"""
from __future__ import annotations

import base64
import json
import re
from pathlib import Path

from playwright.sync_api import sync_playwright
from qa_release_context import RELEASE_VERSION, evidence_dir, launch_chromium, wait_for_layout, wait_for_ui_ready

ROOT = Path(__file__).resolve().parents[1]
OUT = evidence_dir("ui")
VIEWPORTS = [(1920, 1080), (1792, 1000), (1536, 1000), (1440, 1000), (1024, 900), (768, 900), (390, 844)]


def inline_application() -> str:
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    css = (ROOT / "alpha-design-system.css").read_text(encoding="utf-8")
    html = re.sub(r'<link rel="stylesheet" href="alpha-design-system\.css"\s*/?>', f"<style>{css}</style>", html)
    for src in re.findall(r'<script src="([^"]+)"></script>', html):
        path = ROOT / src
        if path.exists():
            html = html.replace(f'<script src="{src}"></script>', f'<script>\n{path.read_text(encoding="utf-8")}\n</script>', 1)
    for name in ("logo-alpha-on-dark.png", "logo-alpha-transparent.png", "icon-192.png", "icon-512.png"):
        path = ROOT / name
        html = html.replace(name, "data:image/png;base64," + base64.b64encode(path.read_bytes()).decode())
    html = html.replace("localStorage", "window.alphaStorage").replace("sessionStorage", "window.alphaSessionStorage")
    memory_storage = """<script>
function makeAlphaStorage(){let store={};return {getItem:k=>Object.prototype.hasOwnProperty.call(store,k)?store[k]:null,setItem:(k,v)=>{store[k]=String(v)},removeItem:k=>{delete store[k]},clear:()=>{store={}},key:i=>Object.keys(store)[i]||null,get length(){return Object.keys(store).length}};}
window.alphaStorage=makeAlphaStorage();window.alphaSessionStorage=makeAlphaStorage();
</script>"""
    return html.replace("<head>", "<head>" + memory_storage, 1)


AUDIT_JS = r"""() => {
  const visible = (e) => {
    const r = e.getBoundingClientRect(), s = getComputedStyle(e);
    return r.width > .5 && r.height > .5 && s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) !== 0;
  };
  const tableIssues = [];
  document.querySelectorAll('.table-wrap').forEach((wrap, index) => {
    if (!visible(wrap)) return;
    const table = wrap.querySelector('table'); if (!table) return;
    const cols = table.querySelectorAll('thead th').length || Math.max(0, ...[...table.rows].map((row) => row.cells.length));
    const overflowPixels = Math.max(0, wrap.scrollWidth - wrap.clientWidth);
    const overflow = overflowPixels > 0;
    const marked = wrap.classList.contains('is-scrollable') && wrap.getAttribute('role') === 'region' && wrap.tabIndex === 0;
    const fit = table.classList.contains('table-fit');
    const balanced = table.classList.contains('balanced-table');
    if (!balanced || (overflowPixels > 2 && !marked) || (innerWidth >= 1025 && cols <= 6 && overflowPixels > 0) || (!fit && cols <= 6)) {
      tableIssues.push({ index, cols, overflow, overflowPixels, marked, fit, balanced, scrollWidth: wrap.scrollWidth, clientWidth: wrap.clientWidth });
    }
  });
  const bodyOverflow = Math.max(document.body.scrollWidth, document.documentElement.scrollWidth) - innerWidth;
  const squareMarkers = [...document.querySelectorAll('.legend-dot,.donut-row i')].filter(visible).filter((e) => {
    const r = e.getBoundingClientRect(), radius = parseFloat(getComputedStyle(e).borderRadius);
    return Math.abs(r.width-r.height) < 1 && radius < Math.min(r.width,r.height)*.45;
  }).map((e) => ({ className: String(e.className), width: e.getBoundingClientRect().width, radius: getComputedStyle(e).borderRadius }));
  const kpiTextOverflow = [];
  document.querySelectorAll('.kpi-label,.kpi-foot span').forEach((e) => {
    if (visible(e) && e.scrollWidth > e.clientWidth + 2) kpiTextOverflow.push({ className: String(e.className), text: e.textContent.trim().slice(0,80), scrollWidth:e.scrollWidth, clientWidth:e.clientWidth });
  });
  const attentionPseudoArtifacts = [...document.querySelectorAll('.kpi-card.is-attention')].filter(visible).filter((e) => {
    const p=getComputedStyle(e,'::after'), w=parseFloat(p.width)||0, h=parseFloat(p.height)||0;
    return p.content !== 'none' && p.content !== 'normal' && (w > 1 || h > 1 || p.display !== 'none');
  }).map((e)=>({content:getComputedStyle(e,'::after').content,width:getComputedStyle(e,'::after').width,height:getComputedStyle(e,'::after').height}));
  const oversizedDashboardKpis = innerWidth >= 1280 ? [...document.querySelectorAll('.dashboard-core-grid>.kpi-card')].filter(visible).filter((e,i)=>e.getBoundingClientRect().height > (i<4?134:122)).map((e)=>({height:e.getBoundingClientRect().height,text:e.querySelector('.kpi-label')?.textContent||''})) : [];
  const malformedDonuts = [...document.querySelectorAll('.donut-center')].filter(visible).filter((e) => {
    const r=e.getBoundingClientRect(); return parseFloat(getComputedStyle(e).borderRadius) < Math.min(r.width,r.height)*.45;
  }).map((e)=>({radius:getComputedStyle(e).borderRadius,background:getComputedStyle(e).backgroundColor}));
  return {tableIssues,bodyOverflow,squareMarkers,kpiTextOverflow,malformedDonuts,attentionPseudoArtifacts,oversizedDashboardKpis};
}"""



def main() -> None:
    html = inline_application()
    records, view_names = [], []
    states = 0
    batch_audit_js = f"""async views => {{
      const audit = {AUDIT_JS};
      const rows=[];
      for (const view of views) {{
        const el=document.querySelector(`.nav-item[data-view="${{view}}"]`);
        if(!el) {{ rows.push({{view,runnerError:`Missing navigation item: ${{view}}`}}); continue; }}
        el.click();
        await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
        const active=document.querySelector('.nav-item.active')?.dataset.view;
        if(active!==view) {{ rows.push({{view,runnerError:`Navigation did not activate ${{view}} (active=${{active||'none'}})`}}); continue; }}
        rows.push({{view,...audit()}});
      }}
      return rows;
    }}"""
    with sync_playwright() as p:
        browser = launch_chromium(p)
        try:
            # Rotate the page after two viewport sessions (four theme batches).
            # Reusing one page for the entire 364-state matrix accumulates chart
            # observers and scheduled render work; using one page per viewport,
            # on the other hand, spends most of the audit reinitializing the app.
            # Two viewports per page preserves full coverage and deterministic
            # runtime without reducing the audited state matrix.
            for group_start in range(0, len(VIEWPORTS), 2):
                group = VIEWPORTS[group_start:group_start + 2]
                page = browser.new_page(viewport={"width": group[0][0], "height": group[0][1]})
                page.set_default_timeout(12_000)
                page_errors = []
                page.on("pageerror", lambda exc, sink=page_errors: sink.append(str(exc)))
                try:
                    page.set_content(html, wait_until="domcontentloaded", timeout=60_000)
                    wait_for_ui_ready(page)
                    current_views = page.evaluate("[...new Set([...document.querySelectorAll('.nav-item[data-view]')].map((x)=>x.dataset.view))]")
                    if not view_names:
                        view_names = current_views
                    elif current_views != view_names:
                        records.append({"width": group[0][0], "height": group[0][1], "theme": "__setup__", "view": "__runtime__", "runnerError": "Navigation set changed between viewport sessions"})
                    for width, height in group:
                        page.set_viewport_size({"width": width, "height": height})
                        for theme in ("light", "dark"):
                            page.evaluate("theme => document.documentElement.setAttribute('data-theme', theme)", theme)
                            wait_for_layout(page, 10)
                            before_errors = len(page_errors)
                            for view in current_views:
                                result = page.evaluate(f"""async view => {{
                                  const audit = {AUDIT_JS};
                                  const el=document.querySelector(`.nav-item[data-view=\"${{view}}\"]`);
                                  if(!el) return {{runnerError:`Missing navigation item: ${{view}}`}};
                                  el.click();
                                  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
                                  const active=document.querySelector('.nav-item.active')?.dataset.view;
                                  if(active!==view) return {{runnerError:`Navigation did not activate ${{view}} (active=${{active||'none'}})`}};
                                  return audit();
                                }}""", view)
                                states += 1
                                if result.get("runnerError") or result.get("tableIssues") or result.get("bodyOverflow", 0) > 2 or result.get("squareMarkers") or result.get("kpiTextOverflow") or result.get("malformedDonuts") or result.get("attentionPseudoArtifacts") or result.get("oversizedDashboardKpis"):
                                    records.append({"width": width, "height": height, "theme": theme, "view": view, **result})
                            new_errors = page_errors[before_errors:]
                            if new_errors:
                                records.append({"width": width, "height": height, "theme": theme, "view": "__runtime__", "errors": new_errors})
                finally:
                    page.close()
        finally:
            browser.close()
    summary = {
      "releaseVersion": RELEASE_VERSION, "views": len(view_names), "viewNames": view_names,
      "viewports": [f"{w}x{h}" for w,h in VIEWPORTS], "themes": ["light","dark"], "statesAudited": states,
      "issueRecords": len(records), "tableIssues": sum(len(x.get("tableIssues",[])) for x in records),
      "bodyOverflowIssues": sum(1 for x in records if x.get("bodyOverflow",0)>2),
      "squareMarkerIssues": sum(len(x.get("squareMarkers",[])) for x in records),
      "kpiTextOverflowIssues": sum(len(x.get("kpiTextOverflow",[])) for x in records),
      "malformedDonutIssues": sum(len(x.get("malformedDonuts",[])) for x in records),
      "attentionPseudoArtifactIssues": sum(len(x.get("attentionPseudoArtifacts",[])) for x in records),
      "oversizedDashboardKpiIssues": sum(len(x.get("oversizedDashboardKpis",[])) for x in records),
      "scriptErrors": sum(len(x.get("errors",[])) for x in records) + sum(1 for x in records if x.get("runnerError")),
      "authenticatedDemoSession": True,
      "passed": len(records) == 0,
      "contrastNote": "Contrast is covered by static regressions and visual screenshots; translucent CSS layers are excluded from this structural audit."
    }
    (OUT / "structural-browser-audit.json").write_text(json.dumps({"summary":summary,"issues":records},ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(summary,ensure_ascii=False,indent=2))
    if records: raise SystemExit(1)

if __name__ == "__main__": main()
