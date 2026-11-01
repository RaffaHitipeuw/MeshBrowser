// The migration of a profile from the previous product layout.

#include "test_harness.h"

#include <filesystem>
#include <fstream>
#include <string>

#include "mesh/profile/legacy_migration.h"
#include "mesh/profile/profile_paths.h"

namespace {

namespace fs = std::filesystem;

/** A unique empty directory below the system temp directory. */
fs::path MakeTempDir(const std::string& name) {
  const fs::path base =
      fs::temp_directory_path() / ("mesh-migration-test-" + name);
  std::error_code ec;
  fs::remove_all(base, ec);
  fs::create_directories(base, ec);
  return base;
}

void WriteFile(const fs::path& path, const std::string& content) {
  std::error_code ec;
  fs::create_directories(path.parent_path(), ec);
  std::ofstream out(path, std::ios::binary);
  out << content;
}

std::string ReadFile(const fs::path& path) {
  std::ifstream in(path, std::ios::binary);
  return std::string((std::istreambuf_iterator<char>(in)),
                     std::istreambuf_iterator<char>());
}

bool Contains(const std::vector<std::string>& items, const std::string& value) {
  for (const std::string& item : items) {
    if (item == value) {
      return true;
    }
  }
  return false;
}

}  // namespace

MESH_TEST(MigrateLegacyProfile_WithoutALegacyProfileItDoesNothing) {
  const fs::path root = MakeTempDir("empty");
  const mesh::profile::ProfilePaths current(root.string());
  const mesh::profile::MigrationResult result =
      mesh::profile::MigrateLegacyProfile(current,
                                          (root / "legacy").string());
  MESH_CHECK(!result.legacy_profile_found);
  MESH_CHECK(!result.migrated);
  MESH_CHECK(result.error.empty());
}

MESH_TEST(MigrateLegacyProfile_MovesTheUserData) {
  const fs::path root = MakeTempDir("moves");
  const fs::path legacy = root / "legacy";
  WriteFile(legacy / "settings.json", "{\"theme\":\"dark\"}");
  WriteFile(legacy / "visit_history.json", "[{\"url\":\"https://a\"}]");
  WriteFile(legacy / "bookmarks.json", "[]");
  WriteFile(legacy / "library.db", "sqlite");

  const mesh::profile::ProfilePaths current((root / "current").string());
  const mesh::profile::MigrationResult result =
      mesh::profile::MigrateLegacyProfile(current, legacy.string());

  MESH_CHECK(result.legacy_profile_found);
  MESH_CHECK(result.migrated);
  MESH_CHECK_EQ(ReadFile(current.SettingsFile()), std::string("{\"theme\":\"dark\"}"));
  MESH_CHECK_EQ(ReadFile(current.HistoryFile()),
                std::string("[{\"url\":\"https://a\"}]"));
  MESH_CHECK_EQ(ReadFile(current.DatabaseFile()), std::string("sqlite"));
}

MESH_TEST(MigrateLegacyProfile_NeverOverwritesExistingData) {
  const fs::path root = MakeTempDir("keeps");
  const fs::path legacy = root / "legacy";
  WriteFile(legacy / "settings.json", "legacy");

  const mesh::profile::ProfilePaths current((root / "current").string());
  WriteFile(fs::path(current.SettingsFile()), "current");

  const mesh::profile::MigrationResult result =
      mesh::profile::MigrateLegacyProfile(current, legacy.string());

  MESH_CHECK(result.legacy_profile_found);
  MESH_CHECK(!result.migrated);
  MESH_CHECK(Contains(result.skipped_files, "settings.json"));
  MESH_CHECK_EQ(ReadFile(current.SettingsFile()), std::string("current"));
}

MESH_TEST(MigrateLegacyProfile_IsIdempotent) {
  const fs::path root = MakeTempDir("idempotent");
  const fs::path legacy = root / "legacy";
  WriteFile(legacy / "settings.json", "legacy");

  const mesh::profile::ProfilePaths current((root / "current").string());
  const mesh::profile::MigrationResult first =
      mesh::profile::MigrateLegacyProfile(current, legacy.string());
  MESH_CHECK(first.migrated);

  const mesh::profile::MigrationResult second =
      mesh::profile::MigrateLegacyProfile(current, legacy.string());
  MESH_CHECK(!second.migrated);
  MESH_CHECK_EQ(ReadFile(current.SettingsFile()), std::string("legacy"));
}

