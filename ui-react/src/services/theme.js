// Theme handling for the UI.
//
// Port of ui/js/lib/theme.js. The resolved theme is written to the
// <html data-theme> attribute; React renders the brand marks with the
// matching source instead of patching them into the DOM afterwards.

import { storage } from "./storage.js";
import { bridge } from "./bridge.js";

const STORAGE_KEY = "mesh.appearance";
const THEME_KEY = "mesh.appearance.theme";
const BRAND_DARK = "assets/mesh-brand/mesh_kecil.svg";
const BRAND_LIGHT = "assets/mesh-brand/mesh_kecil.svg";

let preference = "system";
let resolved = "dark";
let lastNativeTheme = null;
let media = null;
const listeners = new Set();

function emit() {
  listeners.forEach((listener) => {
    try {
      listener({ preference, theme: resolved });
    } catch (err) {
      console.error("[mesh] theme listener failed", err);
    }
  });
}

export function onThemeChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function systemIsDark() {
  return (
    !window.matchMedia ||
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

export function normalizePref(value) {
  if (value === "light" || value === "dark" || value === "system") {
    return value;
  }
  return "system";
}

function rememberNativeTheme(nativeTheme) {
  if (nativeTheme === "light" || nativeTheme === "dark") {
    lastNativeTheme = nativeTheme;
  }
}

function computeResolved(pref, nativeTheme) {
  if (document.documentElement.getAttribute("data-private") === "1") {
    return "dark";
  }
  if (pref === "light") return "light";
  if (pref === "dark") return "dark";
  rememberNativeTheme(nativeTheme);
  if (lastNativeTheme === "light" || lastNativeTheme === "dark") {
    return lastNativeTheme;
  }
  return systemIsDark() ? "dark" : "light";
}

export function brandMark() {
  return resolved === "light" ? BRAND_LIGHT : BRAND_DARK;
}

function persist(nextPref, nextTheme) {
  storage.set(STORAGE_KEY, nextPref);
  storage.set(THEME_KEY, nextTheme);
}

function apply(nextPref, persistLocal, nativeTheme) {
  preference = normalizePref(nextPref);
  rememberNativeTheme(nativeTheme);
  resolved = computeResolved(preference, nativeTheme);
  document.documentElement.setAttribute("data-theme", resolved);
  document.documentElement.style.colorScheme = resolved;
  if (persistLocal) {
    persist(preference, resolved);
  }
  emit();
}

export function setPreference(nextPref) {
  apply(nextPref, true);
  bridge.settingsSet("appearance", preference).catch(() => {});
}

export function applyExternal(nextPref, nativeTheme) {
  apply(nextPref, true, nativeTheme);
}

export function bootFromCache() {
  let cached = "system";
  let cachedTheme = "";
  try {
    cached = storage.get(STORAGE_KEY) || "system";
    cachedTheme = storage.get(THEME_KEY) || "";
  } catch (_) {
    cached = "system";
  }
  apply(cached, false, cachedTheme);
}

export function syncFromNative() {
  bridge.settingsGet("appearance")
    .then((res) => {
      const value =
        res && res.value != null
          ? res.value
          : res && res.settings && res.settings.appearance;
      if (typeof value === "string") {
        apply(value, true, res && res.theme);
      }
    })
    .catch(() => {});
}

export function boot() {
  bootFromCache();
  if (window.matchMedia) {
    media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (preference !== "system" || lastNativeTheme) {
        return;
      }
      apply("system", false);
    };
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", onChange);
    } else if (typeof media.addListener === "function") {
      media.addListener(onChange);
    }
  }
  syncFromNative();
}

export const theme = {
  boot,
  bootFromCache,
  setPreference,
  applyExternal,
  brandMark,
  onThemeChange,
  preference: () => preference,
  resolved: () => resolved,
};

// The host injects `MeshTheme.applyExternal(pref, theme)` into the shell when
// the OS appearance changes (native/src/app/mesh_handler.cpp). Keep that
// global alive — it is part of the contract with the native side.
export function installGlobalThemeApi() {
  if (typeof window === "undefined") {
    return;
  }
  window.MeshTheme = {
    boot,
    bootFromCache,
    setPreference,
    applyExternal,
    brandMark,
    onThemeChange,
    preference: () => preference,
    resolved: () => resolved,
    getPreference: () => preference,
    getTheme: () => resolved,
  };
}
