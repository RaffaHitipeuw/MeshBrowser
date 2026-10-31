#pragma once

#include "include/cef_app.h"
#include "engine/engine_runtime.h"
#include "engine/engine_settings_plan.h"

namespace engine {

/**
 * Applies the engine settings policy to a CefSettings instance.
 *
 * This is the only place in the engine that knows the CEF settings type; the
 * policy itself lives in engine_settings_plan.h and is CEF-free.
 */
CefSettings BuildEngineSettings(const EngineSettingsPlan& plan);

}  // namespace engine
