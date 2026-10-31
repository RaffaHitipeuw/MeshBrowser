#pragma once

#include <string>

#include "include/wrapper/cef_message_router.h"
#include "mesh/library_json.h"

namespace mesh {

class MeshHandler;

bool HandleTerminalCommand(
    MeshHandler* owner,
    int64_t query_id,
    bool persistent,
    const std::string& method,
    const Json& params,
    CefRefPtr<CefMessageRouterBrowserSide::Callback> callback);

}  // namespace mesh
