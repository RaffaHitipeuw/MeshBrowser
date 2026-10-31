#include <windows.h>

#include <string>

#include "include/cef_command_line.h"
#include "include/cef_sandbox_win.h"
#include "mesh/log.h"
#include "mesh/mcp/mcp_server.h"
#include "mesh/mesh_app.h"
#include "mesh/paths.h"
#include "mesh/profile/launch_options.h"
#include "engine/engine_settings.h"
#include "mesh/utf8.h"

#include <cstdlib>

namespace {

bool IsFatalException(DWORD code) {
  switch (code) {
    case EXCEPTION_ACCESS_VIOLATION:
    case EXCEPTION_STACK_OVERFLOW:
    case EXCEPTION_ILLEGAL_INSTRUCTION:
    case EXCEPTION_PRIV_INSTRUCTION:
    case EXCEPTION_IN_PAGE_ERROR:
    case EXCEPTION_ARRAY_BOUNDS_EXCEEDED:
    case EXCEPTION_INT_DIVIDE_BY_ZERO:
    case EXCEPTION_NONCONTINUABLE_EXCEPTION:
    case EXCEPTION_BREAKPOINT:          // CEF CHECK / DebugBreak (0x80000003)
    case 0xC0000374:                    // STATUS_HEAP_CORRUPTION
    case 0xC0000409:                    // STATUS_STACK_BUFFER_OVERRUN / failfast
      return true;
    default:
      return false;
  }
}

LONG CALLBACK CrashHandler(EXCEPTION_POINTERS* ExceptionInfo) {
  const DWORD code = ExceptionInfo->ExceptionRecord->ExceptionCode;
  if (!IsFatalException(code)) {
    return EXCEPTION_CONTINUE_SEARCH;
  }
  char buf[512];
  std::snprintf(
      buf, sizeof(buf),
      "FATAL CRASH: ExceptionCode=0x%08X at Address=%p, Flags=0x%X",
      code, ExceptionInfo->ExceptionRecord->ExceptionAddress,
      ExceptionInfo->ExceptionRecord->ExceptionFlags);
  mesh::LogCrash(buf);
  return EXCEPTION_CONTINUE_SEARCH;
}

void ApplyProfileInstanceFromCommandLine() {
  CefRefPtr<CefCommandLine> command_line = CefCommandLine::CreateCommandLine();
  command_line->InitFromString(::GetCommandLineW());
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
        "p" + std::to_string(GetTickCount64()) + "x" +
        std::to_string(GetCurrentProcessId()));
  }
}

std::wstring GuiMutexNameForProfile() {
  const std::string id = mesh::paths::ProfileInstanceId();
  if (id.empty()) {
    return mesh::McpServer::kGuiMutexName;
  }
  return std::wstring(mesh::McpServer::kGuiMutexName) + L"." +
         mesh::utf8::Widen(id);
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

bool WantsMcpStdio(CefRefPtr<CefCommandLine> command_line) {
  return command_line && (command_line->HasSwitch("mcp") ||
                          command_line->HasSwitch("mcp-stdio"));
}

int RunMain(HINSTANCE hInstance, void* sandbox_info) {
  AddVectoredExceptionHandler(1, CrashHandler);
  SetUnhandledExceptionFilter(CrashHandler);

  CefMainArgs main_args(hInstance);
  CefRefPtr<mesh::MeshApp> app(new mesh::MeshApp);

  const int exit_code = CefExecuteProcess(main_args, app.get(), sandbox_info);
  if (exit_code >= 0) {
    return exit_code;
  }

  CefRefPtr<CefCommandLine> command_line = CefCommandLine::CreateCommandLine();
  command_line->InitFromString(::GetCommandLineW());
  const int mcp_port = ParseMcpPort(command_line);
  const bool mcp_stdio = WantsMcpStdio(command_line);

  // Cursor / Claude spawn MeshEngine.exe --mcp. This process is the MCP
  // stdio host only — never CEF — so the agent keeps a stable pipe even
  // if the GUI crashes.
  if (mcp_stdio) {
    mesh::Log("MCP stdio host starting");
    return mesh::McpServer::RunStdioHost(mcp_port);
  }

  // Profile (and therefore the Chromium singleton path) must be known
  // before we take the instance mutex. Private windows get their own
  // cache + mutex so they can coexist with the main GUI.
  ApplyProfileInstanceFromCommandLine();

  const std::wstring mutex_name = GuiMutexNameForProfile();
  HANDLE gui_mutex = CreateMutexW(nullptr, TRUE, mutex_name.c_str());
  const DWORD mutex_err = GetLastError();
  if (gui_mutex && mutex_err == ERROR_ALREADY_EXISTS) {
    mesh::Log("MeshEngine GUI already running — focusing existing window");
    if (mesh::McpServer::FocusExistingGuiWindow()) {
      CloseHandle(gui_mutex);
      return 0;
    }
    mesh::Log("GUI mutex held but no visible window found — cleaning up stale/headless instance");
    CloseHandle(gui_mutex);
    gui_mutex = nullptr;
    mesh::McpServer::TerminateStaleGuiProcesses();
    ::Sleep(300);
    gui_mutex = CreateMutexW(nullptr, TRUE, mutex_name.c_str());
  }

  mesh::Log("Main browser process initializing");

  // Move the profile of the previous product into the current layout before
  // anything reads or writes user data.
  mesh::paths::MigrateLegacyProfileIfNeeded();

  // The engine owns the CEF settings policy; the product only supplies the
  // facts about this run.
  engine::EngineRuntime runtime;
  runtime.cache_root = mesh::paths::EnsureCacheRootDir();
  runtime.log_file = runtime.cache_root + "\\cef.log";
  runtime.private_mode = mesh::paths::IsPrivateMode();
  runtime.sandbox_enabled = false;

  CefSettings settings =
      engine::BuildEngineSettings(engine::PlanEngineSettings(runtime));
  settings.log_severity = LOGSEVERITY_WARNING;

  if (!CefInitialize(main_args, settings, app.get(), sandbox_info)) {
    mesh::Log("CefInitialize failed — focusing already-running instance");
    mesh::McpServer::FocusExistingGuiWindow();
    if (gui_mutex) {
      CloseHandle(gui_mutex);
    }
    return 0;
  }

  mesh::Log("CefInitialize succeeded. Entering message loop.");
  CefRunMessageLoop();
  mesh::Log("CefRunMessageLoop finished. Calling CefShutdown.");
  CefShutdown();
  mesh::paths::WipePrivateProfile();
  if (gui_mutex) {
    ReleaseMutex(gui_mutex);
    CloseHandle(gui_mutex);
    gui_mutex = nullptr;
  }
  mesh::Log("CefShutdown finished. Exiting main process.");
  return 0;
}

}  // namespace

int APIENTRY wWinMain(HINSTANCE hInstance,
                      HINSTANCE hPrevInstance,
                      LPTSTR lpCmdLine,
                      int nCmdShow) {
  UNREFERENCED_PARAMETER(hPrevInstance);
  UNREFERENCED_PARAMETER(lpCmdLine);
  UNREFERENCED_PARAMETER(nCmdShow);

  void* sandbox_info = nullptr;
  return ::RunMain(hInstance, sandbox_info);
}
