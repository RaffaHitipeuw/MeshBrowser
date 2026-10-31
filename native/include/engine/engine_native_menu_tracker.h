#pragma once

#include <functional>
#include <string>

namespace engine {

/**
 * Tracks the platform-native menu window that backs the app menu.
 *
 * The engine owns this mechanism: it identifies the root menu popup, keeps
 * submenus anchored on the correct side of it, and notices when the native
 * menu has closed. The product owns the menu content and the native
 * styling, and supplies them through the callbacks.
 *
 * On platforms without a native menu the tracker is an inert singleton: the
 * menu is drawn by the platform toolkit and nothing has to be tracked.
 */
class NativeMenuTracker {
 public:
  struct Callbacks {
    /**
     * A native menu popup window was created. The platform window handle is
     * passed as an opaque pointer so that this header stays platform
     * agnostic. The product may style the popup here.
     */
    std::function<void(void* native_window)> on_popup_created;

    /** The native menu has closed completely. */
    std::function<void()> on_menu_closed;

    /**
     * True for product-owned windows that are not native menus (for
     * example an always-on-top overlay). Such windows must not be mistaken
     * for a menu popup.
     */
    std::function<bool(void* native_window)> is_foreign_window;

    /** Diagnostic message. */
    std::function<void(const std::string& message)> log;
  };

  /** The process-wide tracker. */
  static NativeMenuTracker& Get();

  /**
   * Starts tracking the native menu of the given window. Re-installing
   * replaces the callbacks and the tracked window.
   */
  void Install(void* main_window, Callbacks callbacks);

  /** Stops tracking the native menu. */
  void Remove();

  /** True while the native root menu popup is open and visible. */
  bool root_menu_visible() const;

  /** True while a native root menu popup is known, visible or not. */
  bool root_menu_present() const;

  /** The callbacks currently in effect. */
  const Callbacks& callbacks() const { return callbacks_; }

  NativeMenuTracker(const NativeMenuTracker&) = delete;
  NativeMenuTracker& operator=(const NativeMenuTracker&) = delete;

 private:
  NativeMenuTracker() = default;

  Callbacks callbacks_;
  void* main_window_ = nullptr;
};

}  // namespace engine
