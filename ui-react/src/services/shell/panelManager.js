// Panel exclusivity for the shell.
//
// Port of ui/js/lib/overlay-manager.js. Only one panel (adblock / media /
// menu / engine) may be open at a time; opening one closes the others. A
// native dismissal suppresses the panel for 160 ms so the click that closed
// the native overlay cannot immediately reopen it.
//
// The legacy module was a global singleton with imperative `bindToggle`
// helpers. React owns the panels, so the registry keeps the state and the
// components ask it to open/close. The open panel is exposed as a small
// external store so a component can render `aria-expanded` / `is-open`
// without owning the registry.

const SUPPRESS_MS = 160;

export const PANEL_ADBLOCK = "adblock";
export const PANEL_MEDIA = "media";
export const PANEL_MENU = "menu";
export const PANEL_ENGINE = "engine";

/** @type {Map<string, {open: boolean, suppressUntil: number, close: (() => void)|null}>} */
const panels = new Map();

const listeners = new Set();

/** The panel that is currently open (null when none). */
let openPanel = null;

function panel(id) {
  if (!panels.has(id)) {
    panels.set(id, { open: false, suppressUntil: 0, close: null });
  }
  return panels.get(id);
}

function notify() {
  listeners.forEach((listener) => {
    try {
      listener(openPanel);
    } catch (err) {
      console.error("[mesh] panel manager listener failed", err);
    }
  });
}

function setOpenPanel(next) {
  if (openPanel === next) {
    return;
  }
  openPanel = next;
  notify();
}

function suppress(entry) {
  entry.suppressUntil = Date.now() + SUPPRESS_MS;
}

/**
 * Registers the close handler of a panel.
 * @param {string} id
 * @param {{close?: () => void}} handlers
 */
export function register(id, { close } = {}) {
  const entry = panel(id);
  if (typeof close === "function") {
    entry.close = close;
  }
}

export function isOpen(id) {
  return openPanel === id;
}

/** True while a native dismissal still blocks reopening the panel. */
export function shouldSuppressOpen(id) {
  return Date.now() < panel(id).suppressUntil;
}

/**
 * Opens a panel and closes every other one.
 * The legacy module also hid the tooltip here; the React tooltip layer
 * hides itself on the pointerdown that opens a panel, so no explicit call
 * is needed.
 */
export function prepareOpen(id) {
  for (const [otherId, entry] of panels) {
    if (otherId === id || !entry.open) {
      continue;
    }
    entry.open = false;
    if (typeof entry.close === "function") {
      entry.close();
    }
  }
  const entry = panel(id);
  entry.open = true;
  entry.suppressUntil = 0;
  setOpenPanel(id);
}

export function markClosed(id) {
  const entry = panel(id);
  entry.open = false;
  if (openPanel === id) {
    setOpenPanel(null);
  }
}

/** A native overlay was dismissed for this panel. */
export function onNativeDismiss(id) {
  const entry = panel(id);
  suppress(entry);
  entry.open = false;
  if (openPanel === id) {
    setOpenPanel(null);
  }
}

/**
 * A native overlay was dismissed — every panel but the app menu is closed
 * and suppressed (the menu is a native window, not an overlay).
 */
export function onNativeDismissAll() {
  for (const [id, entry] of panels) {
    if (id === PANEL_MENU) {
      continue;
    }
    suppress(entry);
    const wasOpen = entry.open;
    entry.open = false;
    if (wasOpen && typeof entry.close === "function") {
      entry.close();
    }
    if (openPanel === id) {
      setOpenPanel(null);
    }
  }
}

/**
 * Toggles a panel the way the legacy `bindToggle` helper did: closing
 * suppresses the panel for the next 160 ms, opening is ignored while the
 * panel is still suppressed.
 *
 * @param {string} id
 * @param {{open: () => void, close: () => void}} handlers
 */
export function toggle(id, { open, close } = {}) {
  const entry = panel(id);
  if (entry.open) {
    if (typeof close === "function") {
      close();
    }
    suppress(entry);
    markClosed(id);
    return;
  }
  if (Date.now() < entry.suppressUntil) {
    return;
  }
  if (typeof open === "function") {
    open();
  }
}

/** Subscribes to open-panel changes. */
export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Snapshot for useSyncExternalStore — the id of the open panel. */
export function getSnapshot() {
  return openPanel;
}
