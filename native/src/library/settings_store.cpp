#include "mesh/settings_store.h"

#include <fstream>
#include <filesystem>

#include "mesh/paths.h"
#include "mesh/profile/legacy_migration.h"
#include "mesh/utf8.h"

namespace mesh::settings {
namespace {

using Json = nlohmann::json;

/** The key a setting had in the previous product ("" when it has none). */
std::string LegacyKey(const std::string& key) {
  return profile::LegacySettingsKey(key);
}

Json LoadRaw() {
  const std::filesystem::path path(utf8::Widen(paths::SettingsPath()));
  std::ifstream in(path, std::ios::binary);
  if (!in) {
    return Json::object();
  }
  std::string data((std::istreambuf_iterator<char>(in)),
                   std::istreambuf_iterator<char>());
  if (data.empty()) {
    return Json::object();
  }
  Json parsed = Json::parse(data, nullptr, false);
  if (!parsed.is_object()) {
    return Json::object();
  }
  return parsed;
}

void SaveRaw(const Json& root) {
  if (!root.is_object()) {
    return;
  }
  paths::EnsureAppDataDir();
  const std::filesystem::path path(utf8::Widen(paths::SettingsPath()));
  std::ofstream out(path, std::ios::binary | std::ios::trunc);
  if (!out) {
    return;
  }
  out << root.dump();
}

}  // namespace

Json GetAll() {
  Json root = LoadRaw();
  // Settings that were written under the name of the previous product are
  // reported under their current name, so that the user keeps them.
  for (auto it = root.begin(); it != root.end(); ++it) {
    const std::string current = LegacyKey(it.key());
    if (current.empty() || root.contains(current)) {
      continue;
    }
    root[current] = it.value();
  }
  return root;
}

Json Get(const std::string& key) {
  if (key.empty()) {
    return GetAll();
  }
  Json root = LoadRaw();
  if (root.contains(key)) {
    return root[key];
  }
  const std::string legacy = LegacyKey(key);
  if (!legacy.empty() && root.contains(legacy)) {
    return root[legacy];
  }
  return Json();
}

bool Set(const std::string& key, const Json& value) {
  if (key.empty()) {
    return false;
  }
  Json root = LoadRaw();
  root[key] = value;
  // The legacy name is dropped once the current one holds the value.
  const std::string legacy = LegacyKey(key);
  if (!legacy.empty() && root.contains(legacy)) {
    root.erase(legacy);
  }
  SaveRaw(root);
  return true;
}

bool SetMany(const Json& values) {
  if (!values.is_object()) {
    return false;
  }
  Json root = LoadRaw();
  for (auto it = values.begin(); it != values.end(); ++it) {
    root[it.key()] = it.value();
  }
  SaveRaw(root);
  return true;
}

}  // namespace mesh::settings
