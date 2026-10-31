// Build-time entry: renders every page of the manifest to a string.
// Bundled and executed by ui-react/build.mjs; not part of any browser bundle.

import { renderToStaticMarkup } from "react-dom/server";

import Document from "./Document.jsx";
import { PAGES } from "./pages.js";

export function renderPages(bootScript) {
  return PAGES.map((page) => ({
    file: page.file,
    html:
      "<!DOCTYPE html>\n" +
      renderToStaticMarkup(<Document page={page} bootScript={bootScript} />) +
      "\n",
  }));
}

export const pageFiles = PAGES.map((p) => p.file);
