#pragma once

namespace engine {

/**
 * What happens to the app menu when a menu surface closes.
 */
enum class AppMenuDismissal {
  /** The app menu closes. */
  Dismiss,
  /** The app menu stays open: only a submenu closed. */
  Keep,
};

/**
 * The engine's rule for dismissing the app menu.
 *
 * The engine owns the mechanism (when the menu is dismissed); the product
 * owns the menu content. Closing the root menu always dismisses the app
 * menu. Closing a *submenu* only dismisses it while the platform-native
 * root menu is no longer up — otherwise the submenu would tear down the
 * whole menu the moment a submenu is picked.
 *
 * The header is CEF-free on purpose: the rule is pure logic and is
 * unit-tested without linking Chromium.
 */
AppMenuDismissal DecideAppMenuDismissal(bool is_submenu,
                                        bool root_menu_visible);

}  // namespace engine
