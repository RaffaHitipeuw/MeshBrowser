# Phase 7 — React Migration Audit (MeshBrowser / Mesh Engine)

**Status:** audit & planning only. No application source was modified, nothing was committed.
**Scope:** `ui/` (web layer) vs. `native/` (CEF 144 host) in this repository.

---

## 0. Executive summary

The web UI is **7 hand-written HTML pages + ~14.5k lines of vanilla JS/CSS with no build step**.
There is no `package.json`, no bundler, no Node in CI. The native host loads the pages as
`file://` URLs and talks to them through exactly one transport: a JSON-RPC channel over
`window.cefQuery`, plus two persistent event streams (`browser.subscribe`, `overlay.subscribe`).

The decisive constraint for the migration is **not** React — it is that pages are served from
`file://` with **no `--allow-file-access-from-files` switch**
(`native/src/engine/engine_app.cpp:19-27`, `native/src/app/mesh_app.cpp:22`). Chromium blocks
ES-module scripts from `file://` (opaque origin + CORS), so **the React bundle must be a classic
IIFE script**, not `<script type="module">` and not a Vite/Rollup ESM build.

Recommended approach: **Option B — incremental React islands over the existing page/DOM contract**
(esbuild → IIFE bundles into `ui/js/generated/`), keeping `ui/*.html`, `ui/css/**`, the native
trust model, the release packaging and the dev hot-reload untouched. A full SPA rewrite (Option A)
is possible later, but it is not the smallest viable step and it forces native + release changes
for no functional gain in Phase 8.

---

## 1. Current architecture map

### 1.1 Runtime topology

```
                      ┌──────────────────────────────────────────────┐
  MCP client ──stdio──┤ MeshEngine.exe --mcp  (JSON-RPC proxy)      │
  (scripts/*.py,      └───────────────┬──────────────────────────────┘
   Claude Desktop,                    │ http://127.0.0.1:8999/mcp
   Cursor, …)                         ▼
                      ┌──────────────────────────────────────────────┐
                      │ MCP server (native/src/mcp/*)               │
                      │  tools: browser_*, page.*                   │
                      └───────────────┬──────────────────────────────┘
                                      │ engine::EngineClient contract
                                      ▼
┌───────────────────── CEF 144 / Chromium 144 window (CefWindow, box layout) ─────────────────────┐
│ row 1: shell_browser_view_  → file://…/ui/index.html        (chrome: titlebar + address bar)  │
│ row 2: content browser view → the active tab's web page     (one CefBrowser per tab)           │
│ row 2 (alt): devtools_browser_view_ when DevTools is docked                                     │
│ floating: overlay_browser_view_ → file://…/ui/overlay.html  (CefOverlayController)              │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

Facts and citations:

| Fact | Evidence |
|---|---|
| Shell UI = `file://…/ui/index.html` (+`?private=1` in private mode) | `native/src/platform/paths.cpp:239-247`, `native/include/mesh/paths.h:83-86` |
| Overlay UI = `file://…/ui/overlay.html`, in a separate browser view + overlay controller | `native/src/platform/paths.cpp:249-252`, `native/src/app/mesh_handler.cpp:1438-1460`, `:1598-1623` |
| Dev mode serves the repo `ui/` folder; release serves `<exe>/ui` | `native/src/platform/paths.cpp:230-238` |
| Dev hot reload watches the UI dir for `.html .htm .css .js .svg .png .jpg .jpeg .webp .json` and reloads the shell | `native/src/dev/ui_hot_reload.cpp:29-58`, `native/src/app/mesh_handler.cpp:2555-2561` |
| Content browser is laid out **below** the shell; the shell reports its chrome height (`browser.setChromeHeight`) | `native/src/app/mesh_handler.cpp:892-960` |
| One CEF browser per tab, only the active one is visible/flexed | `native/src/app/mesh_handler.cpp:906-960` |
| Native app menu is a **CEF Views menu** (`CefWindow::ShowMenu`), not HTML | `ui/js/features/browser/menu.js:1-4`, `native/include/engine/engine_client.h:118-125` |
| Find bar is **native**, not HTML (shell only toggles it) | `ui/js/features/browser/find.js:4-25`, `native/include/engine/engine_client.h:103-105` |
| MCP HTTP transport on `127.0.0.1:8999` (`/sse`, `/message`, `/mcp`, `/api`) | `native/src/mcp/mcp_http_server.cpp:496-607` |
| MCP stdio mode launches/attaches to the GUI and proxies to the HTTP port | `native/src/mcp/mcp_server.cpp`, `docs/MCP_INTEGRATION.md` |
| MCP drives the browser **through native APIs only** — it never touches the shell DOM | `native/src/mcp/mcp_server.cpp:1483-1492`, `:1049`, `:1360` |
| Ad-block cosmetics + scrollbar styling are **injected JS into web content**, not the shell | `native/src/app/scrollbar_inject.cpp:414-449`, `:755-814` |
| Rust adblock engine via C FFI | `native/adblock_ffi/`, `native/src/adblock/*` |

### 1.2 Build & packaging

