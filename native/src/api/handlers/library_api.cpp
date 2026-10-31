#include "mesh/api/register_apis.h"

#include "mesh/api/api_dispatcher.h"
#include "mesh/library_commands.h"

namespace mesh {

void RegisterLibraryApis() {
  ApiDispatcher::Get().RegisterPrefix(
      "library.",
      [](const ApiContext& ctx, const Json& params, ApiResponder& responder) {
        if (!ctx.owner || !ctx.cef_callback) {
          responder.Failure(500, "Library API requires CEF context");
          return;
        }
        if (!HandleLibraryCommand(ctx.owner, ctx.method, params,
                                  ctx.cef_callback)) {
          responder.Failure(404, "Unknown method: " + ctx.method);
        }
      },
      ApiExposure::UiOnly);
}

}  // namespace mesh
