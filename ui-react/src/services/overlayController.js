// Overlay page controller.
//
// The overlay lives in its own native CEF view (ui/overlay.html). The host
// pushes "show" / "hide" events over the overlay channel and the page answers
// with the size it needs (overlay.resize) and with user commands
// (overlay.command).
//
// This module owns the overlay state (which view is open and its payload) plus
// the outbound helpers, so the React components stay declarative.

import { bridge } from "./bridge.js";
import { createStore } from "./events.js";

export const FALLBACK_FAVICON = "assets/mesh-brand/mesh_kecil.svg";
export const RELEASES_URL = "https://github.com/RaffaHitipeuw/MeshBrowser";

/** Views the host may ask the overlay to show. */
export const OVERLAY_VIEWS = ["tab-tip", "history", "media", "update", "shields"];

/** @type {{view: string|null, payload: object}} */
export const overlayStore = createStore({ view: null, payload: {} });

/** Sets the open view (and its payload). */
export function setOverlayView(view, payload) {
  overlayStore.set({
    view: String(view || "") || null,
    payload: payload && typeof payload === "object" ? payload : {},
  });
}

/** Closes the overlay (the host also hides the native view). */
export function clearOverlay() {
  overlayStore.set({ view: null, payload: {} });
}

/**
 * Handles one event of the "overlay" channel.
 * @param {any} msg
 */
export function handleOverlayEvent(msg) {
  if (!msg || !msg.type) {
    return;
  }
  if (msg.type === "show") {
    const payload = msg.payload && typeof msg.payload === "object" ? msg.payload : {};
    const view = String(payload.view || "");
    if (OVERLAY_VIEWS.includes(view)) {
      setOverlayView(view, payload);
    }
    return;
  }
  if (msg.type === "hide") {
    clearOverlay();
  }
}

/** Sends a user command back to the shell (native forwards it as menu-command). */
export function sendOverlayCommand(command) {
  if (!command || typeof command !== "object") {
    return;
  }
  bridge.overlayCommand(command).catch(() => {});
}

/** Hides the overlay from the host. */
export function hideOverlay() {
  bridge.overlayHide().catch(() => {});
}

/**
 * Media control for the media panel.
 * @param {string} action toggle | play | pause | seek | seekRelative | seekStart | seekEnd | pip
 * @param {number|undefined} value
 * @param {string} tabId
 */
export function mediaControl(action, value, tabId) {
  const params = { action: String(action || ""), tabId: String(tabId || "") };
  if (value != null && Number.isFinite(Number(value))) {
    params.value = Number(value);
  }
  // The bridge takes (action, { tabId, value }) — the legacy shape of
  // MeshBridge.browserMediaControl. Passing the value positionally would
  // drop both the tab and the value.
  bridge.browserMediaControl(params.action, { tabId: params.tabId, value: params.value }).catch(() => {});
}

/**
 * Mutes / unmutes a tab (used by the optional media mute button).
 * @param {boolean} muted
 * @param {string} tabId
 */
export function setAudioMuted(muted, tabId) {
  bridge.browserSetAudioMuted(Boolean(muted), tabId).catch(() => {});
}

// ---------------------------------------------------------------------------
// Size reporting.
//
// The overlay is a separate native view: its size is whatever the page
// reports. The legacy implementation measured the panel with
// getBoundingClientRect(), clamped the height to a minimum of 40 px and
// skipped the report when the size did not change.
// ---------------------------------------------------------------------------

let lastWidth = 0;
let lastHeight = 0;

/** Forgets the last reported size (a new panel always reports again). */
export function resetOverlaySizeReport() {
  lastWidth = 0;
  lastHeight = 0;
}

/**
 * Measures the panel and reports its size to the host.
 * @param {HTMLElement|null} panel
 */
export function reportOverlaySize(panel) {
  if (!panel || !bridge.available()) {
    return;
  }
  const rect = panel.getBoundingClientRect();
  const width = Math.max(1, Math.ceil(rect.width));
  const height = Math.max(40, Math.ceil(rect.height));
  if (width === lastWidth && height === lastHeight) {
    return;
  }
  lastWidth = width;
  lastHeight = height;
  if (height > 0) {
    bridge.overlayResize({ width, height }).catch(() => {});
  }
}