| Stage | Mechanism | Evidence |
|---|---|---|
| CEF download | pinned `144.0.32+g5ce7d26+chromium-144.0.7559.258` | `scripts/download_cef.ps1:3`, `scripts/download_cef.sh:4` |
| Configure/build | CMake + Ninja, `USE_SANDBOX=OFF`, `MESH_BUILD_TESTS=ON` | `CMakeLists.txt:4-18` |
| UI packaging | **verbatim copy** of `ui/` next to the EXE (`copy_directory`) | `native/CMakeLists.txt:204-209` |
| Release | GitHub Actions, Windows x64 only; zips `build/native/Release/*`; asserts `ui/index.html` + `ui/overlay.html` exist | `.github/workflows/release.yml:52-95` |
| Dev-mode UI path | baked into the binary at configure time (`MESH_UI_SOURCE_DIR`) | `native/CMakeLists.txt:3-8`, `native/include/mesh/build_config.h.in` |
| C++ unit tests | `native/tests/` (CMake `ctest`), CEF-free engine logic | `native/tests/CMakeLists.txt` |
| JS tests | **none** — no runner, no test files | — |
| Node/npm in CI | **absent** | `.github/workflows/release.yml` |

Consequence: **a React migration introduces the first JS toolchain in the project.** CI, local
build instructions, `.gitignore`, and the CMake post-build step all need a new "build the UI"
stage.

### 1.3 The UI tree today

```
ui/
├── index.html      shell (titlebar, address bar, tabs, start page, AI pill)
├── overlay.html    floating overlay (tab tip, media controls, history flyout, update flyout)
├── bookmarks.html  local page opened as a tab
├── history.html    local page opened as a tab
├── downloads.html  local page opened as a tab
├── settings.html   local page opened as a tab (special-cased by native trust check)
├── info.html       local page opened as a tab (About / Updates)
├── css/            20 global stylesheets, CSS-variable design tokens (tokens.css)
├── js/
│   ├── app.js                 boot: DOMContentLoaded → Theme/Icons/Tooltip/Titlebar/Boot/Media/Menu/Adblock/Autocomplete
│   ├── bridge.js              MeshBridge — the only native channel (493 lines)
│   ├── overlay.js             overlay page implementation (995 lines, imperative DOM)
│   ├── bookmarks.js history.js downloads.js settings.js info.js updates-data.js
│   ├── lib/       storage.js theme.js tooltip.js icons.js overlay-manager.js
│   └── features/ shell/{titlebar,window-icons}.js
│                  browser/{browser,url,menu,adblock,autocomplete,media,find,update-checker}.js
├── vendor/lucide.min.js
├── plugins/example/manifest.json   (sample only — runtime plugins live in the user profile)
└── assets/         fonts, brand svg, search-engine icons
```

**Module pattern:** every file is an IIFE that publishes exactly one global
(`MeshBridge`, `MeshTheme`, `MeshIcons`, `MeshTooltip`, `MeshOverlayManager`, `MeshStorage`,
`MeshTitlebar`, `MeshWindowIcons`, `MeshBrowser`, `MeshBoot`, `MeshBrowserUrl`, `MeshMenu`,
`MeshAdblock`, `MeshAutocomplete`, `MeshMedia`, `MeshFind`, `MeshUpdateChecker`, `MeshUpdates`).
There is no import/export anywhere; dependencies are resolved by reading a global off `window`
at call time. There is no module loader — only `<script>` tags.

---

## 2. Page → scripts/styles/state map

| Page | Scripts (order) | Styles | Native role | Key IDs (live in HTML) |
|---|---|---|---|---|
| `index.html` | `lib/storage.js` → `lib/icons.js` → `lib/tooltip.js` → `lib/overlay-manager.js` → `bridge.js` → `lib/theme.js` → `features/shell/window-icons.js` → `features/shell/titlebar.js` → `features/browser/url.js` → `features/browser/browser.js` → `features/browser/media.js` → `features/browser/menu.js` → `features/browser/adblock.js` → `features/browser/autocomplete.js` → `features/browser/update-checker.js` → `features/browser/find.js` → `app.js` | tokens, base, scrollbar, icons, titlebar, shell, tooltip, topbar, media, browser, adblock, autocomplete, update, find | shell browser view; `?private=1` variant | `browser-reload`, `browser-back`, `browser-forward`, `browser-search-form`, `browser-search-input`, `browser-search-toggle`, `browser-adblock`, `browser-tabs`, `browser-tab-new`, `titlebar-min/-max/-close`, `titlebar-search`, `shell`, `workspace`, `browser`, `browser-start`, `browser-start-stats-card/-value`, `browser-view`, `ai-glow-overlay`, `ai-control-pill`, `ai-control-pause-btn`, `ai-control-btn-icon` |
| `overlay.html` | `bridge.js` → `lib/theme.js` → `overlay.js` | tokens, update, overlay | overlay browser view (`overlay.show/resize/hide`) | `overlay-root` (everything else is created imperatively) |
| `bookmarks.html` | `bridge.js` → `lib/theme.js` → `bookmarks.js` | tokens, scrollbar, bookmarks | content tab (trusted UI path) | `bm-nav-mesh`, `bm-nav-clear`, `bm-search`, `bm-q`, `bm-list`, `bm-empty` |
| `history.html` | `bridge.js` → `lib/theme.js` → `history.js` | tokens, scrollbar, history | content tab | `hist-nav-mesh`, `hist-nav-clear`, `hist-search`, `hist-q`, `hist-actions`, `hist-remove-selected`, `hist-list`, `hist-empty` |
| `downloads.html` | `bridge.js` → `lib/theme.js` → `downloads.js` | tokens, scrollbar, downloads | content tab | `dl-nav-mesh`, `dl-nav-clear`, `dl-search`, `dl-q`, `dl-list`, `dl-empty` |
| `settings.html` | `bridge.js` → `lib/theme.js` → `settings.js` | tokens, scrollbar, history, settings | content tab; **native allows `settings.*` only on this exact file** | `settings-appearance`, `settings-search-engine`, `settings-adblock-enabled`, `settings-adblock-aggressive`, `settings-status`; nav/panels via `data-settings-nav` / `data-settings-panel` |
| `info.html` | `bridge.js` → `lib/theme.js` → `updates-data.js` → `info.js` | tokens, scrollbar, history, info | content tab | `info-nav-about`, `info-nav-updates`, `info-panel-about`, `info-panel-updates`, `info-updates`, `info-updates-status` |

