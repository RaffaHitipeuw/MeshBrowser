// Native find bar.
//
// Port of ui/js/features/browser/find.js. The find bar is drawn by the host
// (browser.showFind / browser.hideFind / browser.toggleFind) — the shell only
// keeps track of whether it is open so that a document-level Escape handler
// can close it.

import { bridge } from "../bridge.js";

let isFindOpen = false;
let lastQuery = "";

const listeners = new Set();
let version = 0;

function notify() {
  version += 1;
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (err) {
      console.error("[mesh] find listener failed", err);
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

export function isOpen() {
  return isFindOpen;
}

export function setIsOpen(open) {
  const next = Boolean(open);
  if (next === isFindOpen) {
    return;
  }
  isFindOpen = next;
  notify();
}

export function getLastQuery() {
  return lastQuery;
}

export function setLastQuery(query) {
  lastQuery = query || "";
}

export function open() {
  bridge.browserShowFind().catch(() => {});
  setIsOpen(true);
}

export function close() {
  setIsOpen(false);
  bridge.browserHideFind().catch(() => {});
}

export function toggle() {
  bridge.browserToggleFind().catch(() => {});
  setIsOpen(!isFindOpen);
}
