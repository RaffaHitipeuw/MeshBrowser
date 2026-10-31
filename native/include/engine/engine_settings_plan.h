#pragma once

#include <string>

#include "engine/engine_runtime.h"

namespace engine {

/**
 * The CEF settings the engine will apply, expressed without any CEF types.
 *
 * Keeping the policy in a CEF-free struct makes it unit-testable without
 * linking Chromium, and keeps the decision of *what* the engine configures
 * separate from *how* CEF is configured.
 */
struct EngineSettingsPlan {
  std::string root_cache_path;
  std::string cache_path;
  std::string log_file;
  /** Chromium persists session cookies only outside private mode. */
  bool persist_session_cookies = true;
  /**
   * True when the renderer sandbox must be disabled. The engine applies this
   * verbatim; the policy is supplied by the product via EngineRuntime.
   */
  bool no_sandbox = true;
};

/** Derives the engine's CEF settings policy from the resolved runtime. */
EngineSettingsPlan PlanEngineSettings(const EngineRuntime& runtime);

}  // namespace engine