Every page repeats the same inline theme bootstrap IIFE in `<head>` (reads `mesh.appearance` +
`mesh.appearance.theme` from `MeshStorage`, sets `data-theme` on `<html>`). This must remain
**before first paint** in every React page or the UI flashes the wrong theme.

### 2.1 Navigation model

* No client-side router. Local pages are opened **by the native shell** as tabs:
  `ui/js/features/browser/menu.js:83-132` builds `new URL("history.html", window.location.href)`
  and hands it to the native menu command → the host opens a content browser on that `file://` URL.
* `ui/js/features/browser/url.js:160-243` recognises the local pages by path
  (`history.html`, `downloads.html`, `bookmarks.html`, `info.html`, `settings.html`) — the URL
  helpers are the routing table.
* `url.js:164` still references a `/search.html` that no longer exists (dead branch).
* `index.html` does **not** embed other pages; `#browser-view` / `.browser-view-slot` is an empty
  placeholder — the page content is a separate CEF browser drawn by the host.
* `ui/js/bookmarks.js:116`, `history.js:263`, `downloads.js:411` navigate with `window.location.href`
  for "open bookmark / history entry / download".

**Implication for React:** keep the **multi-page** model (one React root per HTML file). A SPA
router would break the host, which opens local pages by URL and derives the trust level from the
file path.

---

## 3. Contracts that must not break

### 3.1 The native transport (`ui/js/bridge.js`)

Envelope (JSON string sent through `cefQuery`):

```jsonc
{ "method": "browser.navigate", "params": { "url": "https://…", "tabId": "…" } }
```

* `window.cefQuery({ request, persistent, onSuccess(jsonString), onFailure(code, message) })`
  — `ui/js/bridge.js:2-50`.
* `persistent: true` ⇒ the reply channel stays open and every later native event arrives as an
  `onSuccess` JSON payload; `window.cefQueryCancel(queryId)` cancels it — `bridge.js:38-48`.
* Reply payload is parsed JSON (`bridge.js:12-26`).
* The API method table is native-side: exact match wins, else longest registered prefix
  (`native/src/engine/engine_method_router.h`, `native/src/api/api_dispatcher.cpp:13-37`).
* Every native method used by the UI (extracted from `bridge.js`):

```
window.minimize window.toggleMaximize window.close window.isMaximized window.new window.newPrivate
window.cursorPos window.newWithTab | tab.consumePending
browser.navigate browser.ensureTab browser.activateTab browser.closeTab browser.back browser.forward
browser.reload browser.stop browser.clear browser.show browser.setChromeHeight browser.state
browser.find browser.stopFinding browser.toggleFind browser.showFind browser.hideFind
browser.adblock.get browser.adblock.set browser.adblock.allowlist browser.adblock.cosmetics
browser.setAudioMuted browser.mediaControl | devtools.toggleDock devtools.isDocked
overlay.show overlay.resize overlay.hide overlay.command overlay.subscribe
menu.show menu.hide | browser.subscribe app.info api.list
history.list history.record history.remove history.clear history.import
bookmarks.list bookmarks.record bookmarks.remove bookmarks.clear bookmarks.import
settings.get settings.set session.get session.set tabs.list tabs.get
plugins.list plugins.register | downloads.list downloads.remove downloads.clear downloads.open downloads.showInFolder
library.list library.add library.update library.remove library.launch library.pickExe library.running
terminal.open terminal.write terminal.resize terminal.close terminal.subscribe | git.status
agent.pause agent.resume
```

### 3.2 Event streams (native → UI)

`browser.subscribe` pushes JSON events; types observed in the host
(`native/src/app/mesh_handler.cpp`):

```
visibility, navigate, address, title, loading, tab.created, open-tab, media, audio,
download, find-result, focus-address-bar, menu, menu-command, overlay, appearance.changed,
ai.active, ready
```

`overlay.subscribe` pushes `show` (with `payload`) / `hide`.
`menu` / `menu-command` events come from the native Views menu; `focus-address-bar` from the
host shortcut handler.

### 3.3 Trust / access model — **path-based, this is the hard constraint**

`native/src/api/api_access.cpp`:

* `IsTrustedUiContentBrowser()` — a content browser whose main-frame URL is a `file:` URL
  **under `paths::UiRootDir()`** is "trusted UI".
* Trusted UI may call: `history.*`, `bookmarks.*`, `downloads.*`, `session.*`, `tabs.*`,
  `settings.*`, `plugins.*`, `agent.*`, `page.*`, plus `app.installUpdate`, `api.list`,
  `browser.navigate`, `app.info` (`api_access.cpp:81-98`).
* Arbitrary web content may call only: `browser.media`, `browser.audio`,
  `browser.adblock.classId`, `agent.callback` (`api_access.cpp:76-79`).
* `settings.html` has an **exact-path** trust check (`api_access.cpp:101-129`): the file must be
  `<UiRootDir>/settings.html` for `settings.*` to be allowed.

