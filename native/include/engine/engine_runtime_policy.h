#pragma once

#include <string>
#include <string_view>

namespace engine {

/**
 * The URL classification rules of the browser runtime.
 *
 * The engine owns *which* URL belongs where: the app shell stays on the
 * product's own UI, the web goes to the content pane, and DevTools is
 * neither. The product owns what those URLs actually are.
 *
 * The header is CEF-free on purpose: the rules are pure string handling
 * and are unit-tested without linking Chromium.
 */

/** True for the DevTools entry points ("devtools:", "chrome-devtools:"). */
bool IsDevToolsUrl(std::string_view url);

/** True for an empty URL and for every "about:" document. */
bool IsAboutUrl(std::string_view url);

/**
 * True when the URL is a web page that belongs in the content pane.
 *
 * The app shell keeps the local UI (file:, data:) and the browser's own
 * pages (chrome:, devtools:); everything else is web content.
 */
bool ShouldOpenInContent(std::string_view url);

/**
 * What the runtime does with a popup request (window.open, target=_blank).
 */
enum class PopupAction {
  /** Let the popup open as a native Chrome-runtime window (DevTools). */
  AllowNativeChrome,
  /** Open the URL in a content pane of this browser. */
  OpenInContentTab,
  /** Drop the popup. */
  Block,
};

/**
 * Decides what happens to a popup.
 *
 * DevTools opens as a native window. A web page never spawns a standalone
 * window: it is handed to the content pane so that the page that triggered
 * the popup stays where it is. Everything else is dropped.
 */
PopupAction DecidePopupAction(std::string_view url,
                              std::string_view target_frame_name);

/**
 * Makes a suggested download name safe to use as a file name.
 *
 * Path separators and the characters that are illegal in a Windows file
 * name are replaced by an underscore.
 */
std::string SanitizeDownloadFileName(std::string_view name);

}  // namespace engine
