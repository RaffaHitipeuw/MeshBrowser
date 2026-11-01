#include "mesh/mesh_app.h"

#include <cstdlib>
#include <cstdint>
#include <iomanip>
#include <sstream>
#include <string>

#include "include/cef_browser.h"
#include "include/cef_v8.h"
#include "include/cef_command_line.h"
#include "engine/engine_client.h"
#include "mesh/adblock_service.h"
#include "mesh/dev_mode.h"
#include "mesh/mcp/mcp_server.h"
#include "mesh/mesh_handler.h"
#include "mesh/paths.h"

namespace mesh {

namespace {

std::string FingerprintProfileSeed() {
  // Stable FNV-1a over the native profile root and selected instance.
  // The seed is deliberately not a machine-wide random value: profiles
  // remain stable across launches while separate instances diverge.
  const std::string material =
      paths::AppDataDir() + "|" + paths::ProfileInstanceId() +
      (paths::IsPrivateMode() ? "|private" : "|regular");
  uint64_t hash = 14695981039346656037ull;
  for (unsigned char ch : material) {
    hash ^= static_cast<uint64_t>(ch);
    hash *= 1099511628211ull;
  }
  std::ostringstream out;
  out << std::hex << std::setfill('0') << std::setw(16) << hash;
  return out.str();
}

std::string FingerprintBootstrapScript(const std::string& seed) {
  // This script is evaluated by CEF from OnContextCreated, before page
  // scripts execute. All perturbations are deterministic for this profile.
  std::string script = R"JS((() => {
    'use strict';
    const seedText = '__MESH_PROFILE_SEED__';
    let state = 0x811c9dc5;
    for (let i = 0; i < seedText.length; ++i) {
      state ^= seedText.charCodeAt(i);
      state = Math.imul(state, 0x01000193) >>> 0;
    }
    const initial = state >>> 0;
    const mix = (n) => {
      let x = (initial ^ Math.imul((n + 1) >>> 0, 0x9e3779b1)) >>> 0;
      x ^= x >>> 16; x = Math.imul(x, 0x7feb352d) >>> 0;
      x ^= x >>> 15; x = Math.imul(x, 0x846ca68b) >>> 0;
      return (x ^ (x >>> 16)) >>> 0;
    };
    const hardwareValues = [4, 6, 8, 12];
    const hardware = hardwareValues[mix(1) % hardwareValues.length];
    try {
      Object.defineProperty(Navigator.prototype, 'hardwareConcurrency', {
        configurable: true, get: () => hardware
      });
    } catch (_) {}

    // Canvas readback/export receives a tiny, repeatable RGB perturbation.
    // The source canvas is not changed by getImageData().
    const patchedImages = new WeakSet();
    const originalGetImageData =
      CanvasRenderingContext2D.prototype.getImageData;
    CanvasRenderingContext2D.prototype.getImageData = function(...args) {
      const image = originalGetImageData.apply(this, args);
      const data = image.data;
      const offset = mix(2) & 255;
      for (let i = 0; i < data.length; i += 4) {
        const delta = (mix((i >>> 2) + offset) & 1) ? 1 : -1;
        data[i] = Math.max(0, Math.min(255, data[i] + delta));
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1] - delta));
      }
      return image;
    };

    const patchCanvasForExport = (canvas) => {
      if (!canvas || patchedImages.has(canvas)) return;
      try {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = image.data;
        for (let i = 0; i < data.length; i += 4) {
          const delta = (mix((i >>> 2) + 3) & 1) ? 1 : -1;
          data[i] = Math.max(0, Math.min(255, data[i] + delta));
          data[i + 2] = Math.max(0, Math.min(255, data[i + 2] - delta));
        }
        ctx.putImageData(image, 0, 0);
        patchedImages.add(canvas);
      } catch (_) {}
    };
    const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function(...args) {
      patchCanvasForExport(this);
      return originalToDataURL.apply(this, args);
    };
    const originalToBlob = HTMLCanvasElement.prototype.toBlob;
    if (originalToBlob) {
      HTMLCanvasElement.prototype.toBlob = function(...args) {
        patchCanvasForExport(this);
        return originalToBlob.apply(this, args);
      };
    }

    // Audio samples receive deterministic, sub-quantization-scale noise.
    const audioPatched = new WeakSet();
    const originalGetChannelData = AudioBuffer.prototype.getChannelData;
    AudioBuffer.prototype.getChannelData = function(channel) {
      const samples = originalGetChannelData.call(this, channel);
      if (!audioPatched.has(samples)) {
        const channelOffset = (channel >>> 0) * 65537;
        for (let i = 0; i < samples.length; ++i) {
          const noise = ((mix(i + channelOffset + 7) & 65535) / 65535 - 0.5)
                        * 1.0e-7;
          samples[i] += noise;
        }
        audioPatched.add(samples);
      }
      return samples;
    };
  })();
)JS";
  const std::string placeholder = "__MESH_PROFILE_SEED__";
  const size_t at = script.find(placeholder);
  if (at != std::string::npos) {
    script.replace(at, placeholder.size(), seed);
  }
  return script;
}

}  // namespace


void MeshApp::OnBeforeCommandLineProcessing(
    const CefString& process_type,
    CefRefPtr<CefCommandLine> command_line) {
  engine::EngineApp::OnBeforeCommandLineProcessing(process_type, command_line);
  // CEF forwards browser-process switches to renderer subprocesses.
  if (process_type.empty() && command_line &&
      !command_line->HasSwitch("mesh-profile-id")) {
    command_line->AppendSwitchWithValue("mesh-profile-id",
                                        FingerprintProfileSeed());
  }
  if (IsDevMode()) {
    command_line->AppendSwitchWithValue("disable-features", "IsolateOrigins");
  }
}

void MeshApp::OnContextCreated(CefRefPtr<CefBrowser> browser,
                               CefRefPtr<CefFrame> frame,
                               CefRefPtr<CefV8Context> context) {
  engine::EngineApp::OnContextCreated(browser, frame, context);
  if (!frame || !frame->IsValid() || !context) {
    return;
  }

  CefRefPtr<CefCommandLine> command_line =
      CefCommandLine::GetGlobalCommandLine();
  std::string seed = "mesh-default-profile";
  if (command_line && command_line->HasSwitch("mesh-profile-id")) {
    seed = command_line->GetSwitchValue("mesh-profile-id").ToString();
  }
  CefRefPtr<CefV8Value> retval;
  CefRefPtr<CefV8Exception> exception;
  context->Eval(FingerprintBootstrapScript(seed),
                "mesh://fingerprint/bootstrap.js", 1, retval, exception);
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
