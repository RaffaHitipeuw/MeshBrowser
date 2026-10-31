# Mesh Engine

Mesh Engine is a lightweight desktop browser built on the Chromium Embedded
Framework (CEF). The native host lives in `native/`, the web UI in `ui/`.

## Building

The UI is rendered by React. The React sources are in `ui-react/` and are
bundled into classic IIFE scripts under `ui/js/generated/` — the UI is served
from `file://` URLs, where Chromium blocks ES modules.

```bash
npm ci                 # once
npm run build:ui       # writes ui/js/generated/*.js

cmake -B build -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release
```

`npm run dev:ui` rebuilds the bundles on every change; the native hot reload
picks the new bundles up because they are written inside `ui/`.

Without the UI bundles the engine still starts, but the pages stay empty — the
CMake configure step warns when `ui/js/generated/shell.js` is missing.

## Testing

```bash
python scripts/test_ui_contract.py    # DOM contract of every page (+ the live app)
ctest --test-dir build                 # native unit tests
```

`scripts/test_ui_contract.py` renders every page headlessly and checks the
ids and classes the stylesheets and the native host depend on; with the engine
running it additionally asserts the contract inside the host and that the
bridge still answers.

## Documentation

- `docs/PHASE7_REACT_MIGRATION_AUDIT.md` — the audit this migration follows
  (the DOM contract and the ordered implementation plan).
- `docs/MCP_INTEGRATION.md` — the MCP server and its tools.
- `ui-react/README.md` — the rules for the React sources.
