// The pages of the UI, as data.
//
// Every page of the host (ui/<file>) is generated from this manifest and the
// <Document> component by `npm run build:ui`. There is no hand-written HTML in
// the project. The native host loads these files by name (see
// native/src/platform/paths.cpp and native/src/api/api_access.cpp), so the
// file names must not change.

const BASE = ["tokens"];

export const PAGES = [
  {
    file: "index.html",
    title: "Mesh",
    bundle: "shell",
    rootId: "app-root",
    privateAware: true,
    css: [
      ...BASE,
      "base",
      "scrollbar",
      "icons",
      "titlebar",
      "shell",
      "tooltip",
      "topbar",
      "media",
      "browser",
      "adblock",
      "autocomplete",
      "update",
      "find",
    ],
  },
  {
    file: "overlay.html",
    title: "Mesh Engine Overlay",
    bundle: "overlay",
    rootId: "overlay-root",
    css: [...BASE, "update", "overlay"],
  },
  {
    file: "bookmarks.html",
    title: "Bookmarks",
    bundle: "bookmarks",
    rootId: "app-root",
    css: [...BASE, "scrollbar", "bookmarks"],
  },
  {
    file: "history.html",
    title: "History",
    bundle: "history",
    rootId: "app-root",
    css: [...BASE, "scrollbar", "history"],
  },
  {
    file: "downloads.html",
    title: "Downloads",
    bundle: "downloads",
    rootId: "app-root",
    css: [...BASE, "scrollbar", "downloads"],
  },
  {
    file: "settings.html",
    title: "Settings",
    bundle: "settings",
    rootId: "app-root",
    css: [...BASE, "scrollbar", "history", "settings"],
  },
  {
    file: "info.html",
    title: "Info",
    bundle: "info",
    rootId: "app-root",
    css: [...BASE, "scrollbar", "history", "info"],
  },
];
