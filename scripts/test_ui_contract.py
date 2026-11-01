#!/usr/bin/env python3
"""DOM contract test for the MeshBrowser UI.

The React migration (Phase 8) must not change the DOM contract of the UI: the
stylesheets target the class names, the native host derives its behaviour from
the element ids and the MCP tooling drives the pages by id. This test asserts
that contract page by page.

Two parts:

1. **Headless contract** — every page in ``ui/`` is rendered in headless
   Chrome/Edge (``--dump-dom``) and the resulting DOM is checked for the ids
   and classes the UI is contractually required to expose. This works without
   the native host, so it also proves that the React bundle degrades
   gracefully when ``window.cefQuery`` is missing.

2. **Live contract** — the real engine is started over MCP (stdio), a local
   page is opened in a tab and the DOM contract is asserted *inside the host*,
   including that the bridge still answers (``app.info``).

Usage::

    python scripts/test_ui_contract.py            # both parts
    python scripts/test_ui_contract.py --headless # only part 1
    python scripts/test_ui_contract.py --live     # only part 2
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

REPO_ROOT = Path(__file__).resolve().parent.parent
UI_DIR = REPO_ROOT / "ui"

# ---------------------------------------------------------------------------
# The contract
# ---------------------------------------------------------------------------
# Every entry: page file -> {"ids": [...], "classes": [...], "in": [...]} where
# "in" lists selectors (id or class) that must contain the other selectors.

CONTRACT = {
    "index.html": {
        "ids": [
            "browser-tabs",
            "browser-tab-new",
            "browser-reload",
            "browser-back",
            "browser-forward",
            "browser-search-form",
            "browser-search-toggle",
            "browser-search-input",
            "browser-adblock",
            "titlebar-min",
            "titlebar-max",
            "titlebar-close",
            "icon-maximize",
            "icon-restore",
            "shell",
            "workspace",
            "browser",
            "browser-start",
            "browser-start-stats-card",
            "browser-start-stats-value",
            "browser-view",
            "ai-glow-overlay",
            "ai-control-pill",
            "ai-control-pause-btn",
            "ai-control-btn-icon",
        ],
        "classes": [
            "titlebar",
            "titlebar-nav",
            "titlebar-left",
            "titlebar-search",
            "titlebar-search-form",
            "titlebar-search-toggle",
            "topbar-search-input",
            "topbar-btn",
            "topbar-adblock",
            "titlebar-tab-new",
            "titlebar-btn",
            "titlebar-controls",
            "shell",
            "workspace",
            "browser",
            "browser-start",
            "browser-view",
            "browser-view-slot",
            "ai-glow-overlay",
            "ai-control-pill",
        ],
        # A tab is rendered inside #browser-tabs and carries its parts.
        "within": [
            ("#browser-tabs", ".titlebar-tab"),
            ("#browser-tabs", ".titlebar-tab-label"),
            ("#browser-tabs", ".titlebar-tab-close"),
            ("#browser-tabs", ".titlebar-tab-favicon"),
        ],
    },
    "overlay.html": {
        "ids": ["overlay-root"],
        "classes": [],
        "within": [],
        "container": "overlay-root",
    },
    "bookmarks.html": {
        "ids": ["bm-nav-mesh", "bm-nav-clear", "bm-search", "bm-q", "bm-list", "bm-empty"],
        "classes": ["hist", "hist-aside", "hist-brand", "hist-navs", "hist-nav", "hist-main", "hist-search", "hist-search-input", "hist-list", "hist-empty"],
        "within": [],
    },
    "history.html": {
        "ids": [
            "hist-nav-mesh",
            "hist-nav-clear",
            "hist-search",
            "hist-q",
            "hist-actions",
            "hist-remove-selected",
            "hist-list",
            "hist-empty",
        ],
        "classes": ["hist", "hist-aside", "hist-brand", "hist-navs", "hist-nav", "hist-main", "hist-search", "hist-search-input", "hist-list", "hist-empty"],
        "within": [],
    },
    "downloads.html": {
        "ids": ["dl-nav-mesh", "dl-nav-clear", "dl-search", "dl-q", "dl-list", "dl-empty"],
        "classes": ["hist", "hist-aside", "hist-brand", "hist-navs", "hist-nav", "hist-main", "hist-search", "hist-search-input", "hist-list", "hist-empty"],
        "within": [],
    },
    "settings.html": {
        "ids": [
            "settings-appearance",
            "settings-search-engine",
            "settings-adblock-enabled",
            "settings-adblock-aggressive",
            "settings-status",
        ],
        "classes": ["hist", "settings-layout", "hist-aside", "settings-main", "settings-panel", "settings-group", "settings-card", "settings-options", "settings-field", "settings-option", "settings-status"],
        "within": [],
        "attrs": [
            ("[data-settings-nav]", "general"),
            ("[data-settings-nav]", "privacy"),
            ("[data-settings-panel]", "general"),
            ("[data-settings-panel]", "privacy"),
        ],
    },
    "info.html": {
        "ids": [
            "info-nav-about",
            "info-nav-updates",
            "info-panel-about",
            "info-panel-updates",
            "info-updates",
            "info-updates-status",
        ],
        "classes": ["hist", "hist-aside", "hist-main", "info-panel", "info-hero", "info-card", "info-facts", "info-fact"],
        "within": [],
    },
}


class DomIndex(HTMLParser):
    """Collects ids, classes, tag names and attributes of a DOM dump."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.ids: set[str] = set()
        self.classes: set[str] = set()
        self.tags: set[str] = set()
        self.attr_selectors: set[str] = set()
        self.stack: list[dict] = []

    def handle_starttag(self, tag: str, attrs) -> None:
        attrd = {k: (v or "") for k, v in attrs}
        self.tags.add(tag)
        node = {"tag": tag, "id": attrd.get("id", ""), "class": attrd.get("class", "")}
        self.stack.append(node)
        if node["id"]:
            self.ids.add(node["id"])
        for cls in node["class"].split():
            self.classes.add(cls)
        for key, value in attrd.items():
            if key.startswith("data-"):
                self.attr_selectors.add(f"[{key}]")
                if value:
                    self.attr_selectors.add(f"[{key}='{value}']")
            if key == "role":
                self.attr_selectors.add(f"[role='{value}']")

    def handle_endtag(self, tag: str) -> None:
        if self.stack:
            self.stack.pop()


