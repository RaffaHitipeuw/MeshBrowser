#pragma once

#define JSON_NOEXCEPTION 1
#include "mesh/game.h"
#include "nlohmann/json.hpp"

namespace mesh {

using Json = nlohmann::json;

Json GameToJson(const Game& game, bool running);
std::string BasenameStem(const std::string& path);

}  // namespace mesh
