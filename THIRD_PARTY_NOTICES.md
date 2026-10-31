# Third-party notices

## nlohmann/json (MIT License)

The JSON library used on the native RPC boundary is vendored as
`third_party/nlohmann/json.hpp`.

- Version: **3.11.3**
- Source: https://github.com/nlohmann/json
- License: **MIT**

The upstream single-header distribution retains its own copyright and SPDX
header in the file itself. The license text follows:

```
Copyright (c) 2013-2023 Niels Lohmann

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## adblock-rust (Mozilla Public License 2.0)

Mesh Engine embeds [Brave’s adblock-rust](https://github.com/brave/adblock-rust) engine
via a local FFI crate (`native/adblock_ffi`) for network blocking, cosmetic filtering,
scriptlets, and redirect resources.

- License: **MPL-2.0**
- Source: https://github.com/brave/adblock-rust
- Modifications to MPL-covered files (if any) are in `native/adblock_ffi/`

The FFI wrapper in `native/adblock_ffi/src/lib.rs` is first-party code covered by the
repository `LICENSE` (MIT). The crate `Cargo.toml` declares the crate as `MPL-2.0`
because it links the MPL-2.0 engine; that declaration is deliberately kept
conservative and is not changed by this notice.

You may obtain a copy of the License at https://www.mozilla.org/MPL/2.0/

**Corresponding source.** MPL-2.0 section 3.2 requires recipients to be able to
obtain the source of the MPL-covered files. The exact versions of every linked crate
are pinned in `native/adblock_ffi/Cargo.lock`; their unmodified sources are obtained
from the crates.io sources for the pinned versions (for example
`cargo vendor --manifest-path native/adblock_ffi/Cargo.toml`, which reproduces
`adblock` and all transitive crates locally together with their `LICENSE` files).
The wrapper sources modified by this project are in `native/adblock_ffi/`.

## Chromium Embedded Framework (CEF) / Chromium

Downloaded by `scripts/download_cef.ps1` (Windows) or `scripts/download_cef.sh` (Linux)
into `third_party/cef/` / `third_party/cef-linux64/` (not vendored in git).

- CEF version: **144.0.32+g5ce7d26**
- Chromium version: **144.0.7559.258**
- License: **BSD-3-Clause** (Chromium Embedded Framework / Chromium)

The binary distribution ships `LICENSE.txt` and `CREDITS.html` inside the CEF tree
(`third_party/cef/LICENSE.txt`). The same notice is reproduced here, as required for
binary redistribution:

```
// Copyright (c) 2008-2020 Marshall A. Greenblatt. Portions Copyright (c)
// 2006-2009 Google Inc. All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are
// met:
//
//    * Redistributions of source code must retain the above copyright
// notice, this list of conditions and the following disclaimer.
//    * Redistributions in binary form must reproduce the above
// copyright notice, this list of conditions and the following disclaimer
// in the documentation and/or other materials provided with the
// distribution.
//    * Neither the name of Google Inc. nor the name Chromium Embedded
// Framework nor the names of its contributors may be used to endorse
// or promote products derived from this software without specific prior
// written permission.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
// "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
// LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
// A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
// OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
// SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
// LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
// DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
// THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
// OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

## SQLite

`third_party/sqlite/` — public domain (the amalgamation disclaims copyright; see the
header of `third_party/sqlite/sqlite3.c`). Version: **3.49.1**.

## Lucide (ISC License)

Icon SVG paths used by the UI are vendored as `ui/vendor/lucide.min.js`.

- Version: **0.511.0**
- Source: https://github.com/lucide-icons/lucide
- License: **ISC**

```
Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
```

## Fonts (SIL Open Font License 1.1)

The UI bundles two variable fonts under `ui/assets/fonts/`:

| File | Family | Copyright | License |
|------|--------|-----------|---------|
| `InterVariable.ttf` | Inter | Copyright (c) 2016 The Inter Project Authors (https://github.com/rsms/inter) | **OFL-1.1** |
| `SpaceGrotesk-Variable.ttf` | Space Grotesk | Copyright (c) 2020 Florian Karsten (https://github.com/floriankarsten/space-grotesk) | **OFL-1.1** |

Both fonts are used under the SIL Open Font License, Version 1.1, whose text is
published at https://openfontlicense.org and must accompany the redistributed font
files. The full license text and the Reserved Font Names clauses therefore have to
ship with the binaries: add the OFL 1.1 text as `ui/assets/fonts/OFL.txt` to the
release package.

## Filter lists (EasyList / EasyPrivacy / uBlock filters / Fanboy)

Downloaded at runtime into `%APPDATA%\MeshEngine\adblock\` (see
`resources/adblock/catalog.json` for the URLs). These lists are not bundled in the
binary, but they are downloaded and displayed by the application, so their own terms
apply:

- EasyList / EasyPrivacy — Creative Commons Attribution 3.0
- uBlock Origin filters / filters-2020 — GPLv3
- Fanboy — Creative Commons Attribution 3.0

The license header of each downloaded list file is the authoritative statement for
that list; keep it intact when redistributing downloaded lists.

## Brave adblock-resources + uBlock Origin scriptlets

Bundled redirect/scriptlet resources under `resources/adblock/resources.json`
combine:

- [brave/adblock-resources](https://github.com/brave/adblock-resources) (MPL-2.0)
- Scriptlets and web-accessible redirect resources from
  [uBlock Origin](https://github.com/gorhill/uBlock) (GPLv3), assembled the same
  way Brave’s adblock component packager does

**Corresponding source.** The bundled resources are verbatim copies of the upstream
repositories named above; the corresponding source is the source of those
repositories at the versions used to generate the bundle. The generator
(`build/ubo-resources/generate-resources.mjs`) and the pinned uBlock snapshot
(`build/ubo-resources/ublock-src/`) are build artifacts and are **not** tracked in
git, so a release built from the repository alone cannot currently reproduce the
exact bundle. Tracking the generator and the pinned upstream revision (or publishing
the pinned sources alongside the release) is required to satisfy the GPLv3
corresponding-source obligation for this bundle.

Regenerate with `build/ubo-resources/generate-resources.mjs` after refreshing the
local uBlock snapshot under `build/ubo-resources/ublock-src/` (build artifact only).

## Search-engine logos and trademarks

`ui/assets/search-icons/` contains favicons for Google, Bing, Brave, DuckDuckGo,
Qwant, Ecosia and Startpage, and `ui/assets/mesh-brand/` contains the product logo
mark. The favicons are trademarks of their respective owners and are used
identically for identification only; no endorsement is implied. These files are not
covered by the repository license.
