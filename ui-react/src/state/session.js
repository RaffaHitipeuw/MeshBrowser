// Persistence of the shell state.
//
// Port of the persistence half of ui/js/features/browser/browser.js:
// the session (tabs + closed tabs), the visit history, the bookmarks and the
// list of recently closed tabs. The native stores are the source of truth;
// the local storage keeps a copy so the shell can restore a session before
// the host answers.

import { storage } from "../services/storage.js";
import {
  isBlankUrl,
  isLocalBookmarksUrl,
  isLocalDownloadsUrl,
  isLocalHistoryUrl,
  isLocalInfoUrl,
  isLocalSettingsUrl,
  localDownloadsUrl,
  migrateLegacySearchUrl,
  normalizeTabTitle,
  titleFromUrl,
  urlsMatch,
} from "../lib/url.js";
import { toNavigationUrl } from "../services/searchEngine.js";

export const SESSION_KEY = "mesh.browser.session";
export const SESSION_VERSION = 1;
export const HISTORY_KEY = "mesh.browser.history";
export const BOOKMARKS_KEY = "mesh.browser.bookmarks";
export const CLOSED_KEY = "mesh.browser.closed";
export const HISTORY_MIGRATED_KEY = "mesh.browser.historyMigrated";
export const BOOKMARKS_MIGRATED_KEY = "mesh.browser.bookmarksMigrated";
export const MAX_TAB_HISTORY = 40;
export const MAX_VISIT_HISTORY = 500;
export const MAX_BOOKMARKS = 500;
export const MAX_CLOSED_TABS = 20;

const isPrivateMode = Boolean(
  typeof window !== "undefined" && window.MeshPrivate && window.MeshPrivate.enabled
);

export function loadBookmarks() {
  try {
    const raw = storage.get(BOOKMARKS_KEY);
    const data = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(data)) {
      return [];
    }
    return data
      .map((entry) => {
        if (typeof entry === "string") {
          return entry ? { url: entry, title: titleFromUrl(entry), ts: 0 } : null;
        }
        if (!entry || typeof entry.url !== "string" || !entry || isBlankUrl(entry.url)) {
          return null;
        }
        return {
          url: entry.url,
          title: String(entry.title || titleFromUrl(entry.url)),
          ts: Number(entry.ts) || 0,
        };
      })
      .filter(Boolean)
      .slice(0, MAX_BOOKMARKS);
  } catch (_) {
    return [];
  }
}

export function saveBookmarks(entries) {
  try {
    storage.set(BOOKMARKS_KEY, JSON.stringify(entries));
  } catch (_) {
    /* ignore */
  }
}

export function loadVisitHistory() {
  if (isPrivateMode) {
    return [];
  }
  try {
    const raw = storage.get(HISTORY_KEY);
    const data = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(data)) {
      return [];
    }
    return data
      .filter((entry) => entry && typeof entry.url === "string" && entry.url)
      .map((entry) => {
        const url = migrateLegacySearchUrl(entry.url, toNavigationUrl);
        return {
          url,
          title:
            url === entry.url
              ? String(entry.title || titleFromUrl(url))
              : titleFromUrl(url),
          ts: Number(entry.ts) || 0,
        };
      })
      .filter((entry) => !isBlankUrl(entry.url))
      .slice(0, MAX_VISIT_HISTORY);
  } catch (_) {
    return [];
  }
}

export function saveVisitHistory(entries) {
  if (isPrivateMode) {
    return;
  }
  try {
    storage.set(HISTORY_KEY, JSON.stringify(entries));
  } catch (_) {
    /* ignore */
  }
}

export function loadClosedTabs() {
  if (isPrivateMode) {
    return [];
  }
  try {
    const raw = storage.get(CLOSED_KEY);
    const data = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(data)) {
      return [];
    }
    return data
      .filter((entry) => entry && Array.isArray(entry.history))
      .slice(0, MAX_CLOSED_TABS);
  } catch (_) {
    return [];
  }
}

export function saveClosedTabs(entries) {
  if (isPrivateMode) {
    return;
  }
  try {
    storage.set(CLOSED_KEY, JSON.stringify(entries));
  } catch (_) {
    /* ignore */
  }
}