**Therefore:** every React page must continue to live **under `ui/`** and keep the same file
names (`index.html`, `settings.html`, …). Moving the UI to a different directory, to a bundler
output directory outside `ui/`, or to a custom scheme requires native changes
(`native/src/api/api_access.cpp`, `native/src/platform/paths.cpp`).

### 3.4 MCP integration

* Stdio mode: `MeshEngine.exe --mcp` speaks JSON-RPC 2024-11-05 on stdin/stdout and proxies to
  the GUI's HTTP endpoint (`docs/MCP_INTEGRATION.md`, `native/src/mcp/mcp_http_server.cpp`).
* HTTP: `http://127.0.0.1:8999/{sse,message,mcp,api}`, loopback-only.
* Resources: `mesh://tabs`, `mesh://tabs/active`, `mesh://history/recent` (legacy `omni://` aliases).
* Tools include `browser_navigate`, `browser_click`, `browser_fill`, `browser_eval_js`,
  `browser_take_screenshot`, `browser_toggle_find`, `browser_status`, …
  (`native/src/mcp/mcp_server.cpp:549-575`).
* MCP calls land on native APIs (or CDP on content frames). **Nothing in MCP depends on the shell
  DOM**, so the React migration cannot break MCP — provided the shell keeps sending the same
  `browser.subscribe` events and the same API names.
* The "Agent Controlled" pill is driven by the `ai.active` event plus `agent.pause` / `agent.resume`.

### 3.5 DOM coupling

Native does **not** execute JavaScript in the shell (the only `ExecuteJavaScript` calls target
**content** frames: `native/src/api/handlers/agent_api.cpp:321-353`). So there is *no* native →
shell DOM coupling. The coupling is:

1. **CSS ↔ class names.** All 20 stylesheets are global and target the class names the JS
   creates (`.titlebar-tab`, `.mesh-autocomplete-popup`, `.hist-list`, `.mesh-tooltip`, …).
   If React changes class names, the whole stylesheet must change with it.
2. **JS ↔ ids.** See §4.
3. **OS ↔ drag regions.** `-webkit-app-region: drag` in `ui/css/titlebar.css` and `no-drag` in
   `ui/css/topbar.css`; native window dragging depends on these regions.

---

## 4. DOM contract (ids/classes per module) — the React migration's hard constraint

Ids referenced by the JS but **absent from the current HTML** (dead/legacy paths, e.g.
`browser-menu`, `browser-start-clock`, `browser-bookmark`, `browser-download`,
`browser-engine*`, `browser-start-media-*`, `topbar`, `browser-search-mark`,
`browser-start-search-*`) — decide explicitly whether to revive or delete them; a React
component tree should not carry them.

| Module | Ids it owns |
|---|---|
| `features/shell/titlebar.js` | `titlebar-min`, `titlebar-max`, `titlebar-close`, `icon-maximize`, `icon-restore`, `titlebar-search`, `browser-search-toggle`, `browser-search-input`, `browser-search-form` |
| `features/shell/window-icons.js` | fills `titlebar-min/-max/-close` + `icon-maximize`/`icon-restore` |
| `features/browser/browser.js` | `browser`, `browser-start`, `browser-view`, `browser-tabs`, `browser-tab-new`, `browser-reload`, `browser-back`, `browser-forward`, `browser-adblock`, `browser-start-stats-card`, `browser-start-stats-value`, `browser-start-stats-toggle`, `browser-start-notice*`, `ai-control-pill`, `ai-control-pause-btn`, `ai-control-btn-icon`, `ai-glow-overlay` |
| `features/browser/autocomplete.js` | creates `.mesh-autocomplete-popup` / `.mesh-autocomplete-item` next to the focused input; drives `browser-search-input` / `browser-start-search-input` |
| `features/browser/adblock.js` | `browser-adblock`, plus fallback `.mesh-shield-fallback` |
| `features/browser/media.js` | creates `.mesh-media-*` in the overlay page; anchors to the tab element |
| `features/browser/find.js` | none (native find bar) — only a `document`-level Escape handler |
| `features/browser/menu.js` | `browser-menu` (**missing from `index.html`** → the module currently bails out) |
| `lib/theme.js` | `document.documentElement[data-theme]`, `[data-private="1"]` |
| `lib/icons.js` | any host; replaces `<i data-lucide>` with inline `<svg>` |
| `lib/tooltip.js` | singleton `.mesh-tooltip` appended to `document.body` |
| `lib/overlay-manager.js` | panel registry (`adblock`, `media`, `menu`, `engine`) |
| `overlay.js` | `overlay-root` (only); everything else created imperatively: `.mesh-tab-tip-*`, `.mesh-media-*`, update flyout |
| `bookmarks.js` | `bm-list`, `bm-empty`, `bm-q`, `bm-search`, `bm-nav-mesh`, `bm-nav-clear` |
| `history.js` | `hist-list`, `hist-empty`, `hist-q`, `hist-search`, `hist-nav-*`, `hist-actions`, `hist-remove-selected` |
| `downloads.js` | `dl-list`, `dl-empty`, `dl-q`, `dl-search`, `dl-nav-*` |
| `settings.js` | `settings-appearance`, `settings-search-engine`, `settings-adblock-enabled`, `settings-adblock-aggressive`, `settings-status`, `[data-settings-nav]`, `[data-settings-panel]` |
| `info.js` | `info-nav-about`, `info-nav-updates`, `info-panel-about`, `info-panel-updates`, `info-updates`, `info-updates-status` |

