#!/usr/bin/env python3
"""Shared release metadata and stable browser-audit helpers."""
from __future__ import annotations

import json
import os
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
_VERSION = json.loads((ROOT / "VERSION.json").read_text(encoding="utf-8"))
RELEASE_VERSION = str(_VERSION["version"])
RELEASE_TAG = "v" + RELEASE_VERSION.replace(".", "")
RELEASE_FILE_TOKEN = "V" + RELEASE_VERSION.replace(".", "_")


def chromium_executable(browser_type=None) -> Path:
    configured = os.environ.get("ALPHA_CHROMIUM_EXECUTABLE", "").strip()
    playwright_default = Path(getattr(browser_type, "executable_path", "")) if browser_type is not None and getattr(browser_type, "executable_path", "") else None
    headless_shells = []
    if playwright_default and len(playwright_default.parents) >= 3:
        headless_shells = sorted(
            playwright_default.parents[2].glob("chromium_headless_shell-*/chrome-linux/headless_shell"),
            reverse=True,
        )
    candidates = [
        configured,
        *headless_shells,
        shutil.which("chromium"),
        shutil.which("chromium-browser"),
        shutil.which("google-chrome"),
        shutil.which("google-chrome-stable"),
        playwright_default,
    ]
    for candidate in candidates:
        if candidate and Path(candidate).is_file():
            return Path(candidate).resolve()
    raise RuntimeError(
        "Không tìm thấy Chromium. Chạy `python3 -m playwright install chromium` "
        "hoặc đặt ALPHA_CHROMIUM_EXECUTABLE tới tệp trình duyệt hợp lệ."
    )


def launch_chromium(playwright, extra_args=None):
    args = list(dict.fromkeys(["--no-sandbox", *(extra_args or [])]))
    return playwright.chromium.launch(
        headless=True,
        executable_path=str(chromium_executable(playwright.chromium)),
        args=args,
    )


def evidence_dir(*parts: str) -> Path:
    path = ROOT / "quality" / f"final-{RELEASE_TAG}"
    for part in parts:
        path /= part
    path.mkdir(parents=True, exist_ok=True)
    return path


def wait_for_ui_ready(page, timeout: int = 15_000) -> None:
    page.wait_for_function("() => Boolean(window.AlphaERP && document.querySelector('#appShell'))", timeout=timeout)
    login = page.locator("#loginScreen")
    if login.count() and login.is_visible():
        demo = page.locator("[data-demo-login]").first
        if not demo.count():
            raise RuntimeError("Login screen is visible but no Demo login action exists")
        demo.scroll_into_view_if_needed()
        demo.click(force=True)
    page.wait_for_function(
        """() => {
          const login=document.querySelector('#loginScreen');
          const shell=document.querySelector('#appShell');
          return shell && (!login || login.classList.contains('hidden')) && !document.body.classList.contains('locked');
        }""",
        timeout=timeout,
    )
    wait_for_layout(page)


def wait_for_layout(page, delay_ms: int = 45) -> None:
    page.evaluate(
        """delay => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, delay))))""",
        delay_ms,
    )


def navigate_view(page, view: str, timeout: int = 8_000) -> None:
    found = page.evaluate(
        """view => {
          const el=document.querySelector(`.nav-item[data-view="${view}"]`);
          if(!el)return false;
          el.scrollIntoView({block:'center',inline:'nearest'});
          el.click();
          return true;
        }""",
        view,
    )
    if not found:
        raise RuntimeError(f"Missing navigation item: {view}")
    page.wait_for_function(
        "view => document.querySelector('.nav-item.active')?.dataset.view === view",
        arg=view,
        timeout=timeout,
    )
    wait_for_layout(page)
