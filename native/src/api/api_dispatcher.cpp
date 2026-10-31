#include "mesh/api/api_dispatcher.h"

#include <algorithm>

namespace mesh {

ApiDispatcher& ApiDispatcher::Get() {
  static ApiDispatcher instance;
  return instance;
}

void ApiDispatcher::Register(std::string_view method,
                             ApiHandler handler,
                             ApiExposure exposure) {
  router_.RegisterExact(std::string(method),
                        Entry{std::move(handler), exposure});
}

void ApiDispatcher::RegisterPrefix(std::string_view prefix,
                                   ApiHandler handler,
                                   ApiExposure exposure) {
  router_.RegisterPrefix(std::string(prefix),
                         Entry{std::move(handler), exposure});
}

bool ApiDispatcher::Dispatch(std::string_view method,
                             const ApiContext& ctx,
                             const Json& params,
                             ApiResponder& responder) const {
  // The engine owns the routing rule; the product owns the routes.
  const Entry* route = router_.Match(method);
  if (!route) {
    return false;
  }
  route->handler(ctx, params, responder);
  return true;
}

nlohmann::json ApiDispatcher::ListCatalog() const {
  Json catalog = Json::array();
  for (const auto& entry : router_.exact_routes()) {
    catalog.push_back(
        Json{{"method", entry.first},
             {"exposure",
              entry.second.exposure == ApiExposure::RemoteSafe ? "remote"
                                                               : "ui"}});
  }
  for (const auto& entry : router_.prefix_routes()) {
    catalog.push_back(
        Json{{"method", entry.first + "*"},
             {"exposure",
              entry.second.exposure == ApiExposure::RemoteSafe ? "remote"
                                                               : "ui"}});
  }
  std::sort(catalog.begin(), catalog.end(),
            [](const Json& a, const Json& b) {
              return a.value("method", std::string()) <
                     b.value("method", std::string());
            });
  return catalog;
}

}  // namespace mesh