export function buildSessionPayload(tabs, activeId, seq, closedTabs) {
  return {
    v: SESSION_VERSION,
    seq,
    activeId,
    tabs: tabs.map((tab) => {
      const history = Array.isArray(tab.history)
        ? tab.history.filter((entry) => typeof entry === "string")
        : [];
      const currentUrl =
        Number.isInteger(tab.index) && tab.index >= 0 ? history[tab.index] || "" : "";
      let trimmed =
        history.length > MAX_TAB_HISTORY
          ? history.slice(history.length - MAX_TAB_HISTORY)
          : history.slice();
      let index = Number.isInteger(tab.index) ? tab.index : -1;
      if (trimmed.length === 0) {
        index = -1;
      } else if (currentUrl && history.length > trimmed.length && !trimmed.includes(currentUrl)) {
        trimmed.push(currentUrl);
        if (trimmed.length > MAX_TAB_HISTORY) {
          trimmed = trimmed.slice(trimmed.length - MAX_TAB_HISTORY);
        }
        index = trimmed.length - 1;
      } else if (history.length > trimmed.length) {
        index = Math.min(
          trimmed.length - 1,
          Math.max(0, index - (history.length - trimmed.length))
        );
      } else {
        index = Math.min(trimmed.length - 1, Math.max(-1, index));
      }
      if (currentUrl) {
        const at = trimmed.indexOf(currentUrl);
        if (at >= 0) {
          index = at;
        }
      }
      return {
        id: String(tab.id),
        title: String(tab.title || "New Tab"),
        history: trimmed,
        index,
      };
    }),
    closedTabs: closedTabs.slice(0, MAX_CLOSED_TABS),
  };
}

export function applySessionData(data) {
  if (!data || data.v !== SESSION_VERSION || !Array.isArray(data.tabs) || !data.tabs.length) {
    return null;
  }
  const restored = data.tabs
    .map((tab) => {
      if (!tab || typeof tab.id !== "string") {
        return null;
      }
      const history = Array.isArray(tab.history)
        ? tab.history
            .filter((entry) => typeof entry === "string" && entry.length > 0)
            .map((entry) => migrateLegacySearchUrl(entry, toNavigationUrl))
        : [];
      let index = Number.isInteger(tab.index) ? tab.index : -1;
      if (history.length === 0) {
        index = -1;
      } else {
        index = Math.min(history.length - 1, Math.max(0, index));
      }
      return {
        id: tab.id,
        title: normalizeTabTitle(
          tab.title || "New Tab",
          index >= 0 ? history[index] : ""
        ),
        history,
        index,
        contentLive: false,
      };
    })
    .filter(Boolean);
  if (!restored.length) {
    return null;
  }
  const closed = Array.isArray(data.closedTabs)
    ? data.closedTabs
        .filter((entry) => entry && Array.isArray(entry.history))
        .map((entry) => ({
          ...entry,
          history: entry.history.map((item) => migrateLegacySearchUrl(item, toNavigationUrl)),
        }))
        .slice(0, MAX_CLOSED_TABS)
    : [];
  const seq = Math.max(
    Number(data.seq) || 0,
    ...restored.map((tab) => {
      const match = /^tab-(\d+)$/.exec(tab.id);
      return match ? Number(match[1]) : 0;
    })
  );
  const active =
    typeof data.activeId === "string" && restored.some((tab) => tab.id === data.activeId)
      ? data.activeId
      : restored[0].id;
  return { tabs: restored, closedTabs: closed, seq, activeId: active };
}

export function readLocalSession() {
  if (isPrivateMode) {
    return null;
  }
  try {
    const raw = storage.get(SESSION_KEY);
    if (!raw) {
      return null;
    }
    return applySessionData(JSON.parse(raw));
  } catch (_) {
    return null;
  }
}

export function writeLocalSession(payload) {
  if (isPrivateMode) {
    return;
  }
  try {
    storage.set(SESSION_KEY, JSON.stringify(payload));
  } catch (_) {
    /* quota / private mode */
  }
}

export function shouldRememberVisit(url) {
  if (!url || isBlankUrl(url)) return false;
  if (
    isLocalHistoryUrl(url) ||
    isLocalDownloadsUrl(url) ||
    isLocalBookmarksUrl(url) ||
    isLocalInfoUrl(url) ||
    isLocalSettingsUrl(url)
  ) {
    return false;
  }
  return true;
}

export { isPrivateMode, localDownloadsUrl, urlsMatch };