Class names owned by the shell and referenced by CSS: `.titlebar`, `.titlebar-nav`,
`.titlebar-left`, `.titlebar-tabs`, `.titlebar-tab*`, `.titlebar-search*`, `.topbar*`,
`.browser*`, `.workspace`, `.shell`, `.hist*` (shared by bookmarks/history/downloads/info/settings),
`.settings*`, `.info*`, `.mesh-tooltip`, `.mesh-autocomplete-*`, `.mesh-media-*`, `.mesh-tab-tip-*`,
`.ai-control-pill*`, `.ai-glow-overlay`.

---

## 5. State model today (and where it should live after the migration)

### 5.1 Current mutable state

| State | Module | Shape | Consumers | Persistence |
|---|---|---|---|---|
| `tabs[]`, `activeId` | `features/browser/browser.js:111-112` | tab records | tab strip, navigation, media, overlay | native `session.*` + localStorage active-tab id (`url.js:82`) |
| `addressEditing`, `nativeCanBack/Forward/Loading`, `navSerial`, `lastChromeHeight` | `browser.js:113-120` | scalars | nav buttons, chrome height | in-memory |
| `bookmarkEntries`, `visitHistory`, `closedTabs` | `browser.js:168-173` | arrays | menus, restore-closed-tab | native `bookmarks.*` / `history.*` / `session.*` (legacy localStorage migration kept) |
| tab-tip state (`tabTipId/Timer/Token/DataKey`) | `browser.js:128-134` | scalars + timer | overlay page | in-memory |
| `aiPaused`, `aiActiveTimer` | `browser.js:140,160` | scalar | AI pill | native `agent.*` |
| panel registry (`adblock`,`media`,`menu`,`engine`) | `lib/overlay-manager.js:2-19` | Map | tooltip, adblock, media, menu | in-memory |
| `open`, `prefs`, `pollTimer` | `features/browser/adblock.js:43-54` | object | adblock panel, start-page counter | native `browser.adblock.*` |
| autocomplete (`activePopup`, `activeInput`, `activeIndex`, `currentSuggestions`, `lastTyped`, `isComposing`, `suppressInline`, `fetchTimer`) | `features/browser/autocomplete.js:69-76` | many | address bar | in-memory (+ native suggestion API) |
| `open`, `primaryTabId`, `lastAnchor` | `features/browser/media.js:4-6` | scalars | media panel | in-memory |
| `menuOpen`, `lastDismissTime` | `features/browser/menu.js:15-16` | scalars | app menu | in-memory |
| `isFindOpen`, `lastQuery` | `features/browser/find.js:2-3` | scalars | find bar | in-memory |
| `entries`, `query` | `bookmarks.js:19-20`, `downloads.js:10-11`, `history.js` | arrays/strings | list pages | native `history.*`/`bookmarks.*`/`downloads.*` |
| theme pref + resolved theme | `lib/theme.js` (`mesh.appearance`, `mesh.appearance.theme`) | string | every page | `MeshStorage` -> `localStorage` |
| search engine | `features/browser/url.js` (`mesh.searchEngine`) | string | address bar | `MeshStorage` |
| updates metadata | `js/updates-data.js` (`MeshUpdates`) | static array | info page | static |

### 5.2 Target ownership after the migration

* **Native is authoritative** for tabs, navigation, media, find, adblock stats, agent state,
  downloads, history, bookmarks, settings, session. The UI must not keep a second copy.
* A **service layer** (`ui-react/src/services/*`) wraps `cefQuery` and exposes:
  * `bridge.call(method, params)` -> Promise (typed wrapper over the current `MeshBridge`),
  * `bridge.subscribe(channel, handler)` -> unsubscribe (wraps `browser.subscribe` /
    `overlay.subscribe`),
  * `storage.get/set` (over `MeshStorage`),
  * `theme.get/set/apply`.
* React subscribes to native events with **`useSyncExternalStore`** (the correct primitive for
  out-of-band pushes): the service holds a cached snapshot; events invalidate it.
* **Local UI state stays in React**: input text, autocomplete index, open/closed panel, hovered
  tab, list filters, settings form drafts.
* **Persistence** stays where it is: `MeshStorage`/localStorage for UI preferences, native stores
  for user data. Do not introduce a second persistence layer.

---

## 6. React integration options

### Option A — Full SPA rewrite (Vite/React, one bundle, client router)
*Pros:* cleanest end state, one bundle, one mental model.
*Cons:* rewrites all 7 pages and ~14.5k lines at once; must preserve every DOM id/class that the
CSS (and indirectly the host) depends on; needs the `file://` module problem solved (Option C);
high risk of silent regressions in adblock / autocomplete / tab-drag behaviour; touches native
(`paths.cpp`, `api_access.cpp`) if the output dir moves.

### Option B — **React islands over the existing page contract** (recommended)
Keep `ui/*.html`, `ui/css/**`, the native trust model, the release packaging and the dev
hot-reload exactly as they are. Add a JS toolchain that compiles React sources into **classic
IIFE bundles** written into `ui/js/generated/`. Each page loads its bundle with a normal
`<script src>` tag and mounts React roots into containers that already exist (or replaces whole
sections at a time). Vanilla modules are deleted one at a time as their React replacement lands.

*Pros:* smallest blast radius; no native change; CSS untouched (React reuses the same class
names); shipping and rollback are per-feature; dev hot-reload keeps working because the built
bundle is a `.js` file under `ui/`.
*Cons:* two worlds coexist during the transition; bundle duplication when built per page.

