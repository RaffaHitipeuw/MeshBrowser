#include "mesh/api/register_apis.h"

#include "mesh/api/api_dispatcher.h"

namespace mesh {
namespace {

bool g_registered = false;

}  // namespace

void RegisterAllApis() {
  if (g_registered) {
    return;
  }
  g_registered = true;

  // Exact handlers first (adblock, platform), then domain prefixes.
  RegisterPlatformApis();
  RegisterAdblockApis();
  RegisterBrowserApis();
  RegisterWindowApis();
  RegisterLibraryApis();
  RegisterTerminalApis();
  RegisterGitApis();
  RegisterAgentApis();
}

}  // namespace mesh
