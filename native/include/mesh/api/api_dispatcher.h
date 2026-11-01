#pragma once

#include <cstdint>
#include <functional>
#include <memory>
#include <string>
#include <string_view>
#include <unordered_map>
#include <vector>

#include "include/cef_browser.h"
#include "include/wrapper/cef_message_router.h"
#include "engine/engine_method_router.h"
#include "mesh/library_json.h"

namespace mesh {

class MeshHandler;

/** How a method may be exposed beyond the CEF shell (future HTTP/Cloudflare). */
enum class ApiExposure : uint8_t {
  UiOnly = 0,
  RemoteSafe = 1,
};

class ApiResponder;

struct ApiContext {
  MeshHandler* owner = nullptr;
  CefRefPtr<CefBrowser> browser;
  CefRefPtr<CefFrame> frame;
  /** Full RPC method name (e.g. browser.navigate). */
  std::string method;
  int64_t query_id = 0;
  bool persistent = false;
  /** Set by CEF transport so legacy Handle*Command helpers can respond. */
  CefRefPtr<CefMessageRouterBrowserSide::Callback> cef_callback;
  /** Heap responder for async MCP tools (page.eval). Must outlive the JS reply. */
  std::shared_ptr<ApiResponder> shared_responder;
};

class ApiResponder {
 public:
  virtual ~ApiResponder() = default;
  virtual void Success(const std::string& json) = 0;
  virtual void Failure(int code, const std::string& message) = 0;
};

/** CEF cefQuery callback adapter. */
class CefApiResponder final : public ApiResponder {
 public:
  explicit CefApiResponder(
      CefRefPtr<CefMessageRouterBrowserSide::Callback> callback)
      : callback_(std::move(callback)) {}

  void Success(const std::string& json) override {
    if (callback_) {
      callback_->Success(json);
    }
  }

  void Failure(int code, const std::string& message) override {
    if (callback_) {
      callback_->Failure(code, message);
    }
  }

 private:
  CefRefPtr<CefMessageRouterBrowserSide::Callback> callback_;
};

using ApiHandler =
    std::function<void(const ApiContext& ctx, const Json& params,
                       ApiResponder& responder)>;

/**
 * Central method → handler registry. Transports (cefQuery today; HTTP later)
 * build ApiContext and call Dispatch.
 *
 * The routing *rule* (exact method name wins, otherwise the longest
 * registered prefix wins) is engine-owned and lives in
 * engine::MethodRouter; the product owns the routes themselves.
 */
class ApiDispatcher {
 public:
  static ApiDispatcher& Get();

  void Register(std::string_view method,
                ApiHandler handler,
                ApiExposure exposure = ApiExposure::UiOnly);

  /** Domain fallback: first matching prefix wins (longest match preferred). */
  void RegisterPrefix(std::string_view prefix,
                      ApiHandler handler,
                      ApiExposure exposure = ApiExposure::UiOnly);

  bool Dispatch(std::string_view method,
                const ApiContext& ctx,
                const Json& params,
                ApiResponder& responder) const;

  /** Catalog of exact methods and prefix wildcards for api.list. */
  nlohmann::json ListCatalog() const;

 private:
  ApiDispatcher() = default;

  struct Entry {
    ApiHandler handler;
    ApiExposure exposure = ApiExposure::UiOnly;
  };

  engine::MethodRouter<Entry> router_;
};

void RegisterAllApis();

}  // namespace mesh
