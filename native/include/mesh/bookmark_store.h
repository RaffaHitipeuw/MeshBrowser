#pragma once

#include <string>

#include "nlohmann/json.hpp"

namespace mesh::bookmarks {

constexpr size_t kMaxEntries = 500;

nlohmann::json List();
nlohmann::json Record(const std::string& url,
                      const std::string& title,
                      int64_t ts);
bool Remove(const std::string& url);
void Clear();
nlohmann::json Import(const nlohmann::json& entries);

}  // namespace mesh::bookmarks
