// Search engine selection.
//
// Port of the search-engine half of ui/js/features/browser/url.js. The chosen
// engine is kept in the UI storage and mirrored into the native settings
// store; listeners are notified so React can re-render the address bar.

import { storage } from "./storage.js";
import { bridge } from "./bridge.js";
import { looksLikeUrl } from "../lib/url.js";

const STORAGE_KEY = "mesh.searchEngine";

export const ENGINES = [
  {
    id: "brave",
    name: "Brave",
    queryUrl: "https://search.brave.com/search?q=",
    icon: "assets/search-icons/brave-color.svg",
  },
  {
    id: "duckduckgo",
    name: "DuckDuckGo",
    queryUrl: "https://duckduckgo.com/?q=",
    icon: "assets/search-icons/duckduckgo-color.svg",
  },
  {
    id: "qwant",
    name: "Qwant",
    queryUrl: "https://www.qwant.com/?q=",
    icon: "assets/search-icons/qwant-color.svg",
  },
  {
    id: "google",
    name: "Google",
    queryUrl: "https://www.google.com/search?q=",
    icon: "assets/search-icons/google-color.svg",
  },
  {
    id: "bing",
    name: "Bing",
    queryUrl: "https://www.bing.com/search?q=",
    icon: "assets/search-icons/bing-color.svg",
  },
  {
    id: "startpage",
    name: "Startpage",
    queryUrl: "https://www.startpage.com/sp/search?query=",
    icon: "assets/search-icons/startpage-color.svg",
  },
  {
    id: "ecosia",
    name: "Ecosia",
    queryUrl: "https://www.ecosia.org/search?q=",
    icon: "assets/search-icons/ecosia-color.svg",
  },
];

const DEFAULT_ENGINE_ID = "google";
const listeners = new Set();

let activeId = DEFAULT_ENGINE_ID;

function normalize(id) {
  return ENGINES.some((engine) => engine.id === id) ? id : DEFAULT_ENGINE_ID;
}

export function getEngine(id) {
  return ENGINES.find((engine) => engine.id === (id || activeId)) || ENGINES[0];
}

export function getSearchEngine() {
  return getEngine(activeId);
}

/** Selected engine first, then the remaining ones. */
export function listSearchEngines() {
  const selected = getSearchEngine();
  return [selected, ...ENGINES.filter((engine) => engine.id !== selected.id)];
}

export function onSearchEngineChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  listeners.forEach((listener) => {
    try {
      listener(getSearchEngine());
    } catch (err) {
      console.error("[mesh] search engine listener failed", err);
    }
  });
}

export function setSearchEngine(id, persistNative = true) {
  const engine = getEngine(normalize(id));
  const changed = activeId !== engine.id;
  activeId = engine.id;
  storage.set(STORAGE_KEY, activeId);
  if (persistNative) {
    bridge.settingsSet(STORAGE_KEY, activeId).catch(() => {});
  }
  if (changed) {
    notify();
  }
  return engine;
}

export function pullSearchEngineFromSettings() {
  bridge.settingsGet(STORAGE_KEY)
    .then((result) => {
      const value = result && result.value;
      if (typeof value === "string" && ENGINES.some((engine) => engine.id === value)) {
        setSearchEngine(value, false);
      } else if (value === "qubrain") {
        // Legacy id of the removed QuBrain Search engine.
        setSearchEngine(DEFAULT_ENGINE_ID, false);
      }
    })
    .catch(() => {});
}

export function bootSearchEngine() {
  const stored = normalize(storage.get(STORAGE_KEY) || DEFAULT_ENGINE_ID);
  activeId = stored;
  pullSearchEngineFromSettings();
}

/** Turns typed text into a URL, or into a search query for the engine. */
export function toNavigationUrl(raw) {
  const value = String(raw || "").trim();
  if (!value) {
    return null;
  }
  if (looksLikeUrl(value)) {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
      return value;
    }
    return `https://${value}`;
  }
  const engine = getSearchEngine();
  return `${engine.queryUrl}${encodeURIComponent(value)}`;
}
