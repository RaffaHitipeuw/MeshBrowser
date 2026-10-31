// The browser controller — the shell's state machine.
//
// Port of ui/js/features/browser/browser.js. It owns the tab list, the
// navigation state, the session persistence and the reaction to the native
// event stream ("browser.subscribe"). React reads the state through
// useSyncExternalStore, so this module stays free of JSX. The only DOM it
// touches lives outside the React tree (the drag ghost), and even that is
// driven by the React layer through the callbacks passed in.

import { bridge } from "../services/bridge.js";
import {
  addressBarLabel,
  formatTabTitle,
  isBlankUrl,
  isLocalBookmarksUrl,
  isLocalDownloadsUrl,
  isLocalHistoryUrl,
  isLocalInfoUrl,
  isLocalSettingsUrl,
  localDownloadsUrl,
  normalizeTabTitle,
  titleFromUrl,
  urlsMatch,
} from "../lib/url.js";
import { getSearchEngine, setSearchEngine, toNavigationUrl } from "../services/searchEngine.js";
import { brandMark } from "../services/theme.js";
import {
  BOOKMARKS_KEY,
  BOOKMARKS_MIGRATED_KEY,
  HISTORY_KEY,
  HISTORY_MIGRATED_KEY,
  MAX_BOOKMARKS,
  MAX_CLOSED_TABS,
  MAX_VISIT_HISTORY,
  applySessionData,
  buildSessionPayload,
  isPrivateMode,
  loadBookmarks,
  loadClosedTabs,
  loadVisitHistory,
  readLocalSession,
  saveBookmarks,
  saveClosedTabs,
  saveVisitHistory,
  shouldRememberVisit,
  writeLocalSession,
} from "./session.js";

export function newTabFavicon() {
  return brandMark();
}

function faviconCandidatesForUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "file:") {
      return [newTabFavicon()];
    }
    const host = parsed.hostname;
    const bare = host.replace(/^www\./, "");
    if (!bare) {
      return [newTabFavicon()];
    }
    return [
      `https://www.google.com/s2/favicons?domain=${encodeURIComponent(bare)}&sz=64`,
      `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`,
      `https://icons.duckduckgo.com/ip3/${bare}.ico`,
    ];
  } catch (_) {
    return [newTabFavicon()];
  }
}

export function isStartTab(tab) {
  if (!tab) return true;
  if (tab.index < 0) return true;
  return isBlankUrl(tab.history[tab.index]);
}

export function isBrowserOwnedUrl(url) {
  if (!url || isBlankUrl(url)) {
    return true;
  }
  return (
    isLocalHistoryUrl(url) ||
    isLocalDownloadsUrl(url) ||
    isLocalBookmarksUrl(url) ||
    isLocalInfoUrl(url) ||
    isLocalSettingsUrl(url)
  );
}

