#pragma once

#include "include/cef_client.h"
#include "include/views/cef_browser_view.h"
#include "include/views/cef_window.h"
#include "engine/engine_client.h"
#include "engine/engine_pane.h"

namespace engine {

/**
 * The top-level native window: a vertical box layout with the shell strip on
 * top, the content pane below, and the floating overlay stacked above both.
 *
 * The engine owns the composition and the resize/close sequencing. Anything
 * product-specific is delegated to EngineWindowHooks.
 */
class EngineWindowDelegate : public CefWindowDelegate {
 public:
  EngineWindowDelegate(CefRefPtr<CefBrowserView> shell_view,
                        CefRefPtr<CefBrowserView> content_view,
                        CefRefPtr<CefBrowserView> overlay_view,
                        cef_runtime_style_t runtime_style,
                        CefRefPtr<EngineClient> client);

  void OnWindowCreated(CefRefPtr<CefWindow> window) override;
  void OnWindowDestroyed(CefRefPtr<CefWindow> window) override;
  void OnWindowBoundsChanged(CefRefPtr<CefWindow> window,
                             const CefRect& new_bounds) override;
  bool CanClose(CefRefPtr<CefWindow> window) override;
  CefSize GetPreferredSize(CefRefPtr<CefView> view) override;
  cef_runtime_style_t GetWindowRuntimeStyle() override;

  bool IsFrameless(CefRefPtr<CefWindow> window) override;
  bool CanResize(CefRefPtr<CefWindow> window) override;
  bool CanMaximize(CefRefPtr<CefWindow> window) override;
  bool CanMinimize(CefRefPtr<CefWindow> window) override;

 private:
  CefRefPtr<CefBrowserView> shell_view_;
  CefRefPtr<CefBrowserView> content_view_;
  CefRefPtr<CefBrowserView> overlay_view_;
  const cef_runtime_style_t runtime_style_;
  CefRefPtr<EngineClient> client_;
  IMPLEMENT_REFCOUNTING(EngineWindowDelegate);
};

/**
 * A separate top-level window for CEF DevTools. It must not share the main
 * window's delegate: that path is frameless and its CanClose() shuts the
 * whole application down.
 */
class EngineDevToolsWindowDelegate : public CefWindowDelegate {
 public:
  EngineDevToolsWindowDelegate(CefRefPtr<CefBrowserView> view,
                                cef_runtime_style_t runtime_style);

  void OnWindowCreated(CefRefPtr<CefWindow> window) override;
  void OnWindowDestroyed(CefRefPtr<CefWindow> window) override;
  bool CanClose(CefRefPtr<CefWindow> window) override;
  CefSize GetPreferredSize(CefRefPtr<CefView> view) override;
  cef_runtime_style_t GetWindowRuntimeStyle() override;

  bool IsFrameless(CefRefPtr<CefWindow> window) override;
  bool CanResize(CefRefPtr<CefWindow> window) override;
  bool CanMaximize(CefRefPtr<CefWindow> window) override;
  bool CanMinimize(CefRefPtr<CefWindow> window) override;

 private:
  CefRefPtr<CefBrowserView> view_;
  const cef_runtime_style_t runtime_style_;
  IMPLEMENT_REFCOUNTING(EngineDevToolsWindowDelegate);
};

/**
 * Per-browser-view delegate. Registers the created browser with the engine
 * client so the engine can route events, network filtering and layout by
 * pane.
 */
class EngineBrowserViewDelegate : public CefBrowserViewDelegate {
 public:
  EngineBrowserViewDelegate(cef_runtime_style_t runtime_style,
                             BrowserPane pane,
                             CefRefPtr<EngineClient> client);

  void OnBrowserCreated(CefRefPtr<CefBrowserView> browser_view,
                        CefRefPtr<CefBrowser> browser) override;
  void OnBrowserDestroyed(CefRefPtr<CefBrowserView> browser_view,
                          CefRefPtr<CefBrowser> browser) override;
  CefRefPtr<CefBrowserViewDelegate> GetDelegateForPopupBrowserView(
      CefRefPtr<CefBrowserView> browser_view,
      const CefBrowserSettings& settings,
      CefRefPtr<CefClient> client,
      bool is_devtools) override;
  bool OnPopupBrowserViewCreated(CefRefPtr<CefBrowserView> browser_view,
                                 CefRefPtr<CefBrowserView> popup_browser_view,
                                 bool is_devtools) override;
  cef_runtime_style_t GetBrowserRuntimeStyle() override;

  CefSize GetPreferredSize(CefRefPtr<CefView> view) override;
  CefSize GetMinimumSize(CefRefPtr<CefView> view) override;

 private:
  const cef_runtime_style_t runtime_style_;
  const BrowserPane pane_;
  CefRefPtr<EngineClient> client_;
  IMPLEMENT_REFCOUNTING(EngineBrowserViewDelegate);
};

}  // namespace engine
