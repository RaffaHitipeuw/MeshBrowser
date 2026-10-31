# React islands of the Mesh Engine UI

The shell and the local pages of Mesh Engine are written in React (JSX). The
sources live here; the runtime tree stays in `ui/`.

**There is no hand-written HTML in this project.** The `ui/*.html` files the
native host loads by name (`native/src/platform/paths.cpp`) are *generated*
from JSX (`src/html/Document.jsx` + the manifest in `src/html/pages.js`) by
`npm run build:ui`. They are build output, like `ui/js/generated/`, and are
git-ignored. Styling is still plain CSS in `ui/css/`.

## Why the bundles are IIFE scripts

The UI is served from `file://` URLs (`native/src/platform/paths.cpp`). Chromium
blocks ES modules from `file://` origins, so every bundle is built as a classic
IIFE script (`esbuild` with `format: "iife"`, no code splitting) and loaded with a
plain `<script src="js/generated/<page>.js">` tag.

```
npm install
npm run build:ui          # writes ui/js/generated/*.js and ui/*.html
npm run dev:ui            # watch mode (the native hot reload picks the output up)
npm run clean:ui          # removes the generated files
```

Run `npm run build:ui` once before building/starting the native app: without
it `ui/index.html` does not exist.

To add a page: create `src/pages/<name>.jsx`, add it to `entryPoints` in
`build.mjs` and add an entry (title, css list, bundle, root id) to
`src/html/pages.js`.

The bundles are written **into** `ui/js/generated/` so the existing native
hot reload (`native/src/dev/ui_hot_reload.cpp` watches `.js` files) keeps working
without any native change.

## Layout

```
ui-react/
├── build.mjs                 esbuild driver: one bundle + one HTML page per page
└── src/
    ├── boot/                 inline theme bootstrap (runs in <head>, no flash)
    ├── html/                 Document.jsx + pages.js: the HTML shells, in JSX
    ├── components/           shared components (Icon, TooltipLayer, …)
    ├── hooks/                React helpers
    ├── lib/                  pure helpers (url.js)
    ├── pages/                one entry per HTML page (the bundle entry points)
    ├── services/             the native bridge, storage, theme, search engine
    └── state/                the browser controller (shell state machine)
```

## Rules for every page migration

1. **One React root per page.** Each `src/pages/<page>.jsx` is a bundle entry
   point and mounts itself into `<div id="app-root">` of its HTML file:

   ```jsx
   import { createRoot } from "react-dom/client";
   const container = document.getElementById("app-root");
   createRoot(container).render(<MyPage />);
   ```

   The page file also exports the component (default export) so it can be
   reused or tested.

2. **The DOM contract is sacred.** Every `id` and every CSS class the host, the
   stylesheets or the legacy scripts relied on must survive the migration with
   the same spelling. The stylesheets in `ui/css/**` are *not* touched by this
   migration, so React has to produce the very same markup the legacy scripts
   produced. See `docs/PHASE7_REACT_MIGRATION_AUDIT.md` §4 for the full list.

3. **No imperative DOM mutation inside a React-owned subtree.** No
   `innerHTML`, no `replaceChildren`, no `querySelector` writes, no
   `createElement` for markup. State lives in React; the DOM is a function of
   that state. Imperative work that cannot be expressed declaratively (a drag
   ghost, a caret restore) happens in a `useEffect`/`useLayoutEffect` and only
   touches nodes React does not own — or nodes it owns exclusively.

4. **Icons are plain React SVGs.** `src/components/Icon.jsx` renders the glyph
   data in `iconData.js` (lucide, ISC) with `class="icon"` and
   `stroke-width 1.75`, so `ui/css/icons.css` keeps working. There is no icon
   library at runtime. Add a glyph to `iconData.js` to use a new name.

5. **Native is the source of truth.** Tabs, navigation, media, adblock, agent
   state, history, bookmarks, downloads and settings live in the host. The UI
   renders what the host reports and sends commands back; it never keeps a
   second authoritative copy. Local UI state (input drafts, the open panel, the
   selected row) stays in React.

6. **Promises never go unhandled.** Every `bridge.*` call is awaited or
   `.catch(() => {})`.

7. **Services are shared, page code is not.** `src/services/bridge.js`,
   `theme.js`, `storage.js`, `searchEngine.js` and `src/lib/url.js` are the
   common layer. Do not fork them per page.

8. **The theme must not flash.** Every generated page inlines the theme
   bootstrap (`src/boot/themeBoot.js`) in `<head>`; it sets `data-theme`
   before the first paint. The React theme service then reconciles with the
   host.

9. **`window.MeshTheme` must stay available.** The host injects
   `MeshTheme.applyExternal(pref, theme)` into the shell when the OS theme
   changes (`native/src/app/mesh_handler.cpp`). `src/services/theme.js`
   installs that global; keep it working.

10. **No TypeScript in this phase.** JSX + JavaScript only.
