// The only channel between the UI and the native host.
//
// Wire format (unchanged from ui/js/bridge.js):
//   window.cefQuery({ request: JSON.stringify({ method, params }),
//                      persistent, onSuccess(json), onFailure(code, message) })
//
// The native side routes the method name through the engine method router
// (native/src/engine/engine_method_router.h): an exact match wins, otherwise
// the longest registered prefix wins. Method names and parameter shapes are
// part of the contract with the host and must not change.

const hasCefQuery = () =>
  typeof window !== "undefined" && typeof window.cefQuery === "function";

/**
 * @param {{method: string, params?: object}} payload
 * @param {{persistent?: boolean, onMessage?: (data: any, error: Error|null) => void}} options
 */
export function nativeQuery(payload, { persistent = false, onMessage } = {}) {
  return new Promise((resolve, reject) => {
    if (!hasCefQuery()) {
      reject(new Error("Native bridge unavailable (cefQuery missing)"));
      return;
    }
    const request = {
      request: JSON.stringify({
        method: String(payload.method || ""),
        params: payload.params && typeof payload.params === "object" ? payload.params : {},
      }),
      persistent: Boolean(persistent),
      onSuccess(response) {
        let parsed = null;
        try {
          parsed = response ? JSON.parse(response) : null;
        } catch (err) {
          if (persistent && typeof onMessage === "function") {
            onMessage(null, err);
            return;
          }
          reject(err);
          return;
        }
        if (persistent && typeof onMessage === "function") {
          onMessage(parsed, null);
          return;
        }
        resolve(parsed);
      },
      onFailure(code, message) {
        const err = new Error(message || `Native error ${code}`);
        if (persistent && typeof onMessage === "function") {
          onMessage(null, err);
          return;
        }
        reject(err);
      },
    };
    const queryId = window.cefQuery(request);
    if (persistent) {
      resolve({
        queryId,
        cancel() {
          if (typeof window.cefQueryCancel === "function" && queryId != null) {
            window.cefQueryCancel(queryId);
          }
        },
      });
    }
  });
}

/** Generic RPC into the native ApiDispatcher. */
export function call(method, params = {}, options = {}) {
  return nativeQuery({ method, params }, options);
}

const tabId = (value) => (value == null ? undefined : String(value));