### Option C — Serve the UI over a custom `mesh://` scheme
*Pros:* real origin -> ES modules work; CSP possible; no `file://` quirks.
*Cons:* native change (scheme handler + request context), the path-based trust check in
`api_access.cpp` must be rewritten for scheme+path, CEF caching/cookie semantics change, the
`localStorage` origin changes (profile data migration!), hot-reload paths change.
**Do this only if a later phase wants a modern SPA/bundler pipeline.** It is not required for
Phase 8 and it carries a data-migration risk.

### Decision

**Option B for Phase 8**, with Option A as the eventual consolidation step and Option C recorded
as a possible future (not required). Toolchain: **esbuild** (single binary, no config ceremony,
first-class IIFE output, fast enough for a hot loop) + `lucide-react` for icons. Vite is a
legitimate alternative for DX, but its default output is ESM, which `file://` cannot load — with
Vite you must configure per-entry `build.lib` IIFE output or post-process with esbuild.

**Hard constraints to encode in the build:**
`format: "iife"`, `bundle: true`, `target: "chrome120"`, `platform: "browser"`,
`jsx: "automatic"`, output -> `ui/js/generated/<page>.js`, sourcemaps in dev only.
**No code splitting** (splitting requires ESM output). Per-page duplication of the React runtime
is the accepted cost; if that is undesirable, ship one shared bundle loaded by all pages.

---

## 7. Target component tree

```
<AppShell>                                   ui/index.html
├── <Titlebar>
│   ├── <WindowControls>       #titlebar-min/-max/-close (+icon-maximize/icon-restore)
│   ├── <TabStrip>             #browser-tabs -> <TabItem> (.titlebar-tab, .titlebar-tab-favicon/
│   │                                            .titlebar-tab-label/.titlebar-tab-close/.titlebar-tab-audio)
│   │                                └── drag-reorder (pointer events, .titlebar-tab-ghost)
│   ├── <SearchPill>           #titlebar-search -> <SearchToggle> <AddressInput> <AdblockButton>
│   │                                                └── <AutocompletePopup> (.mesh-autocomplete-popup)
│   └── <EngineMenuButton>     (.browser-engine*)
├── <Workspace>                #workspace / #shell
│   ├── <StartPage>            #browser-start -> <BlockedStatsCard> (#browser-start-stats-card)
│   └── <BrowserSlot>          #browser-view (empty; native draws the content browser)
├── <AiGlowOverlay>            #ai-glow-overlay
└── <AiControlPill>            #ai-control-pill (+#ai-control-pause-btn)

<OverlayRoot>                                 ui/overlay.html
├── <TabTip>        .mesh-tab-tip-*
├── <MediaPanel>    .mesh-media-*
├── <HistoryFlyout>
└── <UpdateFlyout>

<ListPage>  (bookmarks / history / downloads share the .hist* layout)
├── <SideNav>   .hist-aside / .hist-nav
├── <SearchRow> .hist-search / #*-q
└── <ListBody>  .hist-list / .hist-empty

<SettingsPage>  #settings-* + [data-settings-nav] / [data-settings-panel]
<InfoPage>       #info-panel-about / #info-panel-updates
```

| Component | State | Source |
|---|---|---|
| `TabStrip` | tabs, active tab | native `tabs.list` + `browser.subscribe` events |
| `AddressInput` | draft text, focus, caret | local; committed via `browser.navigate` |
| `AutocompletePopup` | suggestions, active index | local + native suggestion call |
| `AdblockButton` | enabled/aggressive, stats | native `browser.adblock.*` |
| `MediaPanel` | media state of the active tab | native `media` / `audio` events |
| `AiControlPill` | agent active / paused | native `ai.active` event + `agent.pause/resume` |
| `ListPage` | items, query, selection | native `history/bookmarks/downloads.list` |
| `SettingsPage` | draft values | native `settings.get/set` |

---

## 8. Exact files to add / change

### New (Phase 8)

```
package.json                    # scripts: build:ui, dev:ui, (lint)
ui-react/                       # React sources — keep OUT of ui/js so the runtime tree stays clean
├── build.mjs                   # esbuild driver: 7 entries -> ui/js/generated/*.js
├── src/
│   ├── services/
│   │   ├── bridge.js           # typed wrapper over window.cefQuery (replaces bridge.js internals)
│   │   ├── events.js           # browser.subscribe / overlay.subscribe -> typed emitter
│   │   ├── storage.js          # over MeshStorage
│   │   └── theme.js            # theme resolution + data-theme application
│   ├── hooks/
│   │   ├── useNativeEvent.js   # useSyncExternalStore wrapper
│   │   └── useBridge.js
│   ├── components/…            # tree from §7
│   └── pages/
│       ├── shell.jsx  overlay.jsx  bookmarks.jsx  history.jsx
│       └── downloads.jsx  settings.jsx  info.jsx
└── …
```

### Modified

