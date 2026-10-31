// Theme bootstrap.
//
// This runs inline in <head>, before the first paint, so the page never
// flashes the wrong theme. It only sets <html data-theme>; the React theme
// service (services/theme.js) reconciles with the host afterwards.
//
// The build inlines this module into every generated page (see
// ui-react/build.mjs and src/html/Document.jsx).

import { storage } from "../services/storage.js";

const KEY = "mesh.appearance";

/**
 * @param {{ privateAware?: boolean }} [options]
 *   privateAware: honour `?private=1` (only the shell page does).
 */
export function boot(options = {}) {
  const root = document.documentElement;

  let privateMode = false;
  if (options.privateAware) {
    privateMode = /(?:\?|&)private=1(?:&|$)/.test(location.search || "");
    window.MeshPrivate = { enabled: privateMode };
    if (privateMode) {
      root.dataset.private = "1";
      document.title = "Mesh Private";
    }
  }

  let pref = storage.get(KEY) || "system";
  const cachedTheme = storage.get(KEY + ".theme") || "";
  if (pref !== "light" && pref !== "dark") pref = "system";

  const dark =
    !window.matchMedia || window.matchMedia("(prefers-color-scheme: dark)").matches;

  let theme;
  if (pref === "light") theme = "light";
  else if (pref === "dark") theme = "dark";
  else if (cachedTheme === "light" || cachedTheme === "dark") theme = cachedTheme;
  else theme = dark ? "dark" : "light";

  if (privateMode) theme = "dark";

  root.setAttribute("data-theme", theme);
  root.style.colorScheme = theme;
}
