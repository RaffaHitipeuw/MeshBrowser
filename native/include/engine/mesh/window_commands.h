#pragma once

#include <string>

#include "include/cef_browser.h"
#include "include/wrapper/cef_message_router.h"
#include "mesh/library_json.h"

namespace mesh {

bool HandleWindowCommand(
    CefRefPtr<CefBrowser> browser,
    const std::string& method,
    const Json& params,
    CefRefPtr<CefMessageRouterBrowserSide::Callback> callback);

}  // namespace mesh