| File | Change |
|---|---|
| `ui/index.html` | add `<script src="js/generated/shell.js"></script>`; remove `<script>` tags for modules React replaces (one at a time) |
| `ui/overlay.html`, `bookmarks.html`, `history.html`, `downloads.html`, `settings.html`, `info.html` | same, one page at a time |
| `ui/js/**` | delete a vanilla module **only** once its React replacement is verified; keep `bridge.js` semantics intact until the end |
| `ui/vendor/lucide.min.js` | keep for not-yet-migrated pages; React pages use `lucide-react` — the vendor script **mutates the DOM** (`ui/js/lib/icons.js:14-18` calls `lucide.createIcons`, replacing `<i data-lucide>` with `<svg>`), which React must not fight |
| `native/CMakeLists.txt:204-209` | **no change required** if bundles are written into `ui/js/generated/` before the CMake copy; otherwise add a `build:ui` custom command |
| `.github/workflows/release.yml` | add `actions/setup-node` + `npm ci` + `npm run build:ui` before the CMake configure step; assert the generated bundles exist next to the UI |
| `.gitignore` | add `node_modules/`, `ui/js/generated/` (generated output must not be committed) |
| `README.md` / `docs/` | document the new build step (`npm ci && npm run build:ui` before `cmake --build`) |
| `native/CMakeLists.txt` / `native/src/**` | **no change** — provided pages stay under `ui/` with the same file names (§3.3) |
| `ui/css/**` | **no change** — React reuses the existing class names; optional later CSS Modules pass |

### Files that must NOT be touched by the React migration

* `native/src/app/scrollbar_inject.cpp` — injects JS into **web content**, not the shell.
* `native/src/adblock/*`, `native/adblock_ffi/*` — Rust adblock engine.
* `native/src/mcp/*` — talks to native APIs only.
* `native/src/library/plugin_registry.cpp` — plugins live in the user profile, not in `ui/`
  (`ui/plugins/example/manifest.json` is only a sample).

---

## 9. Ordered implementation plan (Phase 8)

Each step is independently shippable and independently revertible.

| # | Step | Contents | Exit criteria |
|---|---|---|---|
| 8.0 | **Tooling** | `package.json`, esbuild build script, `ui/js/generated/`, CI node step, `.gitignore`, docs | `npm run build:ui` produces 7 IIFE bundles; CI build succeeds; shell still loads exactly as before (React bundle present but mounting nothing) |
| 8.1 | **Service layer** | `services/bridge.js`, `services/events.js`, `services/storage.js`, `services/theme.js`, `hooks/useNativeEvent.js`; parity check that every `MeshBridge.*` method still resolves | Service layer produces identical results to `MeshBridge` for a sample of methods; no UI change |
| 8.2 | **Titlebar + window controls + tabs** | `<Titlebar>`, `<WindowControls>`, `<TabStrip>` with drag-reorder and audio-mute buttons; replaces `titlebar.js`, `window-icons.js` and the tab part of `browser.js` | Tabs open/close/reorder/mute exactly as today; `browser.setChromeHeight` still reports the right height; maximize/restore icons toggle |
| 8.3 | **Address bar + autocomplete** | `<SearchPill>`, `<AddressInput>`, `<AutocompletePopup>`; replaces `url.js` glue + `autocomplete.js` | Typing, IME composition, inline completion + caret restore, Enter-to-navigate, Escape-to-close behave identically |
| 8.4 | **Overlays: tooltip, media, adblock, tab tip** | `<TooltipLayer>` (portal), `<AdblockPanel>`, `<MediaPanel>`, `<TabTip>`; `overlay-manager` becomes a React context | Panel exclusivity (one panel open) preserved; overlay page still reports its size to native via `overlay.resize` |
| 8.5 | **Secondary pages** | `<ListPage>` shared by bookmarks / history / downloads | Search, selection, remove, clear-all, "open in tab" behave identically |
| 8.6 | **Settings + Info** | `<SettingsPage>`, `<InfoPage>` | Theme radio, search-engine select, adblock toggles persist; `settings.*` calls still authorised (path unchanged) |
| 8.7 | **Overlay page rewrite** | `<OverlayRoot>` in `overlay.html` (media panel, history flyout, update flyout) | Overlay resize reporting, command round-trip (`overlay.command`), and dismissal still work |
| 8.8 | **Cleanup** | delete migrated vanilla modules, remove the `MeshTooltip`/`MeshIcons` DOM hacks, keep a `MeshBridge` shim only if the host needs it | `ui/js/**` contains only the service layer; no dead ids referenced |

**Do not** attempt, in Phase 8: a client-side router, a `mesh://` scheme, CSS Modules or
Tailwind, a state-management library, or a redesign. Those are Phase 9+ candidates.

---

## 10. Acceptance tests (functional parity)

### 10.1 Automated (no new test framework needed for the first steps)

The repository already has a Python harness that drives the real app over MCP
(`scripts/test_find_overlay.py`, `scripts/test_google_find.py`, `scripts/test_inpage_find.py`,
`scripts/test_find_complete.py`, `scripts/test_external_tab_ai.py`, `scripts/test_mcp_stdio.py`,
`scripts/test_screenshot_mcp.py`). Extend it rather than inventing a runner:

1. `scripts/test_ui_contract.py` — new. Boots the app, then via `browser_eval_js` asserts the
   **DOM contract** after the React migration:
   * `#browser-tabs` exists and contains N `.titlebar-tab` elements with
     `.titlebar-tab-label` / `.titlebar-tab-close` / `.titlebar-tab-favicon`;
   * `#browser-search-input` exists, is focusable, and `Ctrl+L` focuses it
     (native `focus-address-bar` event);
   * `#browser-view` and `#browser-start` toggle correctly;
   * the AI pill `#ai-control-pill` appears when the agent is active;
   * the bridge still answers `app.info`.
2. Existing scripts must keep passing unchanged (`test_find_*`, `test_external_tab_ai`,
   `test_mcp_stdio`, `test_screenshot_mcp`) — they are the regression suite.
3. C++ side: `cmake --build build && ctest --test-dir build` (existing `native/tests`) must stay
   green; no native source changes are planned, so this is a smoke check.

### 10.2 Manual / scripted parity checklist per migrated feature

