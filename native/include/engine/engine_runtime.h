#pragma once

#include <string>

namespace engine {

/**
 * Facts about the running browser process that the engine needs in order to
 * configure CEF, resolved by the product layer before CefInitialize.
 *
 * This type deliberately contains no product types: it is the hand-off point
 * between "which product is this" and "how do we start a CEF host".
 *
 * Paths are UTF-8: the portable currency between the product's path helpers
 * and CefString::FromString().
 */
struct EngineRuntime {
  /** Root directory for the Chromium profile cache. */
  std::string cache_root;
  /** Absolute path of the CEF log file. */
  std::string log_file;
  /** Private/incognito mode: session cookies must not be persisted. */
  bool private_mode = false;
  /**
   * Whether the CEF sandbox is enabled. The engine honours this; it never
   * decides the policy itself.
   */
  bool sandbox_enabled = false;
};

}  // namespace engine