export function createBrowserController() {
  let seq = 0;
  /** @type {{id:string,title:string,history:string[],index:number,contentLive:boolean}[]} */
  let tabs = [];
  let activeId = null;
  let mode = "start";
  let canGoBack = false;
  let canGoForward = false;
  let loading = false;
  let pendingTraverse = 0;
  let lastPushedUrl = "";
  let navSerial = 0;
  /** @type {Map<string, boolean>} */
  const tabAudioPlaying = new Map();
  /** @type {Map<string, boolean>} */
  const tabAudioMuted = new Map();
  let aiActive = false;
  let aiPaused = false;
  let aiNativeHud = false;
  let agentCount = 0;
  let download = { active: 0, percent: 0, complete: false, visible: false };
  let adblock = {
    enabled: true,
    aggressive: false,
    allowlist: [],
    blockedTotal: 0,
    blockedForHost: 0,
    host: "",
    siteShieldsUp: true,
  };
  /** Incremented whenever the host asks the shell to focus the address bar. */
  let focusAddressBarSeq = 0;
  let bookmarkEntries = loadBookmarks();
  let visitHistory = loadVisitHistory();
  let closedTabs = loadClosedTabs();

  const listeners = new Set();
  let saveTimer = 0;
  let version = 0;
  // The snapshot is cached: useSyncExternalStore compares the snapshot by
  // identity, so a fresh object on every read would loop forever.
  let cachedSnapshot = null;
  let cachedVersion = -1;

  const buildSnapshot = () => ({
    version,
    tabs: tabs.map((tab) => ({
      id: tab.id,
      title: tab.title,
      url: tab.index >= 0 ? tab.history[tab.index] || "" : "",
      displayTitle: formatTabTitle(normalizeTabTitle(tab.title, tab.index >= 0 ? tab.history[tab.index] : "")),
      audioPlaying: Boolean(tabAudioPlaying.get(tab.id)),
      audioMuted: Boolean(tabAudioMuted.get(tab.id)),
      start: isStartTab(tab),
    })),
    activeId,
    mode,
    url: currentUrl(),
    address: addressBarLabel(currentUrl()),
    canGoBack,
    canGoForward,
    loading,
    aiActive,
    aiPaused,
    aiNativeHud,
    agentCount,
    focusAddressBarSeq,
    download,
    adblock,
    bookmarks: bookmarkEntries,
    history: visitHistory,
  });

  const snapshot = () => {
    if (cachedSnapshot && cachedVersion === version) {
      return cachedSnapshot;
    }
    cachedSnapshot = buildSnapshot();
    cachedVersion = version;
    return cachedSnapshot;
  };

  function emit() {
    version += 1;
    listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error("[mesh] browser listener failed", err);
      }
    });
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  // ---------------------------------------------------------------- helpers

  const usesNativeStore = () => bridge.available() && !isPrivateMode;

  function activeTab() {
    return tabs.find((tab) => tab.id === activeId) || null;
  }

  function currentUrl() {
    const tab = activeTab();
    if (!tab || tab.index < 0) {
      return "";
    }
    return tab.history[tab.index] || "";
  }

  function createTab() {
    seq += 1;
    return { id: `tab-${seq}`, title: "New Tab", history: [], index: -1, contentLive: false };
  }

  function setProvisionalTitle(tab, url, previousUrl) {
    if (!tab || !url || url === "about:blank") {
      return;
    }
    const prev = previousUrl || "";
    if (!tab.title || tab.title === "New Tab" || (prev && tab.title === titleFromUrl(prev))) {
      tab.title = titleFromUrl(url);
    }
  }

  function recordHistory(url, tab, mode_) {
    if (!tab || !url) return;
    if (mode_ === "traverse") {
      const existing = tab.history.findIndex((entry) => urlsMatch(entry, url));
      if (existing >= 0) {
        tab.index = existing;
      } else if (tab.index >= 0) {
        tab.history[tab.index] = url;
      } else {
        tab.history = [url];
        tab.index = 0;
      }
      lastPushedUrl = url;
      rememberVisit(url, tab.title);
      return;
    }
    if (tab.index >= 0 && urlsMatch(tab.history[tab.index], url)) {
      tab.history[tab.index] = url;
      lastPushedUrl = url;
      rememberVisit(url, tab.title);
      return;
    }
    if (urlsMatch(lastPushedUrl, url) && tab.index >= 0) {
      return;
    }
    tab.history = tab.history.slice(0, tab.index + 1);
    tab.history.push(url);
    tab.index = tab.history.length - 1;
    lastPushedUrl = url;
    rememberVisit(url, tab.title);
  }

  // ------------------------------------------------------------- persistence

  function rememberVisit(url, title) {
    if (isPrivateMode || !shouldRememberVisit(url)) {
      return;
    }
    const cleanTitle = normalizeTabTitle(title || titleFromUrl(url), url);
    const ts = Date.now();
    visitHistory = visitHistory.filter((entry) => entry.url !== url);
    visitHistory.unshift({ url, title: cleanTitle, ts });
    if (visitHistory.length > MAX_VISIT_HISTORY) {
      visitHistory.length = MAX_VISIT_HISTORY;
    }
    saveVisitHistory(visitHistory);
    bridge.historyRecord({ url, title: cleanTitle, ts }).catch(() => {});
  }

  function syncSessionToNative(payload) {
    if (isPrivateMode) {
      return;
    }
    bridge.sessionSet({ session: payload }).catch(() => {});
  }

  function saveSession() {
    if (isPrivateMode) {
      return;
    }
    try {
      const payload = buildSessionPayload(tabs, activeId, seq, closedTabs);
      writeLocalSession(payload);
      syncSessionToNative(payload);
    } catch (_) {
      /* quota / private mode */
    }
  }

  function scheduleSaveSession() {
    if (saveTimer) {
      window.clearTimeout(saveTimer);
    }
    saveTimer = window.setTimeout(() => {
      saveTimer = 0;
      saveSession();
    }, 120);
  }

  function restoreSessionFromNative() {
    if (isPrivateMode) {
      return Promise.resolve(false);
    }
    return bridge.sessionGet()
      .then((result) => {
        if (!result || !result.session) {
          return false;
        }
        const applied = applySessionData(result.session);
        if (!applied) {
          return false;
        }
        tabs = applied.tabs;
        closedTabs = applied.closedTabs;
        saveClosedTabs(closedTabs);
        seq = applied.seq;
        activeId = applied.activeId;
        return true;
      })
      .catch(() => false);
  }

  function migrateVisitHistoryToNative() {
    if (isPrivateMode) return;
    try {
      if (storage_get(HISTORY_MIGRATED_KEY) === "1") return;
    } catch (_) {
      /* continue */
    }
    if (!visitHistory.length) {
      try {
        storage_set(HISTORY_MIGRATED_KEY, "1");
      } catch (_) {
        /* ignore */
      }
      return;
    }
    bridge.historyImport(visitHistory)
      .then(() => {
        try {
          storage_set(HISTORY_MIGRATED_KEY, "1");
        } catch (_) {
          /* ignore */
        }
        pullVisitHistoryFromNative();
      })
      .catch(() => {});
  }

  function migrateBookmarksToNative() {
    try {
      if (storage_get(BOOKMARKS_MIGRATED_KEY) === "1") return;
    } catch (_) {
      /* continue */
    }
    if (!bookmarkEntries.length) {
      try {
        storage_set(BOOKMARKS_MIGRATED_KEY, "1");
      } catch (_) {
        /* ignore */
      }
      return;
    }
    bridge.bookmarksImport(bookmarkEntries)
      .then(() => {
        try {
          storage_set(BOOKMARKS_MIGRATED_KEY, "1");
        } catch (_) {
          /* ignore */
        }
        pullBookmarksFromNative();
      })
      .catch(() => {});
  }

  function pullVisitHistoryFromNative() {
    bridge.historyList()
      .then((result) => {
        if (!result || !Array.isArray(result.entries)) return;
        visitHistory = result.entries
          .filter((entry) => entry && typeof entry.url === "string" && entry.url)
          .map((entry) => ({
            url: entry.url,
            title: String(entry.title || titleFromUrl(entry.url)),
            ts: Number(entry.ts) || 0,
          }))
          .filter((entry) => !isBlankUrl(entry.url))
          .slice(0, MAX_VISIT_HISTORY);
        emit();
      })
      .catch(() => {});
  }

  function pullBookmarksFromNative() {
    bridge.bookmarksList()
      .then((result) => {
        if (!result || !Array.isArray(result.entries)) return;
        bookmarkEntries = result.entries
          .filter((entry) => entry && typeof entry.url === "string" && entry.url && !isBlankUrl(entry.url))
          .map((entry) => ({
            url: entry.url,
            title: String(entry.title || titleFromUrl(entry.url)),
            ts: Number(entry.ts) || 0,
          }))
          .slice(0, MAX_BOOKMARKS);
        if (!usesNativeStore()) {
          saveBookmarks(bookmarkEntries);
        }
        emit();
      })
      .catch(() => {});
  }

  // -------------------------------------------------------------- navigation

  function setMode(next) {
    mode = next;
    if (next !== "browse") {
      bridge.browserShow(false).catch(() => {});
    }
    emit();
  }

  function applyActiveTab() {
    const tab = activeTab();
    if (!tab) return;
    pendingTraverse = 0;
    canGoBack = false;
    canGoForward = false;
    const url = tab.index >= 0 ? tab.history[tab.index] : "";
    if (url && !isBlankUrl(url)) {
      lastPushedUrl = url;
      const run = async () => {
        await bridge.browserEnsureTab(tab.id);
        await bridge.browserActivateTab(tab.id);
        if (!tab.contentLive) {
          tab.contentLive = true;
          await bridge.browserNavigate(url, tab.id);
        }
      };
      run().catch(() => {});
      mode = "browse";
    } else {
      lastPushedUrl = "";
      bridge.browserActivateTab(tab.id).catch(() => {});
      mode = "start";
      bridge.browserShow(false).catch(() => {});
    }
    emit();
    scheduleSaveSession();
  }

  function loadUrl(url, { push = true } = {}) {
    const tab = activeTab();
    if (!tab || !url) return;
    const previousUrl = tab.index >= 0 ? tab.history[tab.index] : "";
    const serial = ++navSerial;
    pendingTraverse = 0;
    if (push) {
      recordHistory(url, tab, "push");
    } else {
      lastPushedUrl = url;
    }
    setProvisionalTitle(tab, url, previousUrl);
    tab.contentLive = true;
    mode = "browse";
    loading = true;
    emit();
    scheduleSaveSession();
    const go = async () => {
      await bridge.browserEnsureTab(tab.id);
      await bridge.browserActivateTab(tab.id);
      if (serial !== navSerial) return;
      await bridge.browserNavigate(url, tab.id);
    };
    go().catch((err) => console.error("browser.navigate failed", err));
  }

  function navigate(raw) {
    const typed = String(raw || "").trim();
    const current = currentUrl();
    if (typed && typed === addressBarLabel(current) && isBrowserOwnedUrl(current)) {
      return;
    }
    const url = toNavigationUrl(raw);
    if (!url) return;
    loadUrl(url, { push: true });
  }

  function goBack() {
    if (!canGoBack) return;
    pendingTraverse += 1;
    loading = true;
    emit();
    bridge.browserStop()
      .catch(() => {})
      .finally(() => {
        bridge.browserBack().catch(() => {
          pendingTraverse = Math.max(0, pendingTraverse - 1);
          emit();
        });
      });
  }

  function goForward() {
    if (!canGoForward) return;
    pendingTraverse += 1;
    loading = true;
    emit();
    bridge.browserStop()
      .catch(() => {})
      .finally(() => {
        bridge.browserForward().catch(() => {
          pendingTraverse = Math.max(0, pendingTraverse - 1);
          emit();
        });
      });
  }

  function reloadPage({ ignoreCache = false } = {}) {
    if (mode !== "browse") return;
    const tab = activeTab();
    const url = currentUrl();
    if ((!tab || tab.index < 0) && isBlankUrl(url)) return;
    if (loading && !ignoreCache) {
      bridge.browserStop().catch(() => {});
      return;
    }
    bridge.browserReload(Boolean(ignoreCache)).catch(() => {});
  }

  function goHome() {
    const tab = activeTab();
    if (!tab) return;
    pendingTraverse = 0;
    navSerial += 1;
    canGoBack = false;
    canGoForward = false;
    lastPushedUrl = "";
    tab.history = [];
    tab.index = -1;
    tab.title = "New Tab";
    tab.contentLive = false;
    tabAudioPlaying.delete(tab.id);
    tabAudioMuted.delete(tab.id);
    bridge.browserClear().catch(() => {});
    bridge.browserShow(false).catch(() => {});
    bridge.browserActivateTab(tab.id).catch(() => {});
    setMode("start");
    emit();
    scheduleSaveSession();
  }

  function openTab(initialUrl) {
    const tab = createTab();
    tabs = [...tabs, tab];
    activeId = tab.id;
    applyActiveTab();
    scheduleSaveSession();
    const raw = typeof initialUrl === "string" ? initialUrl.trim() : "";
    if (raw) {
      const url = toNavigationUrl(raw) || raw;
      loadUrl(url, { push: true });
    }
  }

  function activateTab(id) {
    if (!tabs.some((tab) => tab.id === id) || activeId === id) {
      return;
    }
    activeId = id;
    applyActiveTab();
    scheduleSaveSession();
  }

  function closeTab(id) {
    const index = tabs.findIndex((tab) => tab.id === id);
    if (index < 0) {
      emit();
      return;
    }
    const closing = tabs[index];
    const closeUrl = closing.index >= 0 ? closing.history[closing.index] : "";
    if (closing.history && closing.history.length > 0 && !isBlankUrl(closeUrl)) {
      closedTabs = [
        {
          id: `closed-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          title: closing.title || titleFromUrl(closeUrl),
          history: closing.history.slice(),
          index: closing.index,
          ts: Date.now(),
        },
        ...closedTabs,
      ];
      if (closedTabs.length > MAX_CLOSED_TABS) {
        closedTabs.length = MAX_CLOSED_TABS;
      }
      saveClosedTabs(closedTabs);
      rememberVisit(closeUrl, closing.title);
    }
    bridge.browserCloseTab(id).catch((err) => console.error("browserCloseTab failed", err));
    tabAudioPlaying.delete(id);
    tabAudioMuted.delete(id);
    tabs = tabs.filter((tab) => tab.id !== id);
    if (!tabs.length) {
      openTab();
      return;
    }
    if (activeId === id) {
      const next = tabs[index] || tabs[index - 1];
      activeId = next.id;
      applyActiveTab();
    } else {
      emit();
    }
    scheduleSaveSession();
  }

  function restoreClosedTab(closedId) {
    if (!closedTabs.length) return false;
    let target = null;
    if (closedId) {
      const idx = closedTabs.findIndex((entry) => entry.id === closedId);
      if (idx >= 0) {
        target = closedTabs.splice(idx, 1)[0];
      }
    }
    if (!target) {
      target = closedTabs.shift();
    }
    if (!target) return false;
    saveClosedTabs(closedTabs);
    seq += 1;
    const history = Array.isArray(target.history) ? [...target.history] : [];
    const tab = {
      id: `tab-${seq}`,
      title: target.title || "New Tab",
      history,
      index:
        history.length === 0
          ? -1
          : Math.min(history.length - 1, Math.max(0, Number.isInteger(target.index) ? target.index : 0)),
      contentLive: false,
    };
    tabs = [...tabs, tab];
    activeId = tab.id;
    applyActiveTab();
    scheduleSaveSession();
    return true;
  }

  function adoptTransferredTab(raw, { activate = true } = {}) {
    if (!raw || typeof raw !== "object") return null;
    const history = Array.isArray(raw.history)
      ? raw.history.filter((entry) => typeof entry === "string" && entry.length > 0)
      : [];
    let index = Number.isInteger(raw.index) ? raw.index : -1;
    if (history.length === 0) {
      index = -1;
    } else {
      index = Math.min(history.length - 1, Math.max(0, index));
    }
    const url = index >= 0 ? history[index] : "";
    const tab = createTab();
    tab.title = normalizeTabTitle(String(raw.title || titleFromUrl(url) || "New Tab"), url);
    tab.history = history;
    tab.index = index;
    tabs = [...tabs, tab];
    if (activate) {
      activeId = tab.id;
      applyActiveTab();
    } else {
      emit();
    }
    scheduleSaveSession();
    return tab;
  }

  /** Reorders the tabs — the drag handler of the tab strip calls this. */
  function reorderTabs(fromId, toIndex) {
    const from = tabs.findIndex((tab) => tab.id === fromId);
    if (from < 0) return;
    const next = tabs.slice();
    const [moved] = next.splice(from, 1);
    next.splice(Math.max(0, Math.min(next.length, toIndex)), 0, moved);
    tabs = next;
    emit();
    scheduleSaveSession();
  }

  function toggleTabAudioMute(tabId) {
    const id = tabId || activeId;
    if (!id) return;
    const next = !Boolean(tabAudioMuted.get(id));
    bridge.browserSetAudioMuted(next, id)
      .then((result) => {
        const muted = result && typeof result.muted === "boolean" ? result.muted : next;
        if (muted) {
          tabAudioMuted.set(id, true);
        } else {
          tabAudioMuted.delete(id);
        }
        emit();
      })
      .catch(() => {
        if (next) {
          tabAudioMuted.set(id, true);
        } else {
          tabAudioMuted.delete(id);
        }
        emit();
      });
  }

  function openDownloadsPage() {
    openTab(localDownloadsUrl());
  }

  // ---------------------------------------------------------- native events

  function onBrowserEvent(msg) {
    if (!msg || !msg.type) return;

    if (msg.type === "focus-address-bar") {
      listeners.forEach((listener) => listener());
      return;
    }
    if (msg.type === "settings.changed" && msg.key === "mesh.searchEngine") {
      setSearchEngine(msg.value, false);
      return;
    }
    if (msg.type === "download") {
      const active = Number(msg.active) || 0;
      const percent = Number(msg.percent) || 0;
      download = active > 0
        ? { active, percent, complete: false, visible: true }
        : { active: 0, percent: 100, complete: true, visible: true };
      emit();
      if (!active) {
        window.setTimeout(() => {
          download = { active: 0, percent: 0, complete: false, visible: false };
          emit();
        }, 2800);
      }
      return;
    }
    if (msg.type === "ai.active" || msg.type === "ai.status") {
      aiActive = Boolean(msg.active);
      aiPaused = Boolean(msg.paused);
      agentCount = Number(msg.agentCount) || 0;
      document.body.classList.toggle("ai-paused", aiPaused);
      document.body.classList.toggle("ai-active", aiActive && !aiPaused);
      emit();
      return;
    }
    if (msg.type === "adblock.changed") {
      adblock = { ...adblock, ...msg };
      emit();
      return;
    }
    if (msg.type === "tab.created") {
      const tabId = msg.tabId;
      if (!tabId) return;
      if (!tabs.some((tab) => tab.id === tabId)) {
        const url = msg.url || "";
        const isBlank = !url || url === "about:blank";
        tabs = [
          ...tabs,
          {
            id: tabId,
            title: msg.title || (url && !isBlank ? titleFromUrl(url) : "New Tab"),
            history: url && !isBlank ? [url] : [],
            index: url && !isBlank ? 0 : -1,
            contentLive: true,
          },
        ];
      }
      if (msg.activate) {
        activeId = tabId;
        applyActiveTab();
      } else {
        emit();
      }
      scheduleSaveSession();
      return;
    }
    if (msg.type === "tab.activated") {
      const tabId = msg.tabId;
      if (tabId && tabs.some((tab) => tab.id === tabId)) {
        activeId = tabId;
        applyActiveTab();
      }
      return;
    }
    if (msg.type === "tab.closed") {
      const tabId = msg.tabId;
      const at = tabs.findIndex((tab) => tab.id === tabId);
      if (at >= 0) {
        tabs = tabs.filter((tab) => tab.id !== tabId);
        if (!tabs.length) {
          const fresh = createTab();
          tabs = [fresh];
          activeId = fresh.id;
          applyActiveTab();
        } else if (activeId === tabId) {
          activeId = tabs[Math.min(at, tabs.length - 1)].id;
          applyActiveTab();
        } else {
          emit();
        }
        scheduleSaveSession();
      }
      return;
    }
    if (msg.type === "bookmarks") {
      pullBookmarksFromNative();
      return;
    }

    const eventTabId = typeof msg.tabId === "string" && msg.tabId ? msg.tabId : "";
    const tab = eventTabId ? tabs.find((entry) => entry.id === eventTabId) : activeTab();
    if (eventTabId && !tab) return;
    const isActiveEvent = !eventTabId || eventTabId === activeId;

    if (msg.type === "navigate" || msg.type === "visibility") {
      if (isActiveEvent && msg.visible) {
        mode = "browse";
      } else if (msg.type === "visibility" && isActiveEvent) {
        const current = activeTab();
        if (current && isStartTab(current)) {
          mode = "start";
        }
      }
      if (msg.url && tab && msg.url !== "about:blank") {
        const previousUrl = tab.index >= 0 ? tab.history[tab.index] : "";
        const historyMode = pendingTraverse > 0 ? "traverse" : "push";
        if (isActiveEvent) {
          recordHistory(msg.url, tab, historyMode);
        }
        setProvisionalTitle(tab, msg.url, previousUrl);
      }
      if (isActiveEvent) {
        syncNavButtons(msg);
      }
      emit();
      scheduleSaveSession();
      return;
    }

    if (msg.type === "address") {
      const url = msg.url || "";
      if (tab && url && url !== "about:blank") {
        const previousUrl = tab.index >= 0 ? tab.history[tab.index] : "";
        if (isActiveEvent) {
          const traversing = pendingTraverse > 0;
          if (traversing) {
            pendingTraverse = Math.max(0, pendingTraverse - 1);
          }
          recordHistory(url, tab, traversing ? "traverse" : "push");
        }
        setProvisionalTitle(tab, url, previousUrl);
      }
      if (isActiveEvent) {
        syncNavButtons(msg);
      }
      emit();
      scheduleSaveSession();
      return;
    }

    if (msg.type === "loading") {
      if (msg.url && tab && msg.url !== "about:blank" && !msg.loading) {
        if (tab.index >= 0 && !urlsMatch(tab.history[tab.index], msg.url)) {
          const previousUrl = tab.index >= 0 ? tab.history[tab.index] : "";
          if (isActiveEvent) {
            const historyMode = pendingTraverse > 0 ? "traverse" : "push";
            if (pendingTraverse > 0) {
              pendingTraverse = Math.max(0, pendingTraverse - 1);
            }
            recordHistory(msg.url, tab, historyMode);
          }
          setProvisionalTitle(tab, msg.url, previousUrl);
        }
      }
      if (isActiveEvent) {
        syncNavButtons(msg);
      }
      emit();
      scheduleSaveSession();
      return;
    }

    if (msg.type === "title" && tab && msg.title) {
      const url = tab.index >= 0 ? tab.history[tab.index] || "" : currentUrl();
      if (isBlankUrl(msg.title) || /^about:blank$/i.test(String(msg.title))) {
        if ((isStartTab(tab) || isBlankUrl(url)) && (!tab.title || tab.title === "New Tab")) {
          tab.title = "New Tab";
          emit();
          scheduleSaveSession();
        }
        return;
      }
      if (isStartTab(tab)) {
        tab.title = "New Tab";
      } else {
        tab.title = normalizeTabTitle(msg.title, url);
        if (isActiveEvent) {
          rememberVisit(url, tab.title);
        }
      }
      emit();
      scheduleSaveSession();
      return;
    }

    if (msg.type === "audio") {
      const audioTabId = eventTabId || activeId;
      if (typeof msg.playing === "boolean") {
        if (msg.playing) {
          tabAudioPlaying.set(audioTabId, true);
        } else {
          tabAudioPlaying.delete(audioTabId);
        }
      }
      if (typeof msg.muted === "boolean") {
        if (msg.muted) {
          tabAudioMuted.set(audioTabId, true);
        } else {
          tabAudioMuted.delete(audioTabId);
        }
      }
      emit();
      return;
    }

    if (msg.type === "media") {
      if (typeof msg.playing === "boolean") {
        const audioTabId = eventTabId || activeId;
        if (msg.playing) {
          tabAudioPlaying.set(audioTabId, true);
        } else {
          tabAudioPlaying.delete(audioTabId);
        }
        emit();
      }
      return;
    }

    syncNavButtons(msg);
  }

  function syncNavButtons(state = {}) {
    if (typeof state.canGoBack === "boolean") {
      canGoBack = state.canGoBack;
    }
    if (typeof state.canGoForward === "boolean") {
      canGoForward = state.canGoForward;
    }
    if (typeof state.loading === "boolean") {
      loading = state.loading;
    }
  }

  // -------------------------------------------------------------- lifecycle

  function ensureNativeTabs() {
    const tab = activeTab();
    if (!tab || isStartTab(tab)) {
      return;
    }
    bridge.browserEnsureTab(tab.id).catch(() => {});
  }

  async function boot() {
    migrateVisitHistoryToNative();
    migrateBookmarksToNative();
    pullVisitHistoryFromNative();
    pullBookmarksFromNative();

    const pending = await bridge.tabConsumePending().catch(() => null);
    if (pending && pending.tab) {
      const hadSession = readLocalSession();
      if (hadSession) {
        tabs = hadSession.tabs;
        closedTabs = hadSession.closedTabs;
        seq = hadSession.seq;
        activeId = hadSession.activeId;
      } else {
        tabs = [];
        activeId = "";
      }
      adoptTransferredTab(pending.tab, { activate: true });
      ensureNativeTabs();
      syncSessionToNative(buildSessionPayload(tabs, activeId, seq, closedTabs));
      emit();
      return;
    }

    const restoredLocal = readLocalSession();
    if (restoredLocal) {
      tabs = restoredLocal.tabs;
      closedTabs = restoredLocal.closedTabs;
      saveClosedTabs(closedTabs);
      seq = restoredLocal.seq;
      activeId = restoredLocal.activeId;
      ensureNativeTabs();
      syncSessionToNative(buildSessionPayload(tabs, activeId, seq, closedTabs));
      emit();
      window.setTimeout(() => {
        applyActiveTab();
      }, 150);
      return;
    }

    const restoredNative = await restoreSessionFromNative();
    if (!restoredNative) {
      openTab();
      return;
    }
    ensureNativeTabs();
    syncSessionToNative(buildSessionPayload(tabs, activeId, seq, closedTabs));
    emit();
    window.setTimeout(() => {
      applyActiveTab();
    }, 150);
  }

  return {
    // state
    getSnapshot: snapshot,
    subscribe,
    emit,
    // tabs
    openTab,
    activateTab,
    closeTab,
    reorderTabs,
    restoreClosedTab,
    adoptTransferredTab,
    toggleTabAudioMute,
    getCurrentUrl: currentUrl,
    getActiveTabId: () => activeId,
    getTabs: () => tabs,
    // navigation
    navigate,
    goBack,
    goForward,
    reloadPage,
    goHome,
    openDownloadsPage,
    // persistence
    saveSession,
    scheduleSaveSession,
    // events
    onBrowserEvent,
    boot,
    refreshHistory: pullVisitHistoryFromNative,
    refreshBookmarks: pullBookmarksFromNative,
    listBookmarks: () => bookmarkEntries,
    listHistory: () => visitHistory,
    listRecentTabs: () => closedTabs,
    faviconCandidatesForUrl,
    isBrowserOwnedUrl,
    getSearchEngine,
  };
}

// Small indirection so the storage helpers stay swappable in tests.
function storage_get(key) {
  try {
    return window.localStorage.getItem(key);
  } catch (_) {
    return null;
  }
}

function storage_set(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch (_) {
    /* ignore */
  }
}
