#include "mesh/profile/profile_paths.h"

#include <cstdlib>
#include <filesystem>

#if defined(_WIN32)
#include <windows.h>
#else
#include <unistd.h>
#endif

#include "mesh/utf8.h"

namespace mesh::profile {

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

/** The per-user data directory of the OS, without a product sub-folder. */
std::string UserDataBaseDirImpl() {
#if defined(_WIN32)
  wchar_t* appdata = nullptr;
  size_t len = 0;
  if (_wdupenv_s(&appdata, &len, L"APPDATA") == 0 && appdata) {
    std::filesystem::path p(appdata);
    free(appdata);
    return FromFs(p);
  }
  return std::string();
#else
  if (const char* xdg = std::getenv("XDG_DATA_HOME"); xdg && xdg[0]) {
    return xdg;
  }
  if (const char* home = std::getenv("HOME"); home && home[0]) {
    return FromFs(ToFs(home) / ".local" / "share");
  }
  return std::string();
#endif
}

}  // namespace

std::string UserDataBaseDir() {
  return UserDataBaseDirImpl();
}

std::string DefaultUserDataRoot() {
  const std::string base = UserDataBaseDir();
  if (base.empty()) {
    return std::string();
  }
  return Join(base, kProductDirName);
}

std::string LegacyUserDataRoot() {
  const std::string base = UserDataBaseDir();
  if (base.empty()) {
    return std::string();
  }
  return Join(base, kLegacyProductDirName);
}

ProfilePaths::ProfilePaths(std::string root) : root_(std::move(root)) {}

std::string ProfilePaths::SettingsFile() const {
  return Join(root_, "settings.json");
}

std::string ProfilePaths::HistoryFile() const {
  return Join(root_, "visit_history.json");
}

std::string ProfilePaths::BookmarksFile() const {
  return Join(root_, "bookmarks.json");
}

std::string ProfilePaths::DownloadsFile() const {
  return Join(root_, "downloads.json");
}

std::string ProfilePaths::SessionFile() const {
  return Join(root_, "tab_session.json");
}

std::string ProfilePaths::DatabaseFile() const {
  return Join(root_, "library.db");
}

std::string ProfilePaths::PendingOpenTabFile() const {
  return Join(root_, "pending_open_tab.json");
}

std::string ProfilePaths::AdblockDir() const {
  return Join(root_, "adblock");
}

std::string ProfilePaths::AdblockPrefsFile() const {
  return Join(AdblockDir(), "prefs.json");
}

std::string ProfilePaths::InstancesDir() const {
  return Join(root_, "instances");
}

std::string ProfilePaths::CacheRoot(const std::string& instance_id) const {
  if (instance_id.empty()) {
    return Join(root_, "cef");
  }
  return Join(Join(InstancesDir(), instance_id), "cef");
}

std::string ProfilePaths::FallbackDownloadsDir() const {
  return Join(root_, "Downloads");
}

}  // namespace mesh::profile
