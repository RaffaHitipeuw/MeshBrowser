// Native event plumbing.
//
// The host pushes browser and overlay events over persistent cefQuery
// channels ("browser.subscribe" / "overlay.subscribe"). React needs those
// events as state, so every channel is exposed as a small external store that
// can be read with useSyncExternalStore.

import { subscribe } from "./bridge.js";

/**
 * Minimal external store: a snapshot, a listener set and a setter.
 * @template T
 */
export function createStore(initial) {
  let snapshot = initial;
  const listeners = new Set();
  return {
    getSnapshot: () => snapshot,
    set(next) {
      if (Object.is(next, snapshot)) return;
      snapshot = next;
      listeners.forEach((listener) => {
        try {
          listener();
        } catch (err) {
          console.error("[mesh] store listener failed", err);
        }
      });
    },
    update(patch) {
      this.set({ ...snapshot, ...patch });
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/**
 * @param {"browser"|"overlay"} channel
 * @param {(event: any) => void} handler
 * @returns {Promise<{cancel: () => void}>}
 */
export function subscribeChannel(channel, handler) {
  return subscribe(channel, handler);
}

/**
 * Keeps one native channel alive and forwards every event to a callback.
 * The subscription is opened once and closed when the component unmounts.
 *
 * @param {"browser"|"overlay"} channel
 * @param {(event: any) => void} handler
 * @returns {() => void} cancel function
 */
export function attachChannel(channel, handler) {
  let cancel = null;
  let closed = false;
  subscribeChannel(channel, handler)
    .then((handle) => {
      if (closed) {
        handle.cancel();
        return;
      }
      cancel = handle;
    })
    .catch((err) => {
      console.error(`[mesh] ${channel}.subscribe failed`, err);
    });
  return () => {
    closed = true;
    if (cancel) {
      try {
        cancel.cancel();
      } catch (_) {
        /* ignore */
      }
      cancel = null;
    }
  };
}
