#pragma once

#include <string>

#include "engine/engine_app.h"
#include "engine/engine_client.h"
#include "include/cef_app.h"
#include "include/cef_command_line.h"
#include "include/cef_browser.h"
#include "include/cef_v8.h"

namespace mesh {

/**
 * The product's CEF application.
 *
 * All browser mechanics — the process lifecycle, the renderer-side message
 * router, the generic command-line switches, the creation and composition
 * of the shell/content/overlay panes and the top-level native window — live
 * in engine::EngineApp.
 *
 * This class only supplies what is product-specific:
 *   - the CefClient implementation (the product's MeshHandler),
 *   - the product's UI entry points,
 *   - the product's own start-up work (adblock lists, the MCP server).
 */
class MeshApp : public engine::EngineApp {
 public:
  MeshApp() = default;

  // The engine's generic switches are applied first; the product adds its
  // own (dev-mode) on top.
  void OnBeforeCommandLineProcessing(
      const CefString& process_type,
      CefRefPtr<CefCommandLine> command_line) override;
  void OnContextCreated(CefRefPtr<CefBrowser> browser,
                        CefRefPtr<CefFrame> frame,
                        CefRefPtr<CefV8Context> context) override;

 protected:
  // ---- Product inputs ---------------------------------------------------

  CefRefPtr<engine::EngineClient> CreateEngineClient() override;
  std::string EngineShellUrl() const override;
  std::string EngineOverlayUrl() const override;

  // ---- Product hooks ----------------------------------------------------

  void OnEnginePreInitialize() override;
  void OnEngineWindowCreated(CefRefPtr<engine::EngineClient> client) override;
};

}  // namespace mesh
