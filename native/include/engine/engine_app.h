#pragma once

#include <string>

#include "include/cef_app.h"
#include "include/wrapper/cef_message_router.h"
#include "engine/engine_client.h"

namespace engine {

/**
 * The browser engine's CEF application object.
 *
 * The engine owns the parts of the CEF host that are true browser mechanics:
 * the process lifecycle, the renderer-side message router, the generic
 * command-line switches, the creation and composition of the shell, content
 * and overlay panes, and the top-level native window.
 *
 * Everything product-specific is reached through three seams:
 *   - CreateEngineClient()  -> the product's CefClient (engine contract)
 *   - EngineShellUrl()/EngineOverlayUrl() -> the product's UI entry points
 *   - the OnEngine* hooks    -> product callbacks at defined points
 *
 * The engine never includes a product header.
 */
class EngineApp : public CefApp,
                  public CefBrowserProcessHandler,
                  public CefRenderProcessHandler {
 public:
  CefRefPtr<CefBrowserProcessHandler> GetBrowserProcessHandler() override {
    return this;
  }

  CefRefPtr<CefRenderProcessHandler> GetRenderProcessHandler() override {
    return this;
  }

  void OnBeforeCommandLineProcessing(
      const CefString& process_type,
      CefRefPtr<CefCommandLine> command_line) override;
  void OnContextInitialized() override;
  CefRefPtr<CefClient> GetDefaultClient() override;
  bool OnAlreadyRunningAppRelaunch(
      CefRefPtr<CefCommandLine> command_line,
      const CefString& current_directory) override;

  void OnWebKitInitialized() override;
  void OnContextCreated(CefRefPtr<CefBrowser> browser,
                        CefRefPtr<CefFrame> frame,
                        CefRefPtr<CefV8Context> context) override;
  void OnContextReleased(CefRefPtr<CefBrowser> browser,
                         CefRefPtr<CefFrame> frame,
                         CefRefPtr<CefV8Context> context) override;
  bool OnProcessMessageReceived(CefRefPtr<CefBrowser> browser,
                                CefRefPtr<CefFrame> frame,
                                CefProcessId source_process,
                                CefRefPtr<CefProcessMessage> message) override;

 protected:
  // ---- Product inputs ---------------------------------------------------

  /** The product's CefClient. Called once, when the CEF context is ready. */
  virtual CefRefPtr<EngineClient> CreateEngineClient() = 0;

  /** URL of the product's shell UI (the browser chrome). */
  virtual std::string EngineShellUrl() const = 0;

  /** URL of the product's floating overlay UI. */
  virtual std::string EngineOverlayUrl() const = 0;

  // ---- Product hooks ----------------------------------------------------

  /** Runs before any browser view is created (e.g. content filtering init). */
  virtual void OnEnginePreInitialize() {}

  /** Runs after the shell, content and overlay panes were created. */
  virtual void OnEngineViewsCreated(CefRefPtr<EngineClient> client) {
    (void)client;
  }

  /** Runs after the top-level window was created. */
  virtual void OnEngineWindowCreated(CefRefPtr<EngineClient> client) {
    (void)client;
  }

  // ---- Engine helpers ---------------------------------------------------

  /** Applies the engine's generic Chromium command-line switches. */
  static void ApplyEngineCommandLine(CefRefPtr<CefCommandLine> command_line);

  CefRefPtr<EngineClient> engine_client() const { return client_; }

 private:
  CefRefPtr<EngineClient> client_;
  CefRefPtr<CefMessageRouterRendererSide> renderer_router_;

  IMPLEMENT_REFCOUNTING(EngineApp);
};

}  // namespace engine
