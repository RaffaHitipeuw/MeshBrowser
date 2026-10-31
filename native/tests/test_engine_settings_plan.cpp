// The engine's CEF settings policy: the first thing the engine owns that
// can be verified without a browser.

#include "test_harness.h"

#include <string>

#include "engine/engine_settings_plan.h"

using engine::EngineRuntime;
using engine::EngineSettingsPlan;

MESH_TEST(PlanEngineSettings_MapsTheRuntimeOntoThePlan) {
  EngineRuntime runtime;
  runtime.cache_root = "/tmp/mesh-profile";
  runtime.log_file = "/tmp/mesh-profile/cef.log";
  runtime.private_mode = false;
  runtime.sandbox_enabled = false;

  const EngineSettingsPlan plan = engine::PlanEngineSettings(runtime);

  MESH_CHECK_EQ(plan.root_cache_path, std::string("/tmp/mesh-profile"));
  MESH_CHECK_EQ(plan.cache_path, std::string("/tmp/mesh-profile"));
  MESH_CHECK_EQ(plan.log_file, std::string("/tmp/mesh-profile/cef.log"));
  MESH_CHECK(plan.persist_session_cookies);
  MESH_CHECK(plan.no_sandbox);
}

MESH_TEST(PlanEngineSettings_PrivateModeDoesNotPersistSessionCookies) {
  EngineRuntime runtime;
  runtime.cache_root = "/tmp/mesh-profile";
  runtime.log_file = "/tmp/mesh-profile/cef.log";
  runtime.private_mode = true;
  runtime.sandbox_enabled = false;

  const EngineSettingsPlan plan = engine::PlanEngineSettings(runtime);

  MESH_CHECK(!plan.persist_session_cookies);
  // Private mode only changes the cookie policy.
  MESH_CHECK_EQ(plan.root_cache_path, std::string("/tmp/mesh-profile"));
  MESH_CHECK(plan.no_sandbox);
}

MESH_TEST(PlanEngineSettings_SandboxEnabledTurnsNoSandboxOff) {
  EngineRuntime runtime;
  runtime.cache_root = "/tmp/mesh-profile";
  runtime.log_file = "/tmp/mesh-profile/cef.log";
  runtime.private_mode = false;
  runtime.sandbox_enabled = true;

  const EngineSettingsPlan plan = engine::PlanEngineSettings(runtime);

  MESH_CHECK(!plan.no_sandbox);
  MESH_CHECK(plan.persist_session_cookies);
}

MESH_TEST(PlanEngineSettings_DoesNotDeriveTheLogFile) {
  // The log file is a fact about the run, not a policy: the engine must not
  // invent a path of its own.
  EngineRuntime runtime;
  runtime.cache_root = "/tmp/mesh-profile";
  runtime.log_file = "";
  runtime.private_mode = false;
  runtime.sandbox_enabled = false;

  const EngineSettingsPlan plan = engine::PlanEngineSettings(runtime);

  MESH_CHECK_EQ(plan.log_file, std::string(""));
}
