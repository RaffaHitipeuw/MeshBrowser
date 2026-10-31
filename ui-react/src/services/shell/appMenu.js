// Native application menu.
//
// Port of ui/js/features/browser/menu.js. The menu itself is a native CEF
// Views menu (menu.show) — the HTML shell only anchors it and reacts to the
// commands the host sends back over the browser event stream.
//
// The legacy module bailed out immediately: the button it looked for
// (`#browser-menu`) does not exist in ui/index.html, so neither the anchor
// nor the command handling was ever active. The command handling is ported
// here (the native host emits "menu-command" events for its own app menu)
// and `openAppMenu` is kept so the menu can be anchored to any element.

import { bridge } from "../bridge.js";
import {
  localBookmarksUrl,
  localDownloadsUrl,
  localHistoryUrl,
  localInfoUrl,
  localSettingsUrl,
} from "../../lib/url.js";

let lastDismissTime = 0;

/**
 * Opens the native app menu anchored to an element.
 * @param {Element} anchor
 */
export function openAppMenu(anchor) {
  if (!anchor || typeof bridge.menuShow !== "function") {
    return Promise.resolve(false);
  }
  const rect = anchor.getBoundingClientRect();
  return bridge
    .menuShow({
      // Full button bounds — native mirrors Brave AppMenu TOPRIGHT on
      // GetAnchorBoundsInScreen().
      anchorLeft: Math.round(rect.left),
      anchorTop: Math.round(rect.top),
      anchorRight: Math.round(rect.right),
      anchorBottom: Math.round(rect.bottom),
      payload: {},
    })
    .then(() => true)
    .catch(() => false);
}

export function closeAppMenu() {
  lastDismissTime = Date.now();
  return bridge.menuHide().catch(() => {});
}

/** True while a native dismissal still blocks reopening the menu. */
export function isSuppressed() {
  return Date.now() - lastDismissTime < 150;
}

export function noteNativeDismiss() {
  lastDismissTime = Date.now();
}

/**
 * Runs a command emitted by the native menu.
 *
 * @param {{action?: string, url?: string, closedId?: string, enabled?: boolean, aggressive?: boolean}} command
 * @param {{controller: any, onAdblockPrefs?: (prefs: object) => void}} ctx
 */
export function runMenuCommand(command, ctx) {
  const action = command && command.action;
  const controller = ctx && ctx.controller;
  switch (action) {
    case "navigate":
      if (command.url && controller) {
        controller.navigate(command.url);
      }
      break;
    case "restore-tab":
      if (controller) {
        controller.restoreClosedTab(command.closedId);
      }
      break;
    case "open-history":
      if (window.MeshPrivate && window.MeshPrivate.enabled) {
        break;
      }
      if (controller) {
        controller.openTab(localHistoryUrl());
      }
      break;
    case "open-downloads":
      if (controller) {
        controller.openTab(localDownloadsUrl());
      }
      break;
    case "open-bookmarks":
      if (controller) {
        controller.openTab(localBookmarksUrl());
      }
      break;
    case "open-info":
      if (controller) {
        controller.openTab(localInfoUrl());
      }
      break;
    case "open-settings":
      if (controller) {
        controller.openTab(localSettingsUrl());
      }
      break;
    case "new-tab":
      if (controller) {
        controller.openTab();
      }
      break;
    case "new-window":
      bridge.windowNew().catch(console.error);
      break;
    case "new-private":
      bridge.windowNewPrivate().catch(console.error);
      break;
    case "clear-data":
      if (
        !window.confirm(
          "Clear browsing history, cookies, cached files, and saved HTTP sign-in credentials for this browser profile? You may be signed out of websites."
        )
      ) {
        break;
      }
      bridge
        .call("browser.clearData", {})
        .then((result) => {
          if (!result || result.ok !== true) {
            throw new Error("The browser did not confirm the deletion.");
          }
          window.alert(
            "Browsing history, cookies, cached files, and saved HTTP sign-in credentials were cleared."
          );
        })
        .catch((error) => {
          console.error("Failed to clear browsing data", error);
          window.alert(`Could not clear browsing data: ${error.message || error}`);
        });
      break;
    case "adblock-changed":
      if (ctx && typeof ctx.onAdblockPrefs === "function") {
        ctx.onAdblockPrefs({
          enabled: Boolean(command.enabled),
          aggressive: Boolean(command.aggressive),
        });
      }
      break;
    case "exit":
      bridge.windowClose().catch(console.error);
      break;
    default:
      break;
  }
}
