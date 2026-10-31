#pragma once

// The engine speaks JSON on its RPC boundary. This is the vendored
// nlohmann/json 3.11.3 (MIT, SPDX headers retained in the file).
//
// The header lives under "third_party/nlohmann/" so that the engine layer
// has no dependency on any product-named directory.

#define JSON_NOEXCEPTION 1
#include "nlohmann/json.hpp"

namespace engine {

using Json = nlohmann::json;

}  // namespace engine
