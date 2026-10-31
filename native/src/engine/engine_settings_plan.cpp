#include "engine/engine_settings_plan.h"

namespace engine {

EngineSettingsPlan PlanEngineSettings(const EngineRuntime& runtime) {
  EngineSettingsPlan plan;
  plan.root_cache_path = runtime.cache_root;
  plan.cache_path = runtime.cache_root;
  plan.log_file = runtime.log_file;
  plan.persist_session_cookies = !runtime.private_mode;
  plan.no_sandbox = !runtime.sandbox_enabled;
  return plan;
}

}  // namespace engine