| Area | Check |
|---|---|
| Tabs | open, close, close button, drag-reorder, mute-audio badge, active-tab restore after restart |
| Address bar | navigate to URL, search query, back/forward, reload, hard reload (Shift), stop, copy URL |
| Autocomplete | suggestion list appears, keyboard nav, IME (CJK) composition, inline completion + caret position, dismiss on blur/Escape |
| Overlays | adblock panel opens/closes, media panel controls (play/pause/skip/volume/PiP), tab hover tip, only one panel at a time |
| Menu | native app menu opens anchored to the button, items dispatch the same commands |
| Find | native find bar toggles from MCP and from the shell, Escape closes |
| Theme | light/dark/system, private mode forces dark, theme persists across pages and restarts |
| Local pages | bookmarks/history/downloads/settings/info open as tabs, load, search, delete, clear |
| Agent HUD | "Agent Controlled" pill appears/disappears, Take Control pauses, Resume resumes |
| MCP | `browser_status`, `browser_list_tabs`, `browser_navigate`, `browser_eval_js`, `browser_take_screenshot` all behave as before |

### 10.3 Visual regression

`scripts/dev_screenshot.ps1` (Win32 screen capture) plus MCP `browser_take_screenshot` give
before/after images of the shell and of local pages. Capture the baseline **before** 8.0 and
compare per migrated step.

---

## 11. Build, test and runtime verification plan

**Local (Windows, the primary dev platform)**

```bash
npm ci                 # once
npm run build:ui       # writes ui/js/generated/*.js (IIFE)
cmake -B build -G Ninja -DCMAKE_BUILD_TYPE=Debug
cmake --build build
build/native/Release/MeshEngine.exe        # or the Debug output dir
```

Dev loop: `npm run dev:ui -- --watch` (esbuild watch) -> writing a `.js` file under `ui/` triggers
the existing native hot reload (`native/src/dev/ui_hot_reload.cpp:29-58` watches `.js`), so the
browser refreshes with the new bundle. Keep the built bundle **inside `ui/js/generated/`** for
this to keep working.

**CI (`.github/workflows/release.yml`)**

1. `actions/setup-node@v4` (Node 20 LTS) + `npm ci` + `npm run build:ui`.
2. Fail fast if `ui/js/generated/shell.js` etc. are missing.
3. Then the existing CEF download -> CMake configure -> build -> zip steps, unchanged.
4. The release already asserts `ui/index.html` and `ui/overlay.html` exist — extend the assertion
   to the generated bundles so a broken UI build cannot ship.

**Runtime verification**

* Shell loads with no console errors (DevTools is available: `devtools.toggleDock`).
* `window.cefQuery` is still defined (the React service layer must degrade gracefully, not crash,
  if it is missing — e.g. when a page is opened outside the host).
* Each page boots in < 200 ms of JS time; the bundle stays < 200 KB uncompressed (React 18
  runtime is about 45 KB minified, plus app code).
* Private mode still forces the dark theme (`?private=1` handling in `ui/index.html`).

**Rollback**

Every step is a separate commit that can be reverted independently; the generated bundle is
git-ignored, so reverting the HTML/script-tag change alone restores the vanilla UI.

---

## 12. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| ES-module bundle over `file://` silently fails | Total UI failure | Build IIFE bundles; add a startup check that logs an error if the bundle did not mount |
| React re-creating DOM that vanilla code expects (lucide `createIcons`, tooltip layer, tab ghost element) | Broken icons/tooltips/drag | Migrate one module at a time; never run a vanilla module against React-owned DOM; `lucide-react` replaces the lucide DOM hack in React trees |
| Losing the last-frame address-bar draft or the caret position | UX regression | Keep the input uncontrolled or mirror the value with `useRef`; port the caret logic from `autocomplete.js:330-435` verbatim |
| Tab drag-and-drop uses pointer events + a ghost element + DOM order as the source of truth | Broken reordering | Port `browser.js:1379-1620` carefully; keep `syncTabsOrderFromDom` semantics or move the order into native |
| Native trust check is path-based (`api_access.cpp`) | API denials if files move | Keep every page at its current path under `ui/`; add a C++ unit test asserting the paths |
| Overlay page size reporting (`overlay.resize`) depends on a `ResizeObserver` + rAF loop | Overlay mis-sized / invisible | Keep the observer outside React or use `useLayoutEffect` + `ResizeObserver` with an explicit `overlay.resize` call on every change |
| New Node dependency in CI/release | Release pipeline break | Pin Node + lockfile; keep the UI build as one explicit, cached step; the CMake build stays independent of Node |
| Two UI worlds coexisting (dual boot) | Double event listeners / flicker | One `boot` flag per page; the React root owns its subtree exclusively; delete the vanilla script tag in the same commit that adds the React bundle for that area |

---

## 13. Open questions for the product owner

1. Should the final target be a single-bundle SPA (Option A) or stay multi-page (Option B)? The
   audit recommends B for Phase 8 and revisiting A after the shell is migrated.
2. Is TypeScript acceptable in Phase 8, or JSX-only? esbuild handles `.tsx` either way; this
   only affects the folder layout and `tsconfig.json`.
3. Should the currently dead UI paths (`browser-menu` button, start-page clock/media art, the
   `/search.html` branch) be revived, ported, or removed as part of the migration?
4. Should a `mesh://` scheme (Option C) be evaluated before the UI grows further, given it
   would unlock ES modules, CSP and modern bundling — at the cost of a `localStorage` origin
   migration?

---

*End of Phase 7 audit.*
