// Settings page.
//
// Port of ui/js/settings.js. The markup mirrors ui/settings.html exactly —
// the `.hist.settings-layout` wrapper, the aside with the two
// `data-settings-nav` buttons, the two `data-settings-panel` sections and
// the `#settings-status` line. All state lives in React; the DOM is a
// function of that state.
//
// Native is the source of truth: the appearance preference, the search
// engine and the adblock preferences are read back from the host and written
// back through the bridge. The theme service keeps `mesh.appearance` in the
// UI storage and mirrors it into the native settings store.

import { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import { bridge } from "../services/bridge.js";
import { installGlobalThemeApi, theme } from "../services/theme.js";
import {
  bootSearchEngine,
  getSearchEngine,
  onSearchEngineChange,
  setSearchEngine,
} from "../services/searchEngine.js";

import SettingsNav from "../components/settings/SettingsNav.jsx";
import AppearanceGroup from "../components/settings/AppearanceGroup.jsx";
import SearchEngineGroup, {
  normalizeEngineId,
} from "../components/settings/SearchEngineGroup.jsx";
import AdblockGroup from "../components/settings/AdblockGroup.jsx";

const APPEARANCE_VALUES = ["system", "dark", "light"];

function normalizeAppearance(value) {
  return APPEARANCE_VALUES.includes(value) ? value : "system";
}

export default function SettingsPage() {
  const [section, setSection] = useState("general");
  const [appearance, setAppearance] = useState(() =>
    normalizeAppearance(theme.preference())
  );
  const [engineId, setEngineId] = useState(() => normalizeEngineId(getSearchEngine().id));
  const [adblock, setAdblock] = useState({ enabled: false, aggressive: false });
  const [adblockAvailable, setAdblockAvailable] = useState(true);
  const [savingAdblock, setSavingAdblock] = useState(false);
  const [status, setStatus] = useState("");

  const showError = useCallback((error) => {
    const message =
      error && error.message ? error.message : String(error || "unknown error");
    setStatus(`Could not save setting: ${message}`);
  }, []);

  const clearStatus = useCallback(() => setStatus(""), []);

  // ---- read the current state from the host ------------------------------

  const refreshAdblock = useCallback(async () => {
    try {
      const state = await bridge.browserAdblockGet("");
      setAdblockAvailable(true);
      setAdblock({
        enabled: Boolean(state && state.enabled),
        aggressive: Boolean(state && state.aggressive),
      });
    } catch (_) {
      setAdblockAvailable(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setAppearance(normalizeAppearance(theme.preference()));
    try {
      const result = await bridge.settingsGet("appearance");
      if (result && typeof result.value === "string") {
        setAppearance(normalizeAppearance(result.value));
      }
    } catch (_) {
      // keep the current preference
    }
    try {
      const result = await bridge.settingsGet("mesh.searchEngine");
      if (result && typeof result.value === "string") {
        const next = normalizeEngineId(result.value);
        setSearchEngine(next, false);
        setEngineId(next);
      }
    } catch (_) {
      // keep the current engine
    }
    await refreshAdblock();
  }, [refreshAdblock]);

  useEffect(() => {
    bootSearchEngine();
    refresh();
  }, [refresh]);

  // The host (or the theme service) can change the preference behind our
  // back — keep the radio in sync.
  useEffect(() => {
    return theme.onThemeChange((next) => {
      setAppearance(normalizeAppearance(next && next.preference));
    });
  }, []);

  // Another page (or the shell) may change the search engine.
  useEffect(() => {
    return onSearchEngineChange((engine) => {
      setEngineId(normalizeEngineId(engine.id));
    });
  }, []);

  // Re-read the state when the page comes back into focus.
  useEffect(() => {
    const onFocus = () => refresh();
    const onVisibility = () => {
      if (!document.hidden) refresh();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);

  // ---- writers -----------------------------------------------------------

  const handleAppearance = useCallback(
    async (value) => {
      const next = normalizeAppearance(value);
      if (next === appearance) return;
      const previous = appearance;
      setAppearance(next);
      clearStatus();
      try {
        const result = await bridge.settingsSet("appearance", next);
        if (!result || result.ok !== true) throw new Error("Save failed");
        // Apply + persist the theme in the UI storage as well.
        theme.setPreference(next);
      } catch (error) {
        setAppearance(previous);
        showError(error);
      }
    },
    [appearance, clearStatus, showError]
  );

  const handleEngine = useCallback(
    async (value) => {
      const next = normalizeEngineId(value);
      if (!next || next === engineId) return;
      const previous = engineId;
      setEngineId(next);
      clearStatus();
      try {
        const result = await bridge.settingsSet("mesh.searchEngine", next);
        if (!result || result.ok !== true) throw new Error("Save failed");
        setSearchEngine(next, false);
      } catch (error) {
        setEngineId(previous);
        showError(error);
      }
    },
    [engineId, clearStatus, showError]
  );

  const handleAdblock = useCallback(
    async (next) => {
      clearStatus();
      setSavingAdblock(true);
      try {
        const state = await bridge.browserAdblockSet({
          enabled: Boolean(next.enabled),
          aggressive: Boolean(next.aggressive),
        });
        setAdblockAvailable(true);
        setAdblock({
          enabled: Boolean(state && state.enabled),
          aggressive: Boolean(state && state.aggressive),
        });
      } catch (error) {
        showError(error);
        await refreshAdblock();
      } finally {
        setSavingAdblock(false);
      }
    },
    [clearStatus, refreshAdblock, showError]
  );

  // ---- render ------------------------------------------------------------

  return (
    <div className="hist settings-layout">
      <SettingsNav active={section} onSelect={setSection} />

      <main className="settings-main">
        <section
          className="settings-panel"
          data-settings-panel="general"
          aria-labelledby="settings-general-title"
          hidden={section !== "general"}
        >
          <div className="settings-heading">
            <h1 id="settings-general-title">General</h1>
            <p>Choose how Mesh Engine looks and searches.</p>
          </div>

          <AppearanceGroup value={appearance} onChange={handleAppearance} />

          <SearchEngineGroup value={engineId} onChange={handleEngine} />
        </section>

        <section
          className="settings-panel"
          data-settings-panel="privacy"
          aria-labelledby="settings-privacy-title"
          hidden={section !== "privacy"}
        >
          <div className="settings-heading">
            <h1 id="settings-privacy-title">Privacy &amp; security</h1>
            <p>Control protection against ads and trackers.</p>
          </div>

          <AdblockGroup
            enabled={adblock.enabled}
            aggressive={adblock.aggressive}
            available={adblockAvailable && !savingAdblock}
            onChange={handleAdblock}
          />
        </section>

        <p className="settings-status" id="settings-status" role="status" aria-live="polite">
          {status}
        </p>
      </main>
    </div>
  );
}

installGlobalThemeApi();
theme.boot();

const container = document.getElementById("app-root");
if (container) {
  document.documentElement.setAttribute("data-mesh-ui", "settings");
  createRoot(container).render(<SettingsPage />);
}
