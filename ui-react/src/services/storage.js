// Storage of the shell UI.
//
// Settings are stored per key in the local storage of the UI. The keys of the
// previous product were named after it ("omni.appearance"); they are named
// after the current product now ("mesh.appearance"). A key that is not
// written yet is read from its legacy name and moved over right away, so the
// migration happens exactly once.

const CURRENT_PREFIX = "mesh.";
const LEGACY_PREFIX = "omni.";

export function legacyKey(key) {
  if (typeof key !== "string" || !key.startsWith(CURRENT_PREFIX)) {
    return "";
  }
  return LEGACY_PREFIX + key.slice(CURRENT_PREFIX.length);
}

export function get(key) {
  try {
    const value = window.localStorage.getItem(key);
    if (value !== null) {
      return value;
    }
    const legacy = legacyKey(key);
    if (!legacy) {
      return null;
    }
    const old = window.localStorage.getItem(legacy);
    if (old !== null) {
      window.localStorage.setItem(key, old);
      window.localStorage.removeItem(legacy);
    }
    return old;
  } catch (_) {
    return null;
  }
}

export function set(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch (_) {
    // Storage is full or blocked; the UI keeps working without it.
  }
}

export function remove(key) {
  try {
    window.localStorage.removeItem(key);
  } catch (_) {
    // ignore
  }
}

export const storage = { get, set, remove, legacyKey };
