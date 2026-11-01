#pragma once

namespace mesh {

// True when the app should behave as a local UI workspace:
// load HTML/CSS/JS from the repo `ui/` folder and hot-reload on save.
//
// Enabled when that source folder exists, unless `--bundled-ui` is passed.
// Also forced by Debug builds, `--dev`, or MESH_DEV=1.
bool IsDevMode();

}  // namespace mesh