MESH_TEST(MigrateLegacyProfile_CopiesTheCacheDirectory) {
  const fs::path root = MakeTempDir("cache");
  const fs::path legacy = root / "legacy";
  WriteFile(legacy / "cef" / "Default" / "Cookies", "cookies");

  const mesh::profile::ProfilePaths current((root / "current").string());
  const mesh::profile::MigrationResult result =
      mesh::profile::MigrateLegacyProfile(current, legacy.string());

  MESH_CHECK(result.migrated);
  const fs::path cookies =
      fs::path(current.CacheRoot("")) / "Default" / "Cookies";
  MESH_CHECK(fs::exists(cookies));
  MESH_CHECK_EQ(ReadFile(cookies), std::string("cookies"));
}

MESH_TEST(MigrateLegacyProfile_CopiesTheInstanceProfiles) {
  const fs::path root = MakeTempDir("instances");
  const fs::path legacy = root / "legacy";
  WriteFile(legacy / "instances" / "abc" / "cef" / "Cookies", "cookies");

  const mesh::profile::ProfilePaths current((root / "current").string());
  mesh::profile::MigrateLegacyProfile(current, legacy.string());

  const fs::path cookies =
      fs::path(current.CacheRoot("abc")) / "Cookies";
  MESH_CHECK(fs::exists(cookies));
}

MESH_TEST(MigrateLegacyProfile_LeavesTheLegacyProfileAlone) {
  const fs::path root = MakeTempDir("readonly");
  const fs::path legacy = root / "legacy";
  WriteFile(legacy / "settings.json", "legacy");

  const mesh::profile::ProfilePaths current((root / "current").string());
  mesh::profile::MigrateLegacyProfile(current, legacy.string());

  MESH_CHECK_EQ(ReadFile(legacy / "settings.json"), std::string("legacy"));
}

MESH_TEST(LegacySettingsKey_MapsTheOldNames) {
  MESH_CHECK_EQ(mesh::profile::LegacySettingsKey("mesh.searchEngine"),
                std::string("mesh.searchEngine"));
  MESH_CHECK_EQ(mesh::profile::LegacySettingsKey("mesh.appearance"),
                std::string("mesh.appearance"));
}

MESH_TEST(LegacySettingsKey_LeavesOtherKeysAlone) {
  MESH_CHECK_EQ(mesh::profile::LegacySettingsKey("appearance"),
                std::string(""));
  MESH_CHECK_EQ(mesh::profile::LegacySettingsKey(""), std::string(""));
}

MESH_TEST(MigrateLegacyProfile_RunsOnceAndRecordsIt) {
  const fs::path root = MakeTempDir("marker");
  const fs::path legacy = root / "legacy";
  WriteFile(legacy / "settings.json", "legacy");

  const mesh::profile::ProfilePaths current((root / "current").string());
  const mesh::profile::MigrationResult first =
      mesh::profile::MigrateLegacyProfile(current, legacy.string());
  MESH_CHECK(first.migrated);
  MESH_CHECK(fs::exists(fs::path(current.root()) /
                         mesh::profile::kMigrationMarkerFile));

  const mesh::profile::MigrationResult second =
      mesh::profile::MigrateLegacyProfile(current, legacy.string());
  MESH_CHECK(!second.migrated);
  MESH_CHECK(Contains(second.skipped_files,
                       mesh::profile::kMigrationMarkerFile));
}

MESH_TEST(MigrateLegacyProfile_KeepsALiveDirectory) {
  const fs::path root = MakeTempDir("livedir");
  const fs::path legacy = root / "legacy";
  WriteFile(legacy / "cef" / "Cookies", "old");
  const mesh::profile::ProfilePaths current((root / "current").string());
  WriteFile(fs::path(current.CacheRoot("")) / "Cookies", "new");

  const mesh::profile::MigrationResult result =
      mesh::profile::MigrateLegacyProfile(current, legacy.string());
  MESH_CHECK(!result.migrated);
  MESH_CHECK_EQ(ReadFile(fs::path(current.CacheRoot("")) / "Cookies"),
                std::string("new"));
}
