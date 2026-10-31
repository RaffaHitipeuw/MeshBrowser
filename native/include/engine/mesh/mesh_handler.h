#pragma once

#include <list>
#include <map>
#include <memory>
#include <mutex>
#include <string>
#include <unordered_set>
#include <vector>

#include "include/cef_client.h"
#include "include/cef_download_handler.h"
#include "include/cef_drag_handler.h"
#include "include/cef_find_handler.h"
#include "include/cef_focus_handler.h"
#include "include/cef_keyboard_handler.h"
#include "include/cef_resource_request_handler.h"
#include "include/views/cef_browser_view.h"
#include "include/views/cef_menu_button.h"
#include "include/views/cef_overlay_controller.h"
#include "include/views/cef_panel.h"
#include "include/wrapper/cef_message_router.h"
#include "engine/engine_client.h"
#include "engine/engine_window_delegate.h"
#include "mesh/app_menu.h"
#include "mesh/app_menu_button.h"
#include "mesh/game_launcher.h"
#include "mesh/library_json.h"
#include "mesh/library_repository.h"
#include "mesh/terminal_manager.h"
#include "mesh/ui_hot_reload.h"

namespace mesh {

// The engine owns the pane vocabulary; the product re-exports it so that
// existing mesh:: references keep working.
using engine::BrowserPane;

class AiHudOverlay;

/**
 * The product's CEF client.
 *
 * It implements the engine contract (engine::EngineClient) and adds the
 * product's own features on top: the AI agent HUD, the native app menu
 * content, the game library and the embedded terminals.
 */
class MeshHandler : public engine::EngineClient,
                    public CefDisplayHandler,
                    public CefLifeSpanHandler,
                    public CefLoadHandler,
                    public CefRequestHandler,
                    public CefDragHandler,
                    public CefFocusHandler,
                    public CefKeyboardHandler,
                    public CefDownloadHandler,
                    public CefFindHandler {
 public:
  explicit MeshHandler(bool alloy_style);
  ~MeshHandler() override;

  static MeshHandler* GetInstance();

  LibraryRepository& repository() { return repository_; }
  GameLauncher& launcher() { return launcher_; }
  TerminalManager& terminals() { return terminals_; }

  void ReloadUi();

  // ---- engine::EngineClient ---------------------------------------------
  void SetShellBrowserView(CefRefPtr<CefBrowserView> view) override;
  void SetContentBrowserView(CefRefPtr<CefBrowserView> view) override;
  void SetOverlayBrowserView(CefRefPtr<CefBrowserView> view) override;
  void SetOverlayController(CefRefPtr<CefOverlayController> controller) override;
  CefRefPtr<CefBrowserView> shell_browser_view() const override {
    return shell_browser_view_;
  }
  CefRefPtr<CefBrowserView> content_browser_view() const override {
    return ActiveContentView();
  }

  bool IsContentBrowser(CefRefPtr<CefBrowser> browser) const override;
  bool IsShellBrowser(CefRefPtr<CefBrowser> browser) const override;
  bool IsOverlayBrowser(CefRefPtr<CefBrowser> browser) const override;
  bool IsDevToolsBrowser(CefRefPtr<CefBrowser> browser) const override;
  /** IO-thread safe: content browsers tracked by CefBrowser identifier. */
  bool ShouldFilterNetwork(CefRefPtr<CefBrowser> browser) const;
  /** Pane registration from EngineBrowserViewDelegate::OnBrowserCreated. */
  void RegisterBrowserPane(CefRefPtr<CefBrowser> browser,
                           engine::BrowserPane pane) override;
  void UnregisterBrowserPane(CefRefPtr<CefBrowser> browser) override;

  // Per-tab content browsers: keep inactive pages (and media) alive.
  bool EnsureContentTab(const std::string& tab_id) override;
  bool ActivateContentTab(const std::string& tab_id) override;
  void CloseContentTab(const std::string& tab_id) override;
  std::string ActiveContentTabId() const override { return active_tab_id_; }
  size_t ContentTabCount() const override {
    return tab_content_views_.size();
  }
  bool HasPendingContentUrl(const std::string& tab_id) const override {
    return pending_content_urls_.count(tab_id) > 0;
  }
  CefRefPtr<CefBrowserView> ContentViewForTab(
      const std::string& tab_id) const override;
  std::string TabIdForContentBrowser(CefRefPtr<CefBrowser> browser) const;
  bool is_shutting_down() const override { return shutting_down_; }

  bool ContentNavigate(const std::string& url) override;
  bool ContentNavigate(const std::string& url,
                       const std::string& tab_id) override;
  void ContentGoBack() override;
  void ContentGoForward() override;
  void ContentReload(bool ignore_cache) override;
  void ContentStop() override;
  // Drop the active tab's page without showing the content pane (avoids
  // flashing the previous URL when the next navigation starts from start).
  void ContentClear() override;
  void SetContentVisible(bool visible) override;
  void SetChromeHeight(int height) override;
  int chrome_height() const override { return chrome_height_; }
  bool content_visible() const override { return content_visible_; }
  void LayoutContentBrowser() override;
  Json ContentStateJson() const override;
  Json GetTabsListJson() const override;
  void SetContentAudioPlaying(CefRefPtr<CefBrowser> browser,
                              bool playing) override;
  void SetContentAudioMuted(bool muted) override;
  void SetContentAudioMuted(const std::string& tab_id, bool muted) override;
  bool content_audio_playing() const override;
  bool ContentAudioMuted(const std::string& tab_id) const override;
  bool ContentAudioMuted() const override;
  void SetContentMedia(CefRefPtr<CefBrowser> browser,
                       const Json& media) override;
  bool ContentMediaControl(const std::string& tab_id,
                           const std::string& action,
                           double value) override;
  Json ContentMediaJson(const std::string& tab_id) const;

  void ToggleFindBar() override;
  void ShowFindBar() override;
  void HideFindBar() override;

  void OverlayShow(int anchor_right,
                   int anchor_top,
                   int width,
                   int height,
                   const Json& payload) override;
  void OverlayResize(int width, int height) override;
  void OverlayHide() override;
  void HandleOverlayCommand(const Json& command) override;

  void ShowAppMenu(int anchor_left,
                   int anchor_top,
                   int anchor_right,
                   int anchor_bottom,
                   const Json& payload) override;
  bool app_menu_open() const { return app_menu_open_; }
  void CancelAppMenu() override;

  bool IsDevToolsDocked() const override { return devtools_docked_; }
  void SetDevToolsDocked(bool docked) override;
  CefRefPtr<CefBrowserView> devtools_browser_view() const override {
    return devtools_browser_view_;
  }
  void SetDevToolsBrowserView(CefRefPtr<CefBrowserView> view) override {
    devtools_browser_view_ = view;
  }
  void RegisterDevToolsBrowser(CefRefPtr<CefBrowser> browser) override;

  void EmitBrowserEvent(const Json& event) override;
  void SubscribeBrowserEvents(
      int64_t query_id,
      CefRefPtr<CefMessageRouterBrowserSide::Callback> callback) override;
  void UnsubscribeBrowserEvents(int64_t query_id) override;
  void SubscribeOverlayEvents(
      int64_t query_id,
      CefRefPtr<CefMessageRouterBrowserSide::Callback> callback) override;
  void UnsubscribeOverlayEvents(int64_t query_id) override;

  // ---- engine::EngineWindowHooks ----------------------------------------
  void OnEngineWindowClosing() override;
  void OnEngineDestroyProductOverlays() override;
  void OnEngineLayoutProductOverlays() override;
  void OnEngineApplyWindowAppearance(CefRefPtr<CefWindow> window) override;
  void OnEngineApplyContentTheme() override;

  // ---- product features --------------------------------------------------
  void NotifyAppearanceChanged();
  void EmitOverlayEvent(const Json& event);
  void ToggleDevTools();
  void ShowDevToolsNow();
  void ShowHistoryFlyout(const Json& recent_tabs);
  void HideHistoryFlyout();
  void OnAppMenuClosed();
  void EmitMenuCommand(const Json& command);
  void EmitDownloadProgress();

  void SetAiActive(bool active, int agent_count = 1);
  void SetAiPaused(bool paused);
  bool is_ai_active() const { return ai_active_; }
  void LayoutAiHud();
  void DestroyAiHud();
  // css_x/css_y are content-viewport CSS pixels (getBoundingClientRect).
  void MoveAgentPointer(float css_x, float css_y, bool click);
  void SendAgentMouseClick(int css_x, int css_y);

  // Close content/overlay first, then allow the shell window to die. Call from
  // window chrome close paths so CEF child processes do not linger.
  void BeginShutdown();

  // ---- CefClient ---------------------------------------------------------
  CefRefPtr<CefDisplayHandler> GetDisplayHandler() override { return this; }
  CefRefPtr<CefLifeSpanHandler> GetLifeSpanHandler() override { return this; }
  CefRefPtr<CefLoadHandler> GetLoadHandler() override { return this; }
  CefRefPtr<CefRequestHandler> GetRequestHandler() override { return this; }
  CefRefPtr<CefDragHandler> GetDragHandler() override { return this; }
  CefRefPtr<CefFocusHandler> GetFocusHandler() override { return this; }
  CefRefPtr<CefKeyboardHandler> GetKeyboardHandler() override { return this; }
  CefRefPtr<CefDownloadHandler> GetDownloadHandler() override { return this; }
  CefRefPtr<CefFindHandler> GetFindHandler() override { return this; }

  void OnFindResult(CefRefPtr<CefBrowser> browser,
                    int identifier,
                    int count,
                    const CefRect& selectionRect,
                    int activeMatchOrdinal,
                    bool finalUpdate) override;

  bool OnBeforeDownload(CefRefPtr<CefBrowser> browser,
                        CefRefPtr<CefDownloadItem> download_item,
                        const CefString& suggested_name,
                        CefRefPtr<CefBeforeDownloadCallback> callback) override;
  void OnDownloadUpdated(CefRefPtr<CefBrowser> browser,
                         CefRefPtr<CefDownloadItem> download_item,
                         CefRefPtr<CefDownloadItemCallback> callback) override;

  void OnGotFocus(CefRefPtr<CefBrowser> browser) override;

  bool OnPreKeyEvent(CefRefPtr<CefBrowser> browser,
                     const CefKeyEvent& event,
                     CefEventHandle os_event,
                     bool* is_keyboard_shortcut) override;

  bool OnProcessMessageReceived(CefRefPtr<CefBrowser> browser,
                                CefRefPtr<CefFrame> frame,
                                CefProcessId source_process,
                                CefRefPtr<CefProcessMessage> message) override;

  void OnTitleChange(CefRefPtr<CefBrowser> browser,
                     const CefString& title) override;
  void OnAddressChange(CefRefPtr<CefBrowser> browser,
                       CefRefPtr<CefFrame> frame,
                       const CefString& url) override;
  bool OnConsoleMessage(CefRefPtr<CefBrowser> browser,
                        cef_log_severity_t level,
                        const CefString& message,
                        const CefString& source,
                        int line) override;

  void OnAfterCreated(CefRefPtr<CefBrowser> browser) override;
  bool DoClose(CefRefPtr<CefBrowser> browser) override;
  void OnBeforeClose(CefRefPtr<CefBrowser> browser) override;

  bool OnBeforePopup(CefRefPtr<CefBrowser> browser,
                     CefRefPtr<CefFrame> frame,
                     int popup_id,
                     const CefString& target_url,
                     const CefString& target_frame_name,
                     cef_window_open_disposition_t target_disposition,
                     bool user_gesture,
                     const CefPopupFeatures& popupFeatures,
                     CefWindowInfo& windowInfo,
                     CefRefPtr<CefClient>& client,
                     CefBrowserSettings& settings,
                     CefRefPtr<CefDictionaryValue>& extra_info,
                     bool* no_javascript_access) override;

  void OnLoadingStateChange(CefRefPtr<CefBrowser> browser,
                            bool isLoading,
                            bool canGoBack,
                            bool canGoForward) override;

  void OnLoadStart(CefRefPtr<CefBrowser> browser,
                   CefRefPtr<CefFrame> frame,
                   TransitionType transition_type) override;

  void OnLoadEnd(CefRefPtr<CefBrowser> browser,
                 CefRefPtr<CefFrame> frame,
                 int httpStatusCode) override;

  void OnLoadError(CefRefPtr<CefBrowser> browser,
                   CefRefPtr<CefFrame> frame,
                   ErrorCode errorCode,
                   const CefString& errorText,
                   const CefString& failedUrl) override;

  bool OnBeforeBrowse(CefRefPtr<CefBrowser> browser,
                      CefRefPtr<CefFrame> frame,
                      CefRefPtr<CefRequest> request,
                      bool user_gesture,
                      bool is_redirect) override;

  CefRefPtr<CefResourceRequestHandler> GetResourceRequestHandler(
      CefRefPtr<CefBrowser> browser,
      CefRefPtr<CefFrame> frame,
      CefRefPtr<CefRequest> request,
      bool is_navigation,
      bool is_download,
      const CefString& request_initiator,
      bool& disable_default_handling) override;

  bool OnOpenURLFromTab(CefRefPtr<CefBrowser> browser,
                        CefRefPtr<CefFrame> frame,
                        const CefString& target_url,
                        cef_window_open_disposition_t target_disposition,
                        bool user_gesture) override;

  void OnRenderProcessTerminated(CefRefPtr<CefBrowser> browser,
                                 TerminationStatus status,
                                 int error_code,
                                 const CefString& error_string) override;

  void OnDraggableRegionsChanged(
      CefRefPtr<CefBrowser> browser,
      CefRefPtr<CefFrame> frame,
      const std::vector<CefDraggableRegion>& regions) override;

 private:
  void PlatformTitleChange(CefRefPtr<CefBrowser> browser,
                           const CefString& title);
  void StartHotReloadIfNeeded();
  void ApplyDraggableRegions(CefRefPtr<CefBrowser> browser,
                             const std::vector<CefDraggableRegion>& regions);
  void ApplyOverlayBounds(int height);
  void EnsureAppMenuButton();
  void ForceCloseAuxiliaryBrowsers();
  void FinishShutdown();
  CefRefPtr<CefBrowser> ContentBrowser() const;
  CefRefPtr<CefBrowserView> ActiveContentView() const;
  bool OpenInContentBrowser(const std::string& url);
  /** Opens a URL in a fresh content tab (popup requests). */
  void OpenUrlInNewContentTab(const std::string& url);
  int ContentMemoryMb() const;
  void EmitContentEvent(CefRefPtr<CefBrowser> browser, Json event);
  void FlushPendingContentUrl(const std::string& tab_id);
  bool IsContentSeedIdle(CefRefPtr<CefBrowser> browser) const;
  bool ContentViewIsBooting(CefRefPtr<CefBrowserView> view) const;
  bool AnyContentViewBooting() const;
  void MarkContentSeedIdle(CefRefPtr<CefBrowser> browser);
  void ClearContentSeedIdle(CefRefPtr<CefBrowser> browser);
  void TrackBrowserIdentity(CefRefPtr<CefBrowser> browser);
  void UntrackBrowserIdentity(CefRefPtr<CefBrowser> browser);

  const bool alloy_style_;
  typedef std::list<CefRefPtr<CefBrowser>> BrowserList;
  BrowserList browsers_;
  bool closing_ = false;
  bool shutting_down_ = false;
  bool quit_posted_ = false;

  CefRefPtr<CefBrowserView> shell_browser_view_;
  // Pool of recycled content browser views to prevent CEF destruction/creation crashes
  std::vector<CefRefPtr<CefBrowserView>> recycled_content_views_;
  CefRefPtr<CefBrowserView> overlay_browser_view_;
  CefRefPtr<CefOverlayController> overlay_controller_;
  std::map<std::string, CefRefPtr<CefBrowserView>> tab_content_views_;
  std::string active_tab_id_;
  // URL to load once a newly created content browser finishes OnAfterCreated.
  std::map<std::string, std::string> pending_content_urls_;
  // Drop stale events while a recycled view navigates to about:blank.
  std::unordered_set<int> recycling_content_browser_ids_;
  // First about:blank (or recycle wipe) must finish before LoadURL of a real
  // page. CEF Alloy CHECKs if we navigate while the seed document is attaching.
  std::unordered_set<int> content_seed_idle_ids_;
  std::map<std::string, bool> tab_audio_playing_;
  std::map<std::string, Json> tab_media_;
  std::map<std::string, std::string> tab_titles_;
  CefRefPtr<CefMenuButton> app_menu_button_;
  CefRefPtr<CefOverlayController> app_menu_button_controller_;
  CefRefPtr<AppMenuButtonHost> app_menu_button_host_;
  // Chrome strip height (titlebar) in DIPs; the UI reports the measured
  // value via browser.setChromeHeight. Default matches ui/css/titlebar.css.
  int chrome_height_ = 36;
  bool content_visible_ = false;
  bool overlay_visible_ = false;
  std::string active_overlay_view_;
  bool app_menu_open_ = false;
  bool history_flyout_visible_ = false;
  bool ai_active_ = false;
  int ai_agent_count_ = 0;
  bool ai_paused_ = false;
  std::unique_ptr<AiHudOverlay> ai_hud_;
  int overlay_anchor_right_ = 0;
  int overlay_anchor_top_ = 0;
  int overlay_width_ = 244;
  int overlay_height_ = 0;
  int app_menu_btn_right_ = 0;
  int app_menu_btn_bottom_ = 0;
  CefRefPtr<AppMenuDelegate> app_menu_;

  std::map<int64_t, CefRefPtr<CefMessageRouterBrowserSide::Callback>>
      browser_subscribers_;
  std::map<int64_t, CefRefPtr<CefMessageRouterBrowserSide::Callback>>
      overlay_subscribers_;

  LibraryRepository repository_;
  GameLauncher launcher_;
  TerminalManager terminals_;
  UiHotReload hot_reload_;

  CefRefPtr<CefMessageRouterBrowserSide> message_router_;
  CefMessageRouterBrowserSide::Handler* library_handler_ = nullptr;

  // CefBrowserView APIs are UI-thread only; network hooks run on the IO thread
  // and must use these identifiers instead of GetForBrowser().
  mutable std::mutex browser_ids_mu_;
  int shell_browser_id_ = -1;
  int overlay_browser_id_ = -1;
  std::unordered_set<int> content_browser_ids_;
  std::unordered_set<int> devtools_browser_ids_;

  bool devtools_docked_ = true;
  CefRefPtr<CefBrowserView> devtools_browser_view_;

  IMPLEMENT_REFCOUNTING(MeshHandler);
};

}  // namespace mesh
