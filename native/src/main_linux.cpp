#include <csignal>
#include <cstdlib>
#include <fcntl.h>
#include <string>
#include <sys/file.h>
#include <sys/stat.h>
#include <unistd.h>

#include <X11/Xlib.h>

#include "include/cef_app.h"
#include "include/cef_command_line.h"
#include "engine/engine_settings.h"
#include "mesh/log.h"
#include "mesh/mcp/mcp_server.h"
#include "mesh/mesh_app.h"
#include "mesh/paths.h"
#include "mesh/profile/launch_options.h"

namespace {

int g_gui_lock_fd = -1;

bool IsTruthySwitch(CefRefPtr<CefCommandLine> command_line, const char* name) {
  return command_line && command_line->HasSwitch(name);
}

int ParseMcpPort(CefRefPtr<CefCommandLine> command_line) {
  int port = 8999;
  if (command_line && command_line->HasSwitch("mcp-port")) {
    const std::string port_str =
        command_line->GetSwitchValue("mcp-port").ToString();
    if (!port_str.empty()) {
      port = std::atoi(port_str.c_str());
      if (port <= 0) {
        port = 8999;
      }
    }
  }
  return port;
}

void ApplyProfileInstanceFromCommandLine(CefRefPtr<CefCommandLine> command_line) {
  if (!command_line) {
    return;
  }
  const mesh::profile::LaunchOptions options =
      mesh::profile::ResolveLaunchOptions(
          command_line->HasSwitch(mesh::profile::kPrivateSwitch),
          command_line->HasSwitch(mesh::profile::kLegacyPrivateSwitch),
          command_line->GetSwitchValue(mesh::profile::kInstanceSwitch).ToString(),
          command_line
              ->GetSwitchValue(mesh::profile::kLegacyInstanceSwitch)
              .ToString());
  if (options.private_mode) {
    mesh::paths::SetPrivateMode(true);
  }
  if (options.has_instance) {
    mesh::paths::SetProfileInstanceId(options.instance_id);
  } else if (mesh::paths::IsPrivateMode()) {
    mesh::paths::SetProfileInstanceId(
        "p" + std::to_string(mesh::paths::NowTickMs()) + "x" +
        std::to_string(::getpid()));
  }
}

std::string GuiLockPath() {
  const std::string id = mesh::paths::ProfileInstanceId();
  std::string path = mesh::paths::EnsureAppDataDir() + "/gui";
  if (!id.empty()) {
    path += "." + id;
  }
  path += ".lock";
  return path;
}

bool TryAcquireGuiLock() {
  const std::string path = GuiLockPath();
  g_gui_lock_fd = ::open(path.c_str(), O_CREAT | O_RDWR, 0644);
  if (g_gui_lock_fd < 0) {
    return false;
  }
  if (::flock(g_gui_lock_fd, LOCK_EX | LOCK_NB) != 0) {
    ::close(g_gui_lock_fd);
    g_gui_lock_fd = -1;
    return false;
  }
  return true;
}

void ReleaseGuiLock() {
  if (g_gui_lock_fd >= 0) {
    ::flock(g_gui_lock_fd, LOCK_UN);
    ::close(g_gui_lock_fd);
    g_gui_lock_fd = -1;
  }
}

int RunMain(int argc, char* argv[]) {
  ::signal(SIGPIPE, SIG_IGN);
  XInitThreads();

  CefMainArgs main_args(argc, argv);
  CefRefPtr<mesh::MeshApp> app(new mesh::MeshApp);

  const int exit_code = CefExecuteProcess(main_args, app.get(), nullptr);
  if (exit_code >= 0) {
    return exit_code;
  }

  CefRefPtr<CefCommandLine> command_line = CefCommandLine::CreateCommandLine();
  command_line->InitFromArgv(argc, argv);
  const int mcp_port = ParseMcpPort(command_line);
  const bool mcp_stdio = IsTruthySwitch(command_line, "mcp") ||
                         IsTruthySwitch(command_line, "mcp-stdio");

  if (mcp_stdio) {
    mesh::Log("MCP stdio host starting");
    return mesh::McpServer::RunStdioHost(mcp_port);
  }

  ApplyProfileInstanceFromCommandLine(command_line);

  if (!TryAcquireGuiLock()) {
    mesh::Log("MeshBrowser GUI already running — not starting a second instance");
    return 0;
  }

  mesh::Log("Main browser process initializing");

  // Move the profile of the previous product into the current layout before
  // anything reads or writes user data.
  mesh::paths::MigrateLegacyProfileIfNeeded();

  // The engine owns the CEF settings policy; the product only supplies the
  // facts about this run.
  engine::EngineRuntime runtime;
  runtime.cache_root = mesh::paths::EnsureCacheRootDir();
  runtime.log_file = runtime.cache_root + "/cef.log";
  runtime.private_mode = mesh::paths::IsPrivateMode();
  runtime.sandbox_enabled = false;

  CefSettings settings =
      engine::BuildEngineSettings(engine::PlanEngineSettings(runtime));
  settings.log_severity = LOGSEVERITY_WARNING;

  if (!CefInitialize(main_args, settings, app.get(), nullptr)) {
    mesh::Log("CefInitialize failed");
    ReleaseGuiLock();
    return 1;
  }

  mesh::Log("CefInitialize succeeded. Entering message loop.");
  CefRunMessageLoop();
  mesh::Log("CefRunMessageLoop finished. Calling CefShutdown.");
  CefShutdown();
  mesh::paths::WipePrivateProfile();
  ReleaseGuiLock();
  mesh::Log("CefShutdown finished. Exiting main process.");
  return 0;
}

}  // namespace

int main(int argc, char* argv[]) {
  return RunMain(argc, argv);
}