def parse_elements(markup: str) -> DomIndex:
    index = DomIndex()
    index.feed(markup)
    return index


def find_by_selector(index: DomIndex, selector: str) -> bool:
    """Very small selector support: #id, .class, [attr], [attr='value']."""
    if selector.startswith("#"):
        return selector[1:] in index.ids
    if selector.startswith("."):
        return selector[1:] in index.classes
    if selector.startswith("["):
        return selector in index.attr_selectors
    return selector in index.tags


def find_browser() -> str | None:
    candidates = [
        os.environ.get("MESH_TEST_BROWSER", ""),
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        shutil.which("google-chrome") or "",
        shutil.which("chromium") or "",
        shutil.which("chromium-browser") or "",
    ]
    for candidate in candidates:
        if candidate and Path(candidate).is_file():
            return candidate
    return None


def dump_dom(browser: str, url: str, timeout: float = 60.0) -> str:
    with tempfile.TemporaryDirectory(prefix="mesh-ui-contract-") as profile:
        command = [
            browser,
            "--headless=new",
            "--disable-gpu",
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-extensions",
            *(["--no-sandbox"] if hasattr(os, "geteuid") and os.geteuid() == 0 else []),
            f"--user-data-dir={profile}",
            "--virtual-time-budget=4000",
            "--dump-dom",
            url,
        ]
        result = subprocess.run(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            timeout=timeout,
        )
    return result.stdout.decode("utf-8", errors="replace")


