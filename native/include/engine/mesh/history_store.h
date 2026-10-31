#pragma once

#include <string>

#include "nlohmann/json.hpp"

namespace mesh::history {

constexpr size_t kMaxEntries = 500;

nlohmann::json List();
nlohmann::json Record(const std::string& url,
                      const std::string& title,
                      int64_t ts);
bool Remove(const std::string& url);
void Clear();
// Merge shell localStorage visits into the native store (upsert by URL).
nlohmann::json Import(const nlohmann::json& entries);

}  // namespace mesh::history
