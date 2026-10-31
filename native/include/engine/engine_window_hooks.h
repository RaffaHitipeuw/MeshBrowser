#pragma once

#include "include/views/cef_window.h"

namespace engine {

/**
 * Product hooks the engine calls while it manages the native window.
 *
 * The engine owns the CEF window/view lifecycle (composition, layout, the
 * floating overlay, DevTools windows, resize and close sequencing). Anything
 * product-specific that the window must react to is expressed here, so the
 * engine never has to know what a "menu", an "AI HUD" or a "settings store"
 * is.
 */
class EngineWindowHooks {
 public:
  virtual ~EngineWindowHooks() = default;

  /**
   * The window is about to close. The product should tear down its own
   * state (child processes, servers, overlays) before the browser exits.
   */
  virtual void OnEngineWindowClosing() {}

  /** Destroy product-owned overlays that live above the web content. */
  virtual void OnEngineDestroyProductOverlays() {}

  /** Re-layout product-owned overlays after the window was resized. */
  virtual void OnEngineLayoutProductOverlays() {}

  /**
   * Apply the theme to the web content (light/dark chrome). Runs after the
   * window was shown and immediately before the content pane is laid out.
   */
  virtual void OnEngineApplyContentTheme() {}

  /**
   * Apply native (platform) chrome to the freshly created window: icon,
   * dark-mode title bar, immersive menu styling, system appearance tracking
   * and the web-content theme. The engine intentionally does not implement
   * this, because it is platform chrome rather than browser mechanics.
   */
  virtual void OnEngineApplyWindowAppearance(CefRefPtr<CefWindow> window) {}
};

}  // namespace engine
