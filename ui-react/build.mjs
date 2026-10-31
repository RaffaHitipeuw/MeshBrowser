// Build driver for the UI of Mesh Engine.
//
// Everything the host loads from ui/ is generated from JSX:
//
//   ui/js/generated/<page>.js   the React bundle of each page
//   ui/<page>.html              the document shell of each page, rendered from
//                               ui-react/src/html/Document.jsx at build time
//
// There is no hand-written HTML. The native host still loads the .html files
// by name (native/src/platform/paths.cpp), so they are emitted, but they are
// build output: do not edit them, and they are git-ignored.
//
// The UI is served from file:// URLs and Chromium refuses ES modules there, so
// every bundle is a classic IIFE script with no code splitting. The output is
// written INTO ui/ so the native hot reload (native/src/dev/ui_hot_reload.cpp
// watches .html/.css/.js) picks rebuilt files up without any extra wiring.

import { build, context } from "esbuild";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { watch as fsWatch } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const uiDir = resolve(root, "ui");
const outdir = resolve(uiDir, "js/generated");
const src = (p) => resolve(root, "ui-react/src", p);
const watch = process.argv.includes("--watch");

const entryPoints = {
  shell: src("pages/shell.jsx"),
  overlay: src("pages/overlay.jsx"),
  bookmarks: src("pages/bookmarks.jsx"),
  history: src("pages/history.jsx"),
  downloads: src("pages/downloads.jsx"),
  settings: src("pages/settings.jsx"),
  info: src("pages/info.jsx"),
};

const define = {
  "process.env.NODE_ENV": JSON.stringify(watch ? "development" : "production"),
};

/** @type {import("esbuild").BuildOptions} */
const bundleOptions = {
  entryPoints,
  outdir,
  bundle: true,
  format: "iife",
  target: ["chrome120"],
  platform: "browser",
  jsx: "automatic",
  minify: !watch,
  sourcemap: watch ? "inline" : false,
  legalComments: "none",
  logLevel: "info",
  metafile: true,
  define,
};

// --- HTML ------------------------------------------------------------------

async function buildBootScript() {
  const result = await build({
    entryPoints: [src("boot/index.js")],
    bundle: true,
    write: false,
    format: "iife",
    globalName: "MeshBoot",
    target: ["chrome120"],
    platform: "browser",
    minify: true,
    legalComments: "none",
    logLevel: "warning",
  });
  return result.outputFiles[0].text.trim();
}

async function renderHtml() {
  const bootScript = await buildBootScript();

  // Bundle the renderer for node (CommonJS so react-dom/server can require
  // node builtins), run it once, throw the temp file away.
  const tmp = await mkdtemp(join(tmpdir(), "mesh-html-"));
  try {
    const file = join(tmp, "render.cjs");
    await build({
      entryPoints: [src("html/render.jsx")],
      outfile: file,
      bundle: true,
      format: "cjs",
      platform: "node",
      jsx: "automatic",
      target: ["node18"],
      logLevel: "warning",
      define: { "process.env.NODE_ENV": JSON.stringify("production") },
    });
    const { renderPages } = createRequire(import.meta.url)(file);
    const pages = renderPages(bootScript);
    for (const page of pages) {
      await writeFile(resolve(uiDir, page.file), page.html, "utf8");
    }
    return pages.map((p) => p.file);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

async function renderHtmlSafe() {
  try {
    const files = await renderHtml();
    console.log(`[build:ui] wrote ${files.length} pages to ui/ (${files.join(", ")})`);
  } catch (err) {
    console.error("[build:ui] page generation failed:", err);
    if (!watch) process.exitCode = 1;
  }
}

// --- run -------------------------------------------------------------------

await mkdir(outdir, { recursive: true });

if (watch) {
  await renderHtmlSafe();
  const ctx = await context(bundleOptions);
  await ctx.watch();

  let timer = null;
  const regenerate = () => {
    clearTimeout(timer);
    timer = setTimeout(renderHtmlSafe, 100);
  };
  for (const dir of ["html", "boot", "services"]) {
    fsWatch(src(dir), { recursive: true }, regenerate);
  }
  console.log("[build:ui] watching for changes…");
} else {
  const result = await build(bundleOptions);
  const outputs = result.metafile ? Object.keys(result.metafile.outputs).sort() : [];
  console.log(`[build:ui] wrote ${outputs.length} bundles to ui/js/generated`);
  await renderHtmlSafe();
}
