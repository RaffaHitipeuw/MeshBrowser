#include "mesh/paths.h"

#include <chrono>
#include <filesystem>
#include <sstream>

#if defined(_WIN32)
#include <windows.h>
#include <shlobj.h>
#else
#include <cstdlib>
#include <unistd.h>
#endif

#include "mesh/build_config.h"
#include "mesh/dev_mode.h"
#include "mesh/log.h"
#include "mesh/profile/legacy_migration.h"
#include "mesh/profile/profile_paths.h"
#include "mesh/profile/profile_state.h"
#include "mesh/utf8.h"

namespace mesh::paths {

namespace {

std::string FromFs(const std::filesystem::path& p) {
  return utf8::Narrow(p.wstring());
}

std::filesystem::path ToFs(const std::string& utf8) {
  return std::filesystem::path(utf8::Widen(utf8));
}

std::string Join(const std::string& a, const std::string& b) {
  return FromFs(ToFs(a) / utf8::Widen(b));
}

/** The profile of this process. */
profile::ProfilePaths CurrentProfile() {
  const std::string root = profile::DefaultUserDataRoot();
  if (!root.empty()) {
    return profile::ProfilePaths(root);
  }
  return profile::ProfilePaths(Join(ExecutableDir(), "userdata"));
}

}  // namespace

uint64_t NowTickMs() {
  return static_cast<uint64_t>(
      std::chrono::duration_cast<std::chrono::milliseconds>(
          std::chrono::steady_clock::now().time_since_epoch())
          .count());
}

std::string ExecutableDir() {
#if defined(_WIN32)
  wchar_t buf[MAX_PATH];
  const DWORD len = GetModuleFileNameW(nullptr, buf, MAX_PATH);
  if (len == 0 || len >= MAX_PATH) {
    return ".";
  }
  std::filesystem::path p(buf);
  return FromFs(p.parent_path());
#else
  char buf[4096];
  const ssize_t len = ::readlink("/proc/self/exe", buf, sizeof(buf) - 1);
  if (len <= 0) {
    return ".";
  }
  buf[len] = '\0';
  return FromFs(std::filesystem::path(buf).parent_path());
#endif
}

std::string AppDataDir() {
  return CurrentProfile().root();
}

std::string EnsureAppDataDir() {
  const std::string dir = AppDataDir();
  std::error_code ec;
  std::filesystem::create_directories(ToFs(dir), ec);
  MigrateLegacyProfileIfNeeded();
  return dir;
}

void MigrateLegacyProfileIfNeeded() {
  static bool migrated = false;
  if (migrated) {
    return;
  }
  migrated = true;

  const std::string legacy_root = profile::LegacyUserDataRoot();
  if (legacy_root.empty()) {
    return;
  }
  const profile::MigrationResult result = profile::MigrateLegacyProfile(
      CurrentProfile(), profile::ProfilePaths(legacy_root));
  if (!result.legacy_profile_found) {
    return;
  }
  if (!result.error.empty()) {
    Log("Legacy profile migration failed: " + result.error);
    return;
  }
  if (result.migrated) {
    Log("Migrated " + std::to_string(result.migrated_files.size()) +
        " item(s) from the previous profile");
  }
}

std::string DatabasePath() {
  return CurrentProfile().DatabaseFile();
}

std::string HistoryPath() {
  return CurrentProfile().HistoryFile();
}

std::string BookmarksPath() {
  return CurrentProfile().BookmarksFile();
}

std::string DownloadsPath() {
  return CurrentProfile().DownloadsFile();
}

std::string SettingsPath() {
  return CurrentProfile().SettingsFile();
}

std::string SessionPath() {
  return CurrentProfile().SessionFile();
}

std::string PluginsDir() {
  return Join(UiRootDir(), "plugins");
}

std::string PendingOpenTabPath() {
  return CurrentProfile().PendingOpenTabFile();
}

std::string UserDownloadsDir() {
#if defined(_WIN32)
  PWSTR known = nullptr;
  if (SUCCEEDED(SHGetKnownFolderPath(FOLDERID_Downloads, 0, nullptr, &known)) &&
      known) {
    const std::string result = utf8::Narrow(known);
    CoTaskMemFree(known);
    if (!result.empty()) {
      return result;
    }
  }
  return CurrentProfile().FallbackDownloadsDir();
#else
  if (const char* home = std::getenv("HOME"); home && home[0]) {
    return FromFs(ToFs(home) / "Downloads");
  }
  return CurrentProfile().FallbackDownloadsDir();
#endif
}

std::string EnsureUserDownloadsDir() {
  const std::string dir = UserDownloadsDir();
  std::error_code ec;
  std::filesystem::create_directories(ToFs(dir), ec);
  return dir;
}

void SetProfileInstanceId(const std::string& id) {
  profile::SetInstanceId(id);
}

std::string ProfileInstanceId() {
  return profile::InstanceId();
}

void SetPrivateMode(bool on) {
  profile::SetPrivateMode(on);
}

bool IsPrivateMode() {
  return profile::IsPrivateMode();
}

void WipePrivateProfile() {
  if (!profile::IsPrivateMode() || profile::InstanceId().empty()) {
    return;
  }
  std::error_code ec;
  std::filesystem::remove_all(
      ToFs(CurrentProfile().InstancesDir()) / ToFs(profile::InstanceId()), ec);
}

std::string CacheRootDir() {
  return CurrentProfile().CacheRoot(profile::InstanceId());
}

std::string EnsureCacheRootDir() {
  const std::string dir = CacheRootDir();
  std::error_code ec;
  std::filesystem::create_directories(ToFs(dir), ec);
  return dir;
}

std::string PathToFileUrl(const std::string& path) {
  std::filesystem::path p = ToFs(path);
  std::error_code ec;
  p = std::filesystem::weakly_canonical(p, ec);
  std::string native = FromFs(p);
  for (char& c : native) {
    if (c == '\\') {
      c = '/';
    }
  }
  std::ostringstream oss;
  if (!native.empty() && native.front() == '/') {
    oss << "file://" << native;
  } else {
    oss << "file:///" << native;
  }
  return oss.str();
}

std::string UiRootDir() {
  if (IsDevMode()) {
    const std::filesystem::path source(MESH_UI_SOURCE_DIR);
    std::error_code ec;
    if (std::filesystem::exists(source / "index.html", ec)) {
      return FromFs(source);
    }
  }
  return FromFs(ToFs(ExecutableDir()) / "ui");
}

std::string UiEntryUrl() {
  const std::filesystem::path index = ToFs(UiRootDir()) / "index.html";
  std::string url = PathToFileUrl(FromFs(index));
  if (IsPrivateMode()) {
    url += "?private=1";
  }
  return url;
}

std::string UiOverlayUrl() {
  const std::filesystem::path overlay = ToFs(UiRootDir()) / "overlay.html";
  return PathToFileUrl(FromFs(overlay));
}

std::string AdblockDir() {
  return CurrentProfile().AdblockDir();
}

std::string EnsureAdblockDir() {
  const std::string dir = AdblockDir();
  std::error_code ec;
  std::filesystem::create_directories(ToFs(dir), ec);
  return dir;
}

std::string AdblockPrefsPath() {
  return CurrentProfile().AdblockPrefsFile();
}

std::string BundledAdblockDir() {
  const auto beside_exe = ToFs(ExecutableDir()) / "adblock";
  std::error_code ec;
  if (std::filesystem::exists(beside_exe / "mesh-baseline.txt", ec)) {
    return FromFs(beside_exe);
  }
  const auto from_ui = ToFs(UiRootDir()).parent_path() / "resources" / "adblock";
  if (std::filesystem::exists(from_ui / "mesh-baseline.txt", ec)) {
    return FromFs(from_ui);
  }
  return FromFs(beside_exe);
}

}  // namespace mesh::paths
