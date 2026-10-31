// Media sessions of the shell.
//
// Port of ui/js/features/browser/media.js. The native host pushes a "media"
// event per playing frame; the shell keeps the sessions, picks the primary
// one and can present the native overlay panel.
//
// The legacy UI had a media button (`#browser-media`) that is NOT part of
// ui/index.html, so the module bailed out and the panel was unreachable
// from the shell. The session tracking and the overlay payload are ported
// anyway — the state is exposed so the panel can be opened from a button
// (or from the native overlay) without touching the DOM.

import { bridge } from "../bridge.js";

const MEDIA_WIDTH = 320;

/** @type {Map<string, any>} */
const sessions = new Map();

const listeners = new Set();

let version = 0;

function notify() {
  version += 1;
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (err) {
      console.error("[mesh] media listener failed", err);
    }
  });
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Snapshot for useSyncExternalStore. */
export function getSnapshot() {
  return version;
}

/** The session the media panel controls: the playing one, else the first. */
export function pickPrimary() {
  const list = Array.from(sessions.values()).filter((entry) => entry && entry.active);
  if (!list.length) {
    return null;
  }
  return list.find((entry) => entry.playing) || list[0];
}

/** Handles a native "media" event. */
export function upsertMedia(msg) {
  if (!msg || !msg.tabId) {
    return;
  }
  const tabId = String(msg.tabId);
  const active = Boolean(msg.active) || Boolean(msg.playing);
  if (!active) {
    sessions.delete(tabId);
    notify();
    return;
  }
  sessions.set(tabId, {
    tabId,
    active: true,
    playing: Boolean(msg.playing),
    paused: Boolean(msg.paused),
    title: String(msg.title || ""),
    artist: String(msg.artist || ""),
    artwork: String(msg.artwork || ""),
    currentTime: Number(msg.currentTime) || 0,
    duration: Number(msg.duration) || 0,
    origin: String(msg.origin || ""),
    pageUrl: String(msg.pageUrl || ""),
    kind: String(msg.kind || ""),
    canPip: Boolean(msg.canPip),
  });
  notify();
}

export function clearTab(tabId) {
  if (!tabId) {
    return;
  }
  sessions.delete(String(tabId));
  notify();
}

export function clearAll() {
  sessions.clear();
  notify();
}

/** Sends a media command to the native host. */
export function mediaControl(action, tabId, value) {
  const targetTab = tabId || (pickPrimary() ? pickPrimary().tabId : "");
  const params = { action: String(action || "") };
  if (targetTab) {
    params.tabId = String(targetTab);
  }
  if (value != null && Number.isFinite(Number(value))) {
    params.value = Number(value);
  }
  return bridge.browserMediaControl(action, params).catch(() => {});
}

export function mediaPayload(state) {
  return {
    view: "media",
    tabId: state.tabId,
    playing: Boolean(state.playing),
    paused: Boolean(state.paused),
    title: state.title || "Playing media",
    artist: state.artist || state.origin || "",
    artwork: state.artwork || "",
    currentTime: Number(state.currentTime) || 0,
    duration: Number(state.duration) || 0,
    origin: state.origin || "",
    pageUrl: state.pageUrl || "",
    canPip: Boolean(state.canPip),
  };
}

/**
 * Presents the native media overlay.
 * @param {object} state
 * @param {{left: number, top: number, right: number, bottom: number}|null} anchorRect
 * @param {{keepSize?: boolean}} options
 */
export function presentOverlay(state, anchorRect, { keepSize = false } = {}) {
  if (!state) {
    return Promise.resolve(false);
  }
  const rect = anchorRect || {
    left: window.innerWidth - MEDIA_WIDTH - 8,
    right: window.innerWidth - 8,
    top: 36,
    bottom: 64,
  };
  let right = Math.round(rect.right);
  const minRight = MEDIA_WIDTH + 8;
  right = Math.max(minRight, Math.min(right, window.innerWidth - 8));
  const top = Math.round(rect.bottom + 8);
  return bridge
    .overlayShow({
      anchorRight: right,
      anchorTop: top,
      width: MEDIA_WIDTH,
      height: keepSize ? 0 : 148,
      payload: mediaPayload(state),
    })
    .then(() => true)
    .catch(() => false);
}

export function hideOverlay() {
  return bridge.overlayHide().catch(() => {});
}
