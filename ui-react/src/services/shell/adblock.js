// Ad-blocking state of the shell.
//
// Port of ui/js/features/browser/adblock.js: the preferences the host keeps
// (enabled / aggressive / allowlist), the blocked counters and the native
// "shields" overlay panel.
//
// The button (`#browser-adblock`) exists in ui/index.html, so this state is
// visible: the button shows the shield state of the current site and opens
// the native panel.

import { bridge } from "../bridge.js";

const PANEL_WIDTH = 320;

const DEFAULT_PREFS = {
  enabled: true,
  aggressive: false,
  allowlist: [],
  blockedTotal: 0,
  blockedForHost: 0,
  host: "",
  siteShieldsUp: true,
};

let prefs = { ...DEFAULT_PREFS };

const listeners = new Set();
let version = 0;

function notify() {
  version += 1;
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (err) {
      console.error("[mesh] adblock listener failed", err);
    }
  });
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot() {
  return version;
}

export function getPrefs() {
  return prefs;
}

export function hostFromUrl(url) {
  if (!url || typeof url !== "string") {
    return "";
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }
    return (parsed.hostname || "").replace(/^www\./i, "");
  } catch (_) {
    return "";
  }
}

export function formatCount(value) {
  return (Number(value) || 0).toLocaleString();
}

/** True when the shields are up for the current site. */
export function siteShieldsUp(currentUrl) {
  if (!prefs.enabled) {
    return false;
  }
  const host = hostFromUrl(currentUrl);
  if (!host) {
    return Boolean(prefs.enabled);
  }
  const list = Array.isArray(prefs.allowlist) ? prefs.allowlist : [];
  return !list.some((entry) => {
    const value = String(entry || "").replace(/^www\./i, "");
    return value === host || host.endsWith(`.${value}`);
  });
}

export function shieldsPayload(currentUrl) {
  const pageUrl = currentUrl || "";
  const host = hostFromUrl(pageUrl) || prefs.host || "";
  const up = siteShieldsUp(pageUrl);
  return {
    view: "shields",
    host,
    pageUrl,
    enabled: Boolean(prefs.enabled),
    aggressive: Boolean(prefs.aggressive),
    siteShieldsUp: up,
    blockedForHost: Number(prefs.blockedForHost) || 0,
    blockedTotal: Number(prefs.blockedTotal) || 0,
    advancedOpen: false,
  };
}

/**
 * Presents the native shields panel.
 * @param {{left: number, top: number, right: number, bottom: number}} anchorRect
 * @param {string} currentUrl
 * @param {{keepSize?: boolean}} options
 */
export function presentOverlay(anchorRect, currentUrl, { keepSize = false } = {}) {
  if (!anchorRect) {
    return Promise.resolve(false);
  }
  let right = Math.round(anchorRect.right);
  right = Math.max(PANEL_WIDTH + 8, Math.min(right, window.innerWidth - 8));
  const top = Math.round(anchorRect.bottom + 8);
  return bridge
    .overlayShow({
      anchorRight: right,
      anchorTop: top,
      width: PANEL_WIDTH,
      height: keepSize ? 0 : 220,
      payload: shieldsPayload(currentUrl),
    })
    .then(() => true)
    .catch(() => false);
}

export function hideOverlay() {
  return bridge.overlayHide().catch(() => {});
}

/**
 * Refreshes the preferences from the host.
 * @param {string} currentUrl
 */
export async function refresh(currentUrl) {
  const host = hostFromUrl(currentUrl);
  try {
    const next = await bridge.browserAdblockGet(host);
    if (next && typeof next === "object") {
      prefs = { ...prefs, ...next };
      notify();
    }
  } catch (_) {
    // Preview without native.
  }
  return prefs;
}

/** Merges preferences pushed by the host (adblock.changed / the app menu). */
export function applyPrefs(next) {
  if (!next || typeof next !== "object") {
    return;
  }
  prefs = { ...prefs, ...next };
  notify();
}
