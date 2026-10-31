// The shell of the browser.
//
// Replaces the imperative boot of ui/js/app.js and the modules it started
// (titlebar, browser, media, menu, adblock, autocomplete, find, update
// checker). The React tree owns the whole DOM of the page; the native host
// stays the source of truth for tabs, navigation, media and the agent state.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

import TooltipLayer from "../components/TooltipLayer.jsx";
import WindowControls from "../components/WindowControls.jsx";
import AddressBar from "../components/shell/AddressBar.jsx";
import AiControlPill from "../components/shell/AiControlPill.jsx";
import StartPage from "../components/shell/StartPage.jsx";
import TabStrip from "../components/shell/TabStrip.jsx";

import { bridge } from "../services/bridge.js";
import { useNativeChannel, useStore } from "../hooks/useStore.js";
import { installGlobalThemeApi, theme } from "../services/theme.js";
import { bootSearchEngine } from "../services/searchEngine.js";
import { createBrowserController } from "../state/browserController.js";

import * as adblockService from "../services/shell/adblock.js";
import * as mediaService from "../services/shell/media.js";
import * as panelManager from "../services/shell/panelManager.js";
import * as tabTip from "../services/shell/tabTip.js";
import * as findService from "../services/shell/find.js";
import { openAppMenu, runMenuCommand, noteNativeDismiss } from "../services/shell/appMenu.js";
import { startUpdateChecker } from "../services/shell/updateChecker.js";

