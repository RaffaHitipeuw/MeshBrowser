#include "engine/engine_app.h"

#include "include/cef_browser.h"
#include "include/cef_command_line.h"
#include "include/views/cef_browser_view.h"
#include "include/views/cef_window.h"
#include "include/wrapper/cef_helpers.h"
#include "engine/engine_window_delegate.h"

namespace engine {

void EngineApp::ApplyEngineCommandLine(
    CefRefPtr<CefCommandLine> command_line) {
  if (!command_line) {
    return;
  }
  // Do not force GPU rasterization / zero-copy. AMD (and Wikipedia's image
  // dense first paint) CHECKs the browser process with those flags.
  command_line->AppendSwitch("enable-quic");
  command_line->AppendSwitch("enable-smooth-scrolling");

  // Keep media playing in hidden (background) tab browser views.
  command_line->AppendSwitch("disable-backgrounding-occluded-windows");
  command_line->AppendSwitch("disable-renderer-backgrounding");
#if defined(OS_LINUX)
  if (!command_line->HasSwitch("ozone-platform")) {
    command_line->AppendSwitchWithValue("ozone-platform", "x11");
  }
#endif
}

void EngineApp::OnBeforeCommandLineProcessing(
    const CefString& process_type,
    CefRefPtr<CefCommandLine> command_line) {
  (void)process_type;
  ApplyEngineCommandLine(command_line);
}

void EngineApp::OnContextInitialized() {
  CEF_REQUIRE_UI_THREAD();

  OnEnginePreInitialize();

  client_ = CreateEngineClient();

  const cef_runtime_style_t runtime_style = CEF_RUNTIME_STYLE_ALLOY;

  CefBrowserSettings browser_settings;

  CefRefPtr<EngineBrowserViewDelegate> shell_delegate(
      new EngineBrowserViewDelegate(runtime_style, BrowserPane::Shell,
                                    client_));
  CefRefPtr<EngineBrowserViewDelegate> content_delegate(
      new EngineBrowserViewDelegate(runtime_style, BrowserPane::Content,
                                    client_));

  CefRefPtr<CefBrowserView> shell_view = CefBrowserView::CreateBrowserView(
      client_, EngineShellUrl(), browser_settings, nullptr, nullptr,
      shell_delegate);

  CefBrowserSettings content_settings;
  CefRefPtr<CefBrowserView> content_view = CefBrowserView::CreateBrowserView(
      client_, "about:blank", content_settings, nullptr, nullptr,
      content_delegate);

  // Dropdown overlay pane: floats above shell + content via
  // CefOverlayController, so menus never push the content view around.
  CefRefPtr<EngineBrowserViewDelegate> overlay_delegate(
      new EngineBrowserViewDelegate(runtime_style, BrowserPane::Overlay,
                                    client_));
  CefBrowserSettings overlay_settings;
  // Windowed CEF browsers cannot composite true transparency (transparent
  // alpha clears to white). Match Brave: opaque menu surface, sized to fit.
  overlay_settings.background_color = CefColorSetARGB(0, 0, 0, 0);
  CefRefPtr<CefBrowserView> overlay_view = CefBrowserView::CreateBrowserView(
      client_, EngineOverlayUrl(), overlay_settings, nullptr, nullptr,
      overlay_delegate);

  client_->SetShellBrowserView(shell_view);
  client_->SetContentBrowserView(content_view);
  client_->SetOverlayBrowserView(overlay_view);

  OnEngineViewsCreated(client_);

  // Do not create a fourth CEF browser for the AI HUD. The overlay HWND is
  // opaque (clips rounding) and the pill is injected into the content page.
  CefWindow::CreateTopLevelWindow(new EngineWindowDelegate(
      shell_view, content_view, overlay_view, runtime_style, client_));

  OnEngineWindowCreated(client_);
}

CefRefPtr<CefClient> EngineApp::GetDefaultClient() {
  return client_;
}

bool EngineApp::OnAlreadyRunningAppRelaunch(
    CefRefPtr<CefCommandLine> command_line,
    const CefString& current_directory) {
  (void)command_line;
  (void)current_directory;

  // Single-instance lock is tied to root_cache_path — bring the existing
  // window forward instead of opening a second profile.
  if (client_) {
    if (auto shell = client_->shell_browser_view()) {
      if (auto window = shell->GetWindow()) {
        window->Show();
        window->Activate();
        return true;
      }
    }
  }
  return true;
}

void EngineApp::OnWebKitInitialized() {
  CefMessageRouterConfig config;
  renderer_router_ = CefMessageRouterRendererSide::Create(config);
}

void EngineApp::OnContextCreated(CefRefPtr<CefBrowser> browser,
                                 CefRefPtr<CefFrame> frame,
                                 CefRefPtr<CefV8Context> context) {
  if (renderer_router_) {
    renderer_router_->OnContextCreated(browser, frame, context);
  }
}

void EngineApp::OnContextReleased(CefRefPtr<CefBrowser> browser,
                                  CefRefPtr<CefFrame> frame,
                                  CefRefPtr<CefV8Context> context) {
  if (renderer_router_) {
    renderer_router_->OnContextReleased(browser, frame, context);
  }
}

bool EngineApp::OnProcessMessageReceived(CefRefPtr<CefBrowser> browser,
                                         CefRefPtr<CefFrame> frame,
                                         CefProcessId source_process,
                                         CefRefPtr<CefProcessMessage> message) {
  if (!renderer_router_) {
    return false;
  }
  return renderer_router_->OnProcessMessageReceived(browser, frame,
                                                    source_process, message);
}

}  // namespace engine