export const bridge = {
  available: hasCefQuery,

  // ---- generic ----------------------------------------------------------
  call,

  // ---- window -----------------------------------------------------------
  windowMinimize: () => call("window.minimize"),
  windowToggleMaximize: () => call("window.toggleMaximize"),
  windowClose: () => call("window.close"),
  windowIsMaximized: () => call("window.isMaximized"),
  windowNew: () => call("window.new"),
  windowNewPrivate: () => call("window.newPrivate"),
  windowCursorPos: () => call("window.cursorPos"),
  windowNewWithTab: (tab) => call("window.newWithTab", { tab: tab || {} }),

  // ---- tabs / navigation ------------------------------------------------
  tabConsumePending: () => call("tab.consumePending"),
  browserNavigate: (url, id) => {
    const params = { url };
    const value = tabId(id);
    if (value) params.tabId = value;
    return call("browser.navigate", params);
  },
  browserEnsureTab: (id) => call("browser.ensureTab", { tabId: tabId(id) || "" }),
  browserActivateTab: (id) => call("browser.activateTab", { tabId: tabId(id) || "" }),
  browserCloseTab: (id) => call("browser.closeTab", { tabId: tabId(id) || "" }),
  browserBack: () => call("browser.back"),
  browserForward: () => call("browser.forward"),
  browserReload: (ignoreCache) => call("browser.reload", { ignoreCache: Boolean(ignoreCache) }),
  browserStop: () => call("browser.stop"),
  browserClear: () => call("browser.clear"),
  browserShow: (visible) => call("browser.show", { visible: Boolean(visible) }),
  browserSetChromeHeight: (height) => call("browser.setChromeHeight", { height: Number(height) || 0 }),
  browserState: () => call("browser.state"),
  browserFind: (text, forward) => call("browser.find", { text: String(text || ""), forward: forward !== false }),
  browserStopFinding: () => call("browser.stopFinding"),
  browserToggleFind: () => call("browser.toggleFind"),
  browserShowFind: () => call("browser.showFind"),
  browserHideFind: () => call("browser.hideFind"),

  // ---- devtools ---------------------------------------------------------
  devtoolsToggleDock: () => call("devtools.toggleDock"),
  devtoolsIsDocked: () => call("devtools.isDocked"),

  // ---- adblock ----------------------------------------------------------
  browserAdblockGet: (host) => call("browser.adblock.get", { host: String(host || "") }),
  browserAdblockSet: (prefs) => call("browser.adblock.set", prefs || {}),
  browserAdblockAllowlist: (host, allow) => call("browser.adblock.allowlist", { host: String(host || ""), allow: Boolean(allow) }),
  browserAdblockCosmetics: () => call("browser.adblock.cosmetics"),

  // ---- media ------------------------------------------------------------
  browserSetAudioMuted: (muted, id) => {
    const params = { muted: Boolean(muted) };
    const value = tabId(id);
    if (value) params.tabId = value;
    return call("browser.setAudioMuted", params);
  },
  browserMediaControl: (action, options = {}) => {
    // The legacy shape: browserMediaControl(action, { tabId, value }).
    const params = { action: String(action || "") };
    const tab = tabId(options.tabId);
    if (tab) params.tabId = tab;
    if (options.value != null && Number.isFinite(Number(options.value))) {
      params.value = Number(options.value);
    }
    return call("browser.mediaControl", params);
  },

  // ---- overlay ----------------------------------------------------------
  overlayShow: (params) => call("overlay.show", params || {}),
  overlayResize: (params) => call("overlay.resize", params || {}),
  overlayHide: () => call("overlay.hide"),
  overlayCommand: (command) => call("overlay.command", { command }),

  // ---- menu -------------------------------------------------------------
  menuShow: (params) => call("menu.show", params || {}),
  menuHide: () => call("menu.hide"),

  // ---- history / bookmarks / downloads ----------------------------------
  historyList: (limit) => call("history.list", limit ? { limit: Number(limit) } : {}),
  historyRecord: (entry) => call("history.record", entry || {}),
  historyRemove: (url) => call("history.remove", { url: String(url || "") }),
  historyClear: () => call("history.clear"),
  historyImport: (entries) => call("history.import", { entries: entries || [] }),

  bookmarksList: () => call("bookmarks.list"),
  bookmarksRecord: (entry) => call("bookmarks.record", entry || {}),
  bookmarksRemove: (url) => call("bookmarks.remove", { url: String(url || "") }),
  bookmarksClear: () => call("bookmarks.clear"),
  bookmarksImport: (entries) => call("bookmarks.import", { entries: entries || [] }),

  downloadsList: () => call("downloads.list"),
  downloadsRemove: (id) => call("downloads.remove", { id: String(id || "") }),
  downloadsClear: () => call("downloads.clear"),
  // The host identifies a download by its path, not by its id.
  downloadsOpen: (path) => call("downloads.open", { path: String(path || "") }),
  downloadsShowInFolder: (path) =>
    call("downloads.showInFolder", { path: String(path || "") }),

  // ---- settings / session / tabs ---------------------------------------
  settingsGet: (key) => call("settings.get", { key: String(key || "") }),
  settingsSet: (key, value) => call("settings.set", { key: String(key || ""), value }),
  sessionGet: () => call("session.get"),
  sessionSet: (session) => call("session.set", { session: session || {} }),
  tabsList: () => call("tabs.list"),
  tabsGet: (id) => call("tabs.get", { tabId: tabId(id) || "" }),

  // ---- plugins / library / terminal / git -------------------------------
  pluginsList: () => call("plugins.list"),
  pluginsRegister: (id, enabled = true) =>
    call("plugins.register", { id: String(id || ""), enabled: Boolean(enabled) }),
  libraryList: () => call("library.list"),
  libraryAdd: (entry) => call("library.add", entry || {}),
  libraryUpdate: (entry) => call("library.update", entry || {}),
  libraryRemove: (id) => call("library.remove", { id: String(id || "") }),
  libraryLaunch: (id) => call("library.launch", { id: String(id || "") }),
  libraryPickExe: () => call("library.pickExe"),
  libraryRunning: () => call("library.running"),
  terminalOpen: (params) => call("terminal.open", params || {}),
  terminalWrite: (params) => call("terminal.write", params || {}),
  terminalResize: (params) => call("terminal.resize", params || {}),
  terminalClose: (id) => call("terminal.close", { id: String(id || "") }),

  // ---- app / agent ------------------------------------------------------
  appInfo: () => call("app.info"),
  apiList: () => call("api.list"),
  agentPause: () => call("agent.pause"),
  agentResume: () => call("agent.resume"),
  gitStatus: (params) => call("git.status", params || {}),
};

/**
 * Subscribe to a native event channel.
 *
 * @param {"browser"|"overlay"} channel
 * @param {(event: any) => void} handler
 * @returns {Promise<{cancel: () => void}>}
 */
export function subscribe(channel, handler) {
  const method = channel === "overlay" ? "overlay.subscribe" : "browser.subscribe";
  return nativeQuery({ method, params: {} }, {
    persistent: true,
    onMessage: (data, error) => {
      if (error || !data) return;
      try {
        handler(data);
      } catch (err) {
        console.error(`[mesh] ${channel} event handler failed`, err);
      }
    },
  });
}