def check_page(page: str, markup: str, failures: list[str]) -> None:
    contract = CONTRACT[page]
    index = parse_elements(markup)

    container_id = contract.get("container", "app-root")
    if container_id not in index.ids:
        failures.append(
            f"{page}: the React mount container #{container_id} is missing"
        )
        return

    for element_id in contract["ids"]:
        if element_id not in index.ids:
            failures.append(f"{page}: missing id #{element_id}")
    for class_name in contract["classes"]:
        if class_name not in index.classes:
            failures.append(f"{page}: missing class .{class_name}")
    for selector, value in contract.get("attrs", []):
        # The contract spells the attribute as a CSS-ish "[data-...]"; the
        # index stores the matched selector as "[data-...='value']". Strip the
        # brackets off the contract side before comparing, otherwise the two
        # spellings never meet.
        attr = selector.strip()[1:-1]
        if f"[{attr}='{value}']" not in index.attr_selectors:
            failures.append(f"{page}: missing {selector}='{value}'")
    for parent, child in contract.get("within", []):
        if not find_by_selector(index, parent):
            failures.append(f"{page}: container {parent} is missing")
        elif not find_by_selector(index, child):
            failures.append(f"{page}: {child} is missing (expected inside {parent})")

    # The bundle must have executed: the pages tag the document with the page
    # name once the React root is mounted.
    if 'data-mesh-ui="' not in markup:
        failures.append(
            f"{page}: the React bundle did not mount (no data-mesh-ui marker on <html>)"
        )


def run_headless() -> int:
    browser = find_browser()
    if not browser:
        print("[headless] no Chrome/Edge found - skipping the headless contract")
        return 0
    print(f"[headless] rendering the pages with {browser}")

    failures: list[str] = []
    for page in CONTRACT:
        path = UI_DIR / page
        if not path.is_file():
            failures.append(f"{page}: the page does not exist - run `npm run build:ui` (the HTML pages are generated from ui-react/)")
            continue
        url = path.as_uri()
        markup = dump_dom(browser, url)
        if not markup.strip():
            failures.append(f"{page}: headless rendering produced no DOM")
            continue
        check_page(page, markup, failures)
        print(f"[headless] {page}: rendered {len(markup)} bytes")

    if failures:
        print("\n[headless] DOM contract FAILED:")
        for failure in failures:
            print(f"  - {failure}")
        return 1
    print("[headless] DOM contract OK for every page")
    return 0


# ---------------------------------------------------------------------------
# Live part: the real engine, driven over MCP
# ---------------------------------------------------------------------------

LOCAL_PAGES = ["bookmarks.html", "history.html", "downloads.html", "settings.html", "info.html"]

LIVE_EXPRESSIONS = {
    "bookmarks.html": """
      (function () {
        var q = function (s) { return !!document.querySelector(s); };
        return q('#bm-nav-mesh') && q('#bm-nav-clear') && q('#bm-search') &&
               q('#bm-q') && q('#bm-list') && q('#bm-empty') && q('.hist-nav');
      })()
    """,
    "history.html": """
      (function () {
        var q = function (s) { return !!document.querySelector(s); };
        return q('#hist-nav-mesh') && q('#hist-nav-clear') && q('#hist-search') &&
               q('#hist-q') && q('#hist-list') && q('#hist-empty') &&
               q('#hist-actions') && q('#hist-remove-selected');
      })()
    """,
    "downloads.html": """
      (function () {
        var q = function (s) { return !!document.querySelector(s); };
        return q('#dl-nav-mesh') && q('#dl-nav-clear') && q('#dl-search') &&
               q('#dl-q') && q('#dl-list') && q('#dl-empty');
      })()
    """,
    "settings.html": """
      (function () {
        var q = function (s) { return !!document.querySelector(s); };
        return q('#settings-appearance') && q('#settings-search-engine') &&
               q('#settings-adblock-enabled') && q('#settings-adblock-aggressive') &&
               q('#settings-status') && q('[data-settings-nav="general"]') &&
               q('[data-settings-panel="general"]');
      })()
    """,
    "info.html": """
      (function () {
        var q = function (s) { return !!document.querySelector(s); };
        return q('#info-nav-about') && q('#info-nav-updates') &&
               q('#info-panel-about') && q('#info-panel-updates') &&
               q('#info-updates') && q('#info-updates-status');
      })()
    """,
}

APP_INFO_EXPRESSION = """
  new Promise(function (resolve) {
    try {
      window.cefQuery({
        request: JSON.stringify({ method: 'app.info', params: {} }),
        persistent: false,
        onSuccess: function (payload) { resolve(JSON.parse(payload)); },
        onFailure: function (code, message) { resolve({ error: message || code }); }
      });
    } catch (err) {
      resolve({ error: String(err) });
    }
  })
"""


