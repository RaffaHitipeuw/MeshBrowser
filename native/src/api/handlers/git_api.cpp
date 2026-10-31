#include "mesh/api/register_apis.h"

#include "mesh/api/api_dispatcher.h"
#include "mesh/git_commands.h"

namespace mesh {

void RegisterGitApis() {
  ApiDispatcher::Get().RegisterPrefix(
      "git.",
      [](const ApiContext& ctx, const Json& params, ApiResponder& responder) {
        if (!ctx.cef_callback) {
          responder.Failure(500, "Git API requires CEF context");
          return;
        }
        if (!HandleGitCommand(ctx.method, params, ctx.cef_callback)) {
          responder.Failure(404, "Unknown method: " + ctx.method);
        }
      },
      ApiExposure::UiOnly);
}

}  // namespace mesh
