#pragma once

#include "include/wrapper/cef_message_router.h"
#include "nlohmann/json.hpp"

namespace mesh {

using Json = nlohmann::json;

bool HandleGitCommand(
    const std::string& method,
    const Json& params,
    CefRefPtr<CefMessageRouterBrowserSide::Callback> callback);

}  // namespace mesh
