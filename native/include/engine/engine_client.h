#pragma once

#include <cstdint>
#include <string>

#include "include/cef_browser.h"
#include "include/cef_client.h"
#include "include/views/cef_browser_view.h"
#include "include/views/cef_overlay_controller.h"
#include "include/wrapper/cef_message_router.h"
#include "engine/engine_json.h"
#include "engine/engine_pane.h"
#include "engine/engine_window_hooks.h"

namespace engine {

/**
 * The browser mechanics contract.
 *
 * This is the surface the engine exposes to everything that drives a
 * browser: tab lifecycle, navigation, content visibility, media state, the
 * in-page find bar, the floating overlay, the native app menu mechanism and
 * the event stream. It deliberately contains no product concept (no AI
 * agents, no game library, no terminals, no settings store), so code that
 * only needs browser mechanics can depend on it without dragging the product
 * host in.
 *
 * The concrete implementation is the product's CefClient. The interface
 * exists so that the dependency points at the contract rather than at the
 * host object.
 */
class EngineClient : public CefClient, public EngineWindowHooks {
 public:
  // ---- Browser identity -------------------------------------------------
  virtual bool IsShellBrowser(CefRefPtr<CefBrowser> browser) const = 0;
  virtual bool IsContentBrowser(CefRefPtr<CefBrowser> browser) const = 0;
  virtual bool IsOverlayBrowser(CefRefPtr<CefBrowser> browser) const = 0;
  virtual bool IsDevToolsBrowser(CefRefPtr<CefBrowser> browser) const = 0;

  // ---- Pane registration ------------------------------------------------
  virtual void RegisterBrowserPane(CefRefPtr<CefBrowser> browser,
                                   BrowserPane pane) = 0;
  virtual void UnregisterBrowserPane(CefRefPtr<CefBrowser> browser) = 0;

  // ---- Views ------------------------------------------------------------
  virtual CefRefPtr<CefBrowserView> shell_browser_view() const = 0;
  virtual CefRefPtr<CefBrowserView> content_browser_view() const = 0;
  virtual void SetShellBrowserView(CefRefPtr<CefBrowserView> view) = 0;
  virtual void SetContentBrowserView(CefRefPtr<CefBrowserView> view) = 0;
  virtual void SetOverlayBrowserView(CefRefPtr<CefBrowserView> view) = 0;
  virtual void SetOverlayController(
      CefRefPtr<CefOverlayController> controller) = 0;

  // ---- Tabs -------------------------------------------------------------
  virtual bool EnsureContentTab(const std::string& tab_id) = 0;
  virtual bool ActivateContentTab(const std::string& tab_id) = 0;
  virtual void CloseContentTab(const std::string& tab_id) = 0;
  virtual std::string ActiveContentTabId() const = 0;
  virtual size_t ContentTabCount() const = 0;
  virtual CefRefPtr<CefBrowserView> ContentViewForTab(
      const std::string& tab_id) const = 0;
  virtual bool HasPendingContentUrl(const std::string& tab_id) const = 0;

  // ---- Navigation -------------------------------------------------------
  virtual bool ContentNavigate(const std::string& url) = 0;
  virtual bool ContentNavigate(const std::string& url,
                               const std::string& tab_id) = 0;
  virtual void ContentGoBack() = 0;
  virtual void ContentGoForward() = 0;
  virtual void ContentReload(bool ignore_cache) = 0;
  virtual void ContentStop() = 0;
  virtual void ContentClear() = 0;

  // ---- Visibility and layout -------------------------------------------
  virtual void SetContentVisible(bool visible) = 0;
  virtual void SetChromeHeight(int height) = 0;
  virtual int chrome_height() const = 0;
  virtual bool content_visible() const = 0;
  virtual void LayoutContentBrowser() = 0;

  // ---- Media ------------------------------------------------------------
  virtual bool content_audio_playing() const = 0;
  virtual void SetContentAudioPlaying(CefRefPtr<CefBrowser> browser,
                                      bool playing) = 0;
  virtual void SetContentAudioMuted(bool muted) = 0;
  virtual void SetContentAudioMuted(const std::string& tab_id, bool muted) = 0;
  virtual bool ContentAudioMuted(const std::string& tab_id) const = 0;
  virtual bool ContentAudioMuted() const = 0;
  virtual void SetContentMedia(CefRefPtr<CefBrowser> browser,
                               const Json& media) = 0;
  virtual bool ContentMediaControl(const std::string& tab_id,
                                   const std::string& action,
                                   double value) = 0;

  // ---- In-page find -----------------------------------------------------
  virtual void ToggleFindBar() = 0;
  virtual void ShowFindBar() = 0;
  virtual void HideFindBar() = 0;

  // ---- Floating overlay -------------------------------------------------
  virtual void OverlayShow(int anchor_right,
                           int anchor_top,
                           int width,
                           int height,
                           const Json& payload) = 0;
  virtual void OverlayResize(int width, int height) = 0;
  virtual void OverlayHide() = 0;
  virtual void HandleOverlayCommand(const Json& command) = 0;

  // ---- Native app menu mechanism ----------------------------------------
  // The engine owns the mechanism (where the menu is anchored, when it is
  // dismissed); the product owns the menu content.
  virtual void ShowAppMenu(int anchor_left,
                           int anchor_top,
                           int anchor_right,
                           int anchor_bottom,
                           const Json& payload) = 0;
  virtual void CancelAppMenu() = 0;

  // ---- DevTools ---------------------------------------------------------
  virtual bool IsDevToolsDocked() const = 0;
  virtual void SetDevToolsDocked(bool docked) = 0;
  virtual CefRefPtr<CefBrowserView> devtools_browser_view() const = 0;
  virtual void SetDevToolsBrowserView(CefRefPtr<CefBrowserView> view) = 0;
  virtual void RegisterDevToolsBrowser(CefRefPtr<CefBrowser> browser) = 0;

  // ---- State and events -------------------------------------------------
  virtual Json ContentStateJson() const = 0;
  virtual Json GetTabsListJson() const = 0;
  virtual void EmitBrowserEvent(const Json& event) = 0;
  virtual void SubscribeBrowserEvents(
      int64_t query_id,
      CefRefPtr<CefMessageRouterBrowserSide::Callback> callback) = 0;
  virtual void UnsubscribeBrowserEvents(int64_t query_id) = 0;
  virtual void SubscribeOverlayEvents(
      int64_t query_id,
      CefRefPtr<CefMessageRouterBrowserSide::Callback> callback) = 0;
  virtual void UnsubscribeOverlayEvents(int64_t query_id) = 0;

  // ---- Lifecycle --------------------------------------------------------
  virtual bool is_shutting_down() const = 0;
};

}  // namespace engine
