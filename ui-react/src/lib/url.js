// URL helpers of the shell.
//
// Port of ui/js/features/browser/url.js. Pure functions only — no DOM, no
// globals — so the React tree can use them freely.

export function isLocalHistoryUrl(url) {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\\/g, "/").toLowerCase();
    return path.endsWith("/history.html") || path.endsWith("history.html");
  } catch (_) {
    return false;
  }
}

export function localHistoryUrl() {
  return new URL("history.html", window.location.href).href;
}

export function isLocalDownloadsUrl(url) {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\\/g, "/").toLowerCase();
    return path.endsWith("/downloads.html") || path.endsWith("downloads.html");
  } catch (_) {
    return false;
  }
}

export function localDownloadsUrl() {
  return new URL("downloads.html", window.location.href).href;
}

export function isLocalBookmarksUrl(url) {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\\/g, "/").toLowerCase();
    return path.endsWith("/bookmarks.html") || path.endsWith("bookmarks.html");
  } catch (_) {
    return false;
  }
}

export function localBookmarksUrl() {
  return new URL("bookmarks.html", window.location.href).href;
}

export function localInfoUrl() {
  return new URL("info.html", window.location.href).href;
}

export function localSettingsUrl() {
  return new URL("settings.html", window.location.href).href;
}

export function isLocalSettingsUrl(url) {
  try {
    const parsed = new URL(url);
    const local = new URL(localSettingsUrl());
    return (
      parsed.protocol === local.protocol &&
      parsed.host === local.host &&
      parsed.pathname.replace(/\\/g, "/").toLowerCase() ===
        local.pathname.replace(/\\/g, "/").toLowerCase()
    );
  } catch (_) {
    return false;
  }
}

export function isLocalInfoUrl(url) {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\\/g, "/").toLowerCase();
    return path.endsWith("/info.html") || path.endsWith("info.html");
  } catch (_) {
    return false;
  }
}

export function isBlankUrl(url) {
  const value = String(url || "")
    .trim()
    .toLowerCase();
  return !value || value === "about:blank" || value.startsWith("about:blank?");
}

/** Map CEF/page titles like "about:blank" to the start-page label. */
export function normalizeTabTitle(title, url) {
  if (isBlankUrl(url)) {
    return "New Tab";
  }
  const value = String(title || "").trim();
  if (!value || isBlankUrl(value) || /^about:blank$/i.test(value)) {
    return "New Tab";
  }
  return value;
}

/** Tab labels: max 29 chars; vanish with ellipsis from char 27. */
export function formatTabTitle(title) {
  const s = String(title || "").trim() || "New Tab";
  if (s.length <= 27) {
    return s;
  }
  return `${s.slice(0, 27)}…`;
}

export function titleFromUrl(url) {
  if (!url || isBlankUrl(url)) {
    return "New Tab";
  }
  try {
    const parsed = new URL(url);
    if (isLocalHistoryUrl(url)) return "History";
    if (isLocalDownloadsUrl(url)) return "Downloads";
    if (isLocalBookmarksUrl(url)) return "Bookmarks";
    if (isLocalInfoUrl(url)) return "Info";
    if (isLocalSettingsUrl(url)) return "Settings";
    return parsed.hostname.replace(/^www\./, "") || "New Tab";
  } catch (_) {
    return "New Tab";
  }
}

/** Hostname / label for tab hover cards. Empty for blank New Tab pages. */
export function domainFromUrl(url) {
  if (!url || isBlankUrl(url)) {
    return "";
  }
  try {
    const parsed = new URL(url);
    if (isLocalHistoryUrl(url)) return "History";
    if (isLocalDownloadsUrl(url)) return "Downloads";
    if (isLocalBookmarksUrl(url)) return "Bookmarks";
    if (isLocalInfoUrl(url)) return "Info";
    if (isLocalSettingsUrl(url)) return "Settings";
    if (parsed.protocol === "file:") return "Local file";
    return parsed.hostname.replace(/^www\./, "") || "";
  } catch (_) {
    return "";
  }
}

export function addressBarLabel(url) {
  if (!url || isBlankUrl(url)) {
    return "";
  }
  if (isLocalHistoryUrl(url)) return "History";
  if (isLocalDownloadsUrl(url)) return "Downloads";
  if (isLocalBookmarksUrl(url)) return "Bookmarks";
  if (isLocalInfoUrl(url)) return "Info";
  if (isLocalSettingsUrl(url)) return "Settings";
  return url;
}

export function urlsMatch(a, b) {
  if (!a || !b) {
    return false;
  }
  if (a === b) {
    return true;
  }
  try {
    const ua = new URL(a);
    const ub = new URL(b);
    ua.hash = "";
    ub.hash = "";
    return ua.href === ub.href;
  } catch (_) {
    return false;
  }
}

export function looksLikeUrl(value) {
  const v = String(value || "").trim();
  if (!v) {
    return false;
  }
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) {
    return true;
  }
  if (v.startsWith("localhost") || /^localhost[:/]/i.test(v)) {
    return true;
  }
  if (/^(\d{1,3}\.){3}\d{1,3}(:\d+)?(\/|$)/.test(v)) {
    return true;
  }
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+([/:?#].*)?$/i.test(v) && !/\s/.test(v)) {
    return true;
  }
  return false;
}

export function migrateLegacySearchUrl(url, resolveQuery) {
  try {
    const parsed = new URL(url);
    const shell = new URL(window.location.href);
    const path = parsed.pathname.replace(/\\/g, "/").toLowerCase();
    const isLocalShellPage =
      parsed.protocol === shell.protocol && parsed.origin === shell.origin;
    if (!isLocalShellPage || !path.endsWith("/search.html")) return url;
    const query = String(parsed.searchParams.get("q") || "").trim();
    if (!query) return "about:blank";
    return typeof resolveQuery === "function" ? resolveQuery(query) : query;
  } catch (_) {
    return url;
  }
}

/** Height of the chrome strip the shell occupies above the content pane. */
export function measureChromeHeight(root) {
  const titlebar = root ? root.querySelector(".titlebar") : null;
  const topbar = root ? root.querySelector("#topbar") : null;
  const th = titlebar ? titlebar.getBoundingClientRect().height : 36;
  const oh = topbar ? topbar.getBoundingClientRect().height : 0;
  return Math.max(36, Math.round(th + oh));
}
