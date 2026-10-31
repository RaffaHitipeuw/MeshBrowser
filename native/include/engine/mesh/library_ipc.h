#pragma once

#include "include/wrapper/cef_message_router.h"

namespace mesh {

class MeshHandler;

// Handles cefQuery JSON RPC for the game library.
CefMessageRouterBrowserSide::Handler* CreateLibraryIpcHandler(
    MeshHandler* handler);

}  // namespace mesh