export default function Shell() {
  const controller = useMemo(() => createBrowserController(), []);
  const state = useStore(controller);

  const titlebarRef = useRef(null);
  const adblockButtonRef = useRef(null);
  const focusAddressRef = useRef(null);
  const [adblockOpen, setAdblockOpen] = useState(false);

  const registerFocus = useCallback((handler) => {
    focusAddressRef.current = handler;
  }, []);

  // --- native events ----------------------------------------------------
  useNativeChannel("browser", (msg) => {
    if (!msg || !msg.type) {
      return;
    }
    if (msg.type === "focus-address-bar") {
      if (focusAddressRef.current) {
        focusAddressRef.current();
      }
    }
    if (msg.type === "media") {
      mediaService.upsertMedia(msg);
    }
    if (msg.type === "adblock.changed") {
      adblockService.applyPrefs(msg);
    }
    if (msg.type === "overlay") {
      // The native overlay was dismissed — every panel closes with it.
      panelManager.onNativeDismissAll();
      tabTip.onOverlayDismissed();
      setAdblockOpen(false);
    }
    if (msg.type === "menu-command") {
      noteNativeDismiss();
      runMenuCommand(msg, {
        controller,
        onAdblockPrefs: (prefs) => adblockService.applyPrefs(prefs),
      });
    }
    controller.onBrowserEvent(msg);
  });

  // --- boot -------------------------------------------------------------
  // The theme is already installed and booted at module scope (like every
  // other page); booting it a second time here would register a second
  // matchMedia listener and a second sync with the host.
  useEffect(() => {
    bootSearchEngine();
    controller.boot();
    startUpdateChecker();
    adblockService.refresh(controller.getCurrentUrl());
    const timer = window.setInterval(() => {
      adblockService.refresh(controller.getCurrentUrl());
    }, 5000);
    return () => window.clearInterval(timer);
  }, [controller]);

  // The native find bar is closed with Escape while the shell has the focus.
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape" && findService.isOpen()) {
        findService.close();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // --- chrome height ----------------------------------------------------
  useEffect(() => {
    const report = () => {
      const titlebar = titlebarRef.current;
      const height = titlebar
        ? Math.max(36, Math.round(titlebar.getBoundingClientRect().height))
        : 36;
      bridge.browserSetChromeHeight(height).catch(() => {});
    };
    report();
    const titlebar = titlebarRef.current;
    let observer = null;
    if (titlebar && typeof ResizeObserver === "function") {
      observer = new ResizeObserver(() => report());
      observer.observe(titlebar);
    }
    window.addEventListener("resize", report);
    return () => {
      if (observer) {
        observer.disconnect();
      }
      window.removeEventListener("resize", report);
    };
  }, []);

  // --- adblock panel ----------------------------------------------------
  const toggleAdblock = useCallback(() => {
    const button = adblockButtonRef.current;
    const anchorRect = button ? button.getBoundingClientRect() : null;
    panelManager.toggle(panelManager.PANEL_ADBLOCK, {
      open: () => {
        panelManager.prepareOpen(panelManager.PANEL_ADBLOCK);
        tabTip.releaseTabTip();
        setAdblockOpen(true);
        adblockService.presentOverlay(anchorRect, controller.getCurrentUrl());
      },
      close: () => {
        setAdblockOpen(false);
        adblockService.hideOverlay();
        panelManager.markClosed(panelManager.PANEL_ADBLOCK);
      },
    });
  }, [controller]);

  // The tab order is owned by the controller; the drag reports the new order.
  const onReorder = useCallback(
    (orderedIds, movedId) => {
      const index = orderedIds.indexOf(movedId);
      if (index >= 0) {
        controller.reorderTabs(movedId, index);
      }
    },
    [controller]
  );

  const tabs = useMemo(
    () =>
      state.tabs.map((tab) => ({
        ...tab,
        favicon: controller.faviconCandidatesForUrl(tab.url)[0],
      })),
    [state.tabs, controller]
  );

  const adblockPrefs = adblockService.getPrefs();
  const shieldsUp = adblockService.siteShieldsUp(state.url);

  return (
    <div className="app-root">
      <header className="titlebar" role="banner" ref={titlebarRef}>
        <AddressBar
          address={state.address}
          url={state.url}
          mode={state.mode}
          loading={state.loading}
          canGoBack={state.canGoBack}
          canGoForward={state.canGoForward}
          onNavigate={(value) => controller.navigate(value)}
          onBack={() => controller.goBack()}
          onForward={() => controller.goForward()}
          onReload={(hard) => controller.reloadPage({ ignoreCache: hard })}
          bookmarks={state.bookmarks}
          history={state.history}
          adblockOpen={adblockOpen}
          onToggleAdblock={toggleAdblock}
          adblockEnabled={shieldsUp}
          adblockButtonRef={adblockButtonRef}
          registerFocus={registerFocus}
        />

        <TabStrip
          tabs={tabs}
          activeId={state.activeId}
          onActivate={(id) => controller.activateTab(id)}
          onClose={(id) => controller.closeTab(id)}
          onToggleMute={(id) => controller.toggleTabAudioMute(id)}
          onNewTab={() => controller.openTab()}
          onReorder={onReorder}
        />

        <div className="titlebar-drag" aria-hidden="true" />

        <WindowControls />
      </header>

      <div className="shell" id="shell">
        <section className="workspace" id="workspace" aria-label="Browser">
          <div className="browser" id="browser" data-mode={state.mode}>
            <StartPage
              blockedTotal={adblockPrefs.blockedTotal}
              hidden={state.mode === "browse"}
            />
            <div className="browser-view" id="browser-view" hidden={state.mode !== "browse"}>
              <div className="browser-view-slot" aria-hidden="true" />
            </div>
          </div>
        </section>
      </div>

      <div className="ai-glow-overlay" id="ai-glow-overlay" aria-hidden="true" />

      <AiControlPill
        active={state.aiActive}
        paused={state.aiPaused}
        agentCount={state.agentCount}
      />

      <TooltipLayer />
    </div>
  );
}

const container =
  typeof document !== "undefined"
    ? document.getElementById("app-root")
    : null;

if (container) {
  installGlobalThemeApi();
  theme.boot();
  document.documentElement.setAttribute("data-mesh-ui", "shell");
  createRoot(container).render(<Shell />);
}
