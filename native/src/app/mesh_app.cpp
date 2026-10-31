#include "mesh/mesh_app.h"

#include <cstdlib>
#include <string>

#include "include/cef_browser.h"
#include "include/cef_command_line.h"
#include "engine/engine_client.h"
#include "mesh/adblock_service.h"
#include "mesh/dev_mode.h"
#include "mesh/mcp/mcp_server.h"
#include "mesh/mesh_handler.h"
#include "mesh/paths.h"

namespace mesh {

void MeshApp::OnBeforeCommandLineProcessing(
    const CefString& process_type,
    CefRefPtr<CefCommandLine> command_line) {
  engine::EngineApp::OnBeforeCommandLineProcessing(process_type, command_line);
  if (IsDevMode()) {
    command_line->AppendSwitchWithValue("disable-features", "IsolateOrigins");
  }
}

CefRefPtr<engine::EngineClient> MeshApp::CreateEngineClient() {
  const bool alloy_style = true;
  return new MeshHandler(alloy_style);
}

std::string MeshApp::EngineShellUrl() const {
  return paths::UiEntryUrl();
}

std::string MeshApp::EngineOverlayUrl() const {
  return paths::UiOverlayUrl();
}

void MeshApp::OnEnginePreInitialize() {
  AdblockService::Get().Initialize();
  AdblockService::Get().MaybeUpdateListsAsync();
}

void MeshApp::OnEngineWindowCreated(CefRefPtr<engine::EngineClient> client) {
  (void)client;
  // MCP after the window exists so tools don't hit a half-built handler.
  // Stdio agents that race CefInitialize still attach via HTTP once this is up.
  CefRefPtr<CefCommandLine> cmd = CefCommandLine::GetGlobalCommandLine();
  int mcp_port = 8999;
  if (cmd && cmd->HasSwitch("mcp-port")) {
    const std::string port_str = cmd->GetSwitchValue("mcp-port").ToString();
    if (!port_str.empty()) {
      mcp_port = std::atoi(port_str.c_str());
      if (mcp_port <= 0) mcp_port = 8999;
    }
  }
  if (!cmd || !cmd->HasSwitch("no-mcp")) {
    McpServer::Get().StartHttpServer(mcp_port);
  }
  if (cmd && (cmd->HasSwitch("mcp") || cmd->HasSwitch("mcp-stdio"))) {
    McpServer::Get().StartStdioServer();
  }
}

}  // namespace mesh
