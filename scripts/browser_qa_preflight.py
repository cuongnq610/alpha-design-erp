#!/usr/bin/env python3
"""Fail fast with actionable setup guidance before the deep browser audit."""
from __future__ import annotations

import importlib
import json
import sys

missing = []
for module, package in (("bs4", "beautifulsoup4"), ("playwright.sync_api", "playwright")):
    try:
        importlib.import_module(module)
    except ImportError:
        missing.append(package)

if missing:
    print(
        "BROWSER_QA_PREFLIGHT_FAILED thiếu gói Python: "
        + ", ".join(missing)
        + ". Chạy: python3 -m pip install -r requirements-qa.txt",
        file=sys.stderr,
    )
    raise SystemExit(2)

from playwright.sync_api import sync_playwright
from qa_release_context import RELEASE_VERSION, chromium_executable, launch_chromium

try:
    with sync_playwright() as playwright:
        executable = chromium_executable(playwright.chromium)
        browser = launch_chromium(playwright)
        browser.close()
except Exception as exc:
    print(f"BROWSER_QA_PREFLIGHT_FAILED không thể khởi động Chromium: {exc}", file=sys.stderr)
    raise SystemExit(2)

print(json.dumps({
    "releaseVersion": RELEASE_VERSION,
    "pythonDependencies": "ready",
    "chromiumExecutable": str(executable),
    "passed": True,
}, ensure_ascii=False))
