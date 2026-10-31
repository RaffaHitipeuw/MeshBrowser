#include "engine/engine_settings.h"

namespace engine {

CefSettings BuildEngineSettings(const EngineSettingsPlan& plan) {
  CefSettings settings;
  settings.no_sandbox = plan.no_sandbox;
  CefString(&settings.root_cache_path).FromString(plan.root_cache_path);
  CefString(&settings.cache_path).FromString(plan.cache_path);
  CefString(&settings.log_file).FromString(plan.log_file);
  settings.persist_session_cookies = plan.persist_session_cookies;
  return settings;
}

}  // namespace engine
