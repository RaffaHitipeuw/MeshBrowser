#pragma once

#include "include/cef_request_handler.h"
#include "include/cef_resource_request_handler.h"
#include "include/cef_response_filter.h"

namespace mesh {

class MeshHandler;

/** Content-only network filter via adblock-rust. */
class MeshAdblockResourceHandler : public CefResourceRequestHandler {
 public:
  explicit MeshAdblockResourceHandler(MeshHandler* owner);

  CefResourceRequestHandler::ReturnValue OnBeforeResourceLoad(
      CefRefPtr<CefBrowser> browser,
      CefRefPtr<CefFrame> frame,
      CefRefPtr<CefRequest> request,
      CefRefPtr<CefCallback> callback) override;

  CefRefPtr<CefResponseFilter> GetResourceResponseFilter(
      CefRefPtr<CefBrowser> browser,
      CefRefPtr<CefFrame> frame,
      CefRefPtr<CefRequest> request,
      CefRefPtr<CefResponse> response) override;

 private:
  MeshHandler* owner_;

  IMPLEMENT_REFCOUNTING(MeshAdblockResourceHandler);
};

}  // namespace mesh
