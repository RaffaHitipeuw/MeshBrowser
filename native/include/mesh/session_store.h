#pragma once

#include <string>

#include "nlohmann/json.hpp"

namespace mesh::session {

nlohmann::json Get();
bool Set(const nlohmann::json& session);
nlohmann::json ListTabs();
nlohmann::json GetTab(const std::string& tab_id);
std::string ActiveTabId();

}  // namespace mesh::session
