// The profile layout: every file of a profile is derived from its root, and
// the launch options that select a profile instance.

#include "test_harness.h"

#include <string>

#include "mesh/profile/launch_options.h"
#include "mesh/profile/profile_paths.h"
#include "mesh/profile/profile_state.h"

namespace {

/** The last component of a path, whatever the separator is. */
std::string FileName(const std::string& path) {
  const auto slash = path.find_last_of("/\\");
  return slash == std::string::npos ? path : path.substr(slash + 1);
}

/** The path of a file relative to the profile root, with '/' separators. */
std::string Relative(const std::string& root, const std::string& path) {
  if (path.size() <= root.size()) {
    return path;
  }
  std::string relative = path.substr(root.size());
  for (char& c : relative) {
    if (c == '\\') {
      c = '/';
    }
  }
  while (!relative.empty() && relative.front() == '/') {
    relative.erase(relative.begin());
  }
  return relative;
}

}  // namespace

MESH_TEST(ProfilePaths_EveryFileBelongsToTheRoot) {
  const mesh::profile::ProfilePaths paths("root");
  MESH_CHECK_EQ(mesh::profile::ProfilePaths("root").SettingsFile(),
                paths.SettingsFile());
  MESH_CHECK_EQ(FileName(paths.SettingsFile()), std::string("settings.json"));
  MESH_CHECK_EQ(FileName(paths.HistoryFile()),
                std::string("visit_history.json"));
  MESH_CHECK_EQ(FileName(paths.BookmarksFile()),
                std::string("bookmarks.json"));
  MESH_CHECK_EQ(FileName(paths.DownloadsFile()), std::string("downloads.json"));
  MESH_CHECK_EQ(FileName(paths.SessionFile()), std::string("tab_session.json"));
  MESH_CHECK_EQ(FileName(paths.DatabaseFile()), std::string("library.db"));
  MESH_CHECK_EQ(FileName(paths.PendingOpenTabFile()),
                std::string("pending_open_tab.json"));
  MESH_CHECK_EQ(FileName(paths.AdblockPrefsFile()), std::string("prefs.json"));
}

MESH_TEST(ProfilePaths_TwoRootsNeverShareAFile) {
  const mesh::profile::ProfilePaths a("a");
  const mesh::profile::ProfilePaths b("b");
  MESH_CHECK_NE(a.SettingsFile(), b.SettingsFile());
  MESH_CHECK_NE(a.CacheRoot(""), b.CacheRoot(""));
  MESH_CHECK_NE(a.CacheRoot("x"), b.CacheRoot("x"));
}

MESH_TEST(ProfilePaths_CacheRootFollowsTheInstance) {
  const mesh::profile::ProfilePaths paths("root");
  MESH_CHECK_EQ(Relative("root", paths.CacheRoot("")), std::string("cef"));
  MESH_CHECK_EQ(Relative("root", paths.CacheRoot("abc")),
                std::string("instances/abc/cef"));
}

MESH_TEST(ProfilePaths_TheProductDirectoryHasItsOwnName) {
  MESH_CHECK_EQ(std::string(mesh::profile::kProductDirName),
                std::string("MeshEngine"));
  MESH_CHECK_NE(std::string(mesh::profile::kProductDirName),
                std::string(mesh::profile::kLegacyProductDirName));
}

MESH_TEST(SanitizeInstanceId_KeepsOnlySafeCharacters) {
  MESH_CHECK_EQ(mesh::profile::SanitizeInstanceId("abc-123_x"),
                std::string("abc-123_x"));
  MESH_CHECK_EQ(mesh::profile::SanitizeInstanceId("../../etc"),
                std::string("etc"));
  MESH_CHECK_EQ(mesh::profile::SanitizeInstanceId("a b"), std::string("ab"));
  MESH_CHECK_EQ(mesh::profile::SanitizeInstanceId(""), std::string(""));
}

MESH_TEST(SanitizeInstanceId_TruncatesLongIds) {
  const std::string long_id(200, 'x');
  MESH_CHECK_EQ(mesh::profile::SanitizeInstanceId(long_id).size(),
                static_cast<size_t>(64));
}

MESH_TEST(ResolveLaunchOptions_ReadsTheCurrentSwitches) {
  const mesh::profile::LaunchOptions options =
      mesh::profile::ResolveLaunchOptions(true, false, "work", "");
  MESH_CHECK(options.private_mode);
  MESH_CHECK(options.has_instance);
  MESH_CHECK_EQ(options.instance_id, std::string("work"));
}

MESH_TEST(ResolveLaunchOptions_AcceptsTheLegacySwitches) {
  const mesh::profile::LaunchOptions options =
      mesh::profile::ResolveLaunchOptions(false, true, "", "old");
  MESH_CHECK(options.private_mode);
  MESH_CHECK(options.has_instance);
  MESH_CHECK_EQ(options.instance_id, std::string("old"));
}

MESH_TEST(ResolveLaunchOptions_PrefersTheCurrentSwitches) {
  const mesh::profile::LaunchOptions options =
      mesh::profile::ResolveLaunchOptions(false, true, "new", "old");
  MESH_CHECK(options.private_mode);
  MESH_CHECK_EQ(options.instance_id, std::string("new"));
}

MESH_TEST(ResolveLaunchOptions_WithoutSwitchesUsesThePrimaryProfile) {
  const mesh::profile::LaunchOptions options =
      mesh::profile::ResolveLaunchOptions(false, false, "", "");
  MESH_CHECK(!options.private_mode);
  MESH_CHECK(!options.has_instance);
  MESH_CHECK_EQ(options.instance_id, std::string(""));
}
