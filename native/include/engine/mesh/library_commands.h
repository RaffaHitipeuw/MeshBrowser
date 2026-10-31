#pragma once

#include <string>

#include "include/wrapper/cef_message_router.h"
#include "mesh/library_json.h"

namespace mesh {

class MeshHandler;

// Dispatches one library.* RPC. Returns true if handled.
bool HandleLibraryCommand(
    MeshHandler* owner,
    const std::string& method,
    const Json& params,
    CefRefPtr<CefMessageRouterBrowserSide::Callback> callback);

}  // namespace mesh
