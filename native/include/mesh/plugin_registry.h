#pragma once

#include "nlohmann/json.hpp"

namespace mesh::plugins {

nlohmann::json ListInstalled();
bool SetEnabled(const std::string& id, bool enabled);

}  // namespace mesh::plugins