def find_exe() -> Path | None:
    env = os.environ.get("MESH_BROWSER_EXE", "")
    candidates = [
        Path(env) if env else None,
        REPO_ROOT / "build" / "native" / "Release" / "MeshBrowser.exe",
        REPO_ROOT / "build" / "native" / "Debug" / "MeshBrowser.exe",
    ]
    for candidate in candidates:
        if candidate and candidate.is_file():
            return candidate
    return None


class McpClient:
    """A minimal MCP stdio client (same protocol the other scripts use)."""

    def __init__(self, exe: Path) -> None:
        self.proc = subprocess.Popen(
            [str(exe), "--mcp"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            encoding="utf-8",
            errors="replace",
            bufsize=1,
        )
        self.next_id = 1

    def send(self, method: str, params: dict | None = None) -> dict:
        payload = {
            "jsonrpc": "2.0",
            "id": self.next_id,
            "method": method,
            "params": params or {},
        }
        self.next_id += 1
        assert self.proc.stdin and self.proc.stdout
        self.proc.stdin.write(json.dumps(payload) + "\n")
        self.proc.stdin.flush()
        line = self.proc.stdout.readline()
        if not line:
            return {}
        try:
            return json.loads(line)
        except json.JSONDecodeError:
            return {}

    def call_tool(self, name: str, arguments: dict | None = None) -> dict:
        response = self.send("tools/call", {"name": name, "arguments": arguments or {}})
        return response.get("result", {})

    def close(self) -> None:
        try:
            self.proc.terminate()
            self.proc.wait(timeout=5)
        except Exception:
            self.proc.kill()


def tool_text(result: dict) -> str:
    chunks = []
    for item in result.get("content", []) or []:
        if isinstance(item, dict) and item.get("type") == "text":
            chunks.append(item.get("text", ""))
    return "\n".join(chunks)


def run_live() -> int:
    exe = find_exe()
    if not exe:
        print("[live] MeshBrowser.exe not found - skipping the live contract")
        print("      (build it with: cmake --build build --config Release)")
        return 0

    print(f"[live] starting {exe}")
    client = McpClient(exe)
    failures: list[str] = []

    try:
        client.send(
            "initialize",
            {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "test-ui-contract", "version": "1.0.0"},
            },
        )
        time.sleep(3)

        status = client.call_tool("browser_status")
        if status.get("isError"):
            failures.append(f"browser_status failed: {tool_text(status)}")
        else:
            print("[live] browser_status ok")

        tabs = client.call_tool("browser_list_tabs")
        if tabs.get("isError"):
            failures.append(f"browser_list_tabs failed: {tool_text(tabs)}")
        else:
            print("[live] browser_list_tabs ok")

        for page in LOCAL_PAGES:
            url = (UI_DIR / page).as_uri()
            navigate = client.call_tool("browser_navigate", {"url": url})
            if navigate.get("isError"):
                failures.append(f"{page}: browser_navigate failed: {tool_text(navigate)}")
                continue
            time.sleep(1.5)
            evaluated = client.call_tool(
                "browser_eval_js", {"expression": LIVE_EXPRESSIONS[page]}
            )
            if evaluated.get("isError"):
                failures.append(f"{page}: browser_eval_js failed: {tool_text(evaluated)}")
                continue
            if "true" not in tool_text(evaluated).lower():
                failures.append(
                    f"{page}: the DOM contract is not satisfied inside the host "
                    f"({tool_text(evaluated).strip()[:200]})"
                )
                continue
            print(f"[live] {page}: DOM contract ok")

        # The bridge must still answer inside the host.
        evaluated = client.call_tool("browser_eval_js", {"expression": APP_INFO_EXPRESSION})
        text = tool_text(evaluated)
        if evaluated.get("isError") or '"error"' in text:
            failures.append(f"app.info did not answer: {text.strip()[:200]}")
        else:
            print("[live] app.info answered")
    finally:
        client.close()

    if failures:
        print("\n[live] contract FAILED:")
        for failure in failures:
            print(f"  - {failure}")
        return 1
    print("[live] contract OK")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--headless", action="store_true", help="only the headless contract")
    parser.add_argument("--live", action="store_true", help="only the live contract")
    args = parser.parse_args()

    do_headless = not args.live
    do_live = not args.headless

    result = 0
    if do_headless:
        result |= run_headless()
    if do_live:
        result |= run_live()
    return result


if __name__ == "__main__":
    sys.exit(main())
