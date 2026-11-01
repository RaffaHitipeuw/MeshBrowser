#pragma once

#include "mesh/api/api_dispatcher.h"

namespace mesh {

/** Returns true when the caller may invoke this RPC method. */
bool ApiAccessAllowed(const ApiContext& ctx);

/** Content browser loading a bundled ui/ page (history.html, etc.). */
bool IsTrustedUiContentBrowser(MeshHandler* owner,
                               CefRefPtr<CefBrowser> browser);

/** Content browser showing the bundled settings.html page. */
bool IsTrustedSettingsContentBrowser(MeshHandler* owner,
                                     CefRefPtr<CefBrowser> browser);

}  // namespace mesh
