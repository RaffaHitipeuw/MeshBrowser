#pragma once

namespace engine {

/**
 * The key codes the browser runtime reacts to.
 *
 * CEF reports `CefKeyEvent::windows_key_code` as a Windows virtual key code
 * on every platform ("sometimes it comes directly from the event, sometimes
 * it's determined using a mapping function"), so the runtime can route keys
 * without depending on the Win32 headers.
 */
namespace keys {

constexpr int kF5 = 0x74;   // VK_F5
constexpr int kF12 = 0x7B;  // VK_F12
constexpr int kI = 'I';
constexpr int kL = 'L';
constexpr int kF = 'F';
constexpr int kR = 'R';

}  // namespace keys

/**
 * A key press, reduced to what the routing rule needs.
 */
struct KeyEvent {
  /** The Windows virtual key code of the key. */
  int key_code = 0;
  bool ctrl = false;
  bool shift = false;
  bool alt = false;
};

/**
 * Where the key press happened.
 *
 * The runtime routes browser shortcuts differently depending on the pane
 * that has the focus: DevTools owns its own keys, and the reload shortcuts
 * only belong to the content pane while it is on screen.
 */
struct KeyContext {
  /** The DevTools window has the focus: browser shortcuts are off. */
  bool is_devtools_browser = false;
  /** The content pane has the focus. */
  bool is_content_browser = false;
  /** The content pane is visible (browsing, not the start page). */
  bool content_visible = false;
};

/**
 * What a key press means.
 */
enum class KeyAction {
  /** The key is not a browser shortcut. */
  None,
  /** Open or close the developer tools. */
  ToggleDevTools,
  /** Move the focus to the address bar. */
  FocusAddressBar,
  /** Show or hide the find bar. */
  ToggleFindBar,
  /** Reload the page. */
  ReloadPage,
  /** Reload the page, bypassing the cache. */
  ReloadPageIgnoringCache,
};

/**
 * Resolves a key press into the browser action it stands for.
 *
 * The engine owns the routing rule; the product supplies the actions (the
 * developer tools, the address bar, the find bar and the page reload are
 * product features).
 *
 * The header is CEF-free on purpose: the rule is pure integer handling and
 * is unit-tested without linking Chromium.
 */
KeyAction ResolveKeyAction(const KeyEvent& event, const KeyContext& context);

}  // namespace engine
