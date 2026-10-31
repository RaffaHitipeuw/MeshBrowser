#include "mesh/api/register_apis.h"

#include "mesh/api/api_dispatcher.h"
#include "mesh/terminal_commands.h"

namespace mesh {

void RegisterTerminalApis() {
  ApiDispatcher::Get().RegisterPrefix(
      "terminal.",
      [](const ApiContext& ctx, const Json& params, ApiResponder& responder) {
        if (!ctx.owner || !ctx.cef_callback) {
          responder.Failure(500, "Terminal API requires CEF context");
          return;
        }
        if (!HandleTerminalCommand(ctx.owner, ctx.query_id, ctx.persistent,
                                   ctx.method, params, ctx.cef_callback)) {
          responder.Failure(404, "Unknown method: " + ctx.method);
        }
      },
      ApiExposure::UiOnly);
}

}  // namespace mesh
