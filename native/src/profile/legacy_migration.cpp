#include "mesh/profile/legacy_migration.h"

#include <filesystem>
#include <fstream>
#include <system_error>

#include "mesh/utf8.h"

namespace mesh::profile {

namespace {

namespace fs = std::filesystem;

std::filesystem::path ToFs(const std::string& utf8) {
  return fs::path(utf8::Widen(utf8));
}

bool Exists(const fs::path& p, std::error_code& ec) {
  return fs::exists(p, ec);
}

/**
 * Copies one file when the destination does not exist yet.
 *
 * Returns true when the file was copied, false when it was skipped.
 */
bool CopyFileIfMissing(const fs::path& from,
                       const fs::path& to,
                       std::error_code& ec) {
  if (!fs::is_regular_file(from, ec) || ec) {
    return false;
  }
  if (fs::exists(to, ec)) {
    return false;
  }
  fs::create_directories(to.parent_path(), ec);
  if (ec) {
    return false;
  }
  fs::copy_file(from, to, fs::copy_options::none, ec);
  return !ec;
}

/**
 * Copies a directory tree, keeping files that already exist.
 *
 * The Chromium cache is the reason this exists: it holds cookies and local
 * storage, and it is far too large to be handled file by file.
 */
void CopyDirIfMissing(const fs::path& from,
                      const fs::path& to,
                      std::error_code& ec) {
  if (!fs::is_directory(from, ec) || ec) {
    return;
  }
  fs::create_directories(to, ec);
  if (ec) {
    return;
  }
  fs::copy(from,
           to,
           fs::copy_options::recursive | fs::copy_options::skip_existing,
           ec);
}

}  // namespace

const std::vector<std::string>& MigratableProfileFiles() {
  static const std::vector<std::string> kFiles = {
      "settings.json",
      "visit_history.json",
      "bookmarks.json",
      "downloads.json",
      "tab_session.json",
      "library.db",
      "pending_open_tab.json",
      "adblock/prefs.json",
  };
  return kFiles;
}

const std::vector<std::string>& MigratableProfileDirs() {  static const std::vector<std::string> kDirs = {
      "adblock",
      "cef",
      "instances",
  };
  return kDirs;
}

std::string LegacySettingsKey(const std::string& key) {
  static const std::string kCurrentPrefix = "mesh.";
  static const std::string kLegacyPrefix = "omni.";
  if (key.rfind(kCurrentPrefix, 0) != 0) {
    return std::string();
  }
  return kLegacyPrefix + key.substr(kCurrentPrefix.size());
}

MigrationResult MigrateLegacyProfile(const ProfilePaths& current,
                                     const ProfilePaths& legacy) {
  MigrationResult result;

  std::error_code ec;
  const fs::path legacy_root = ToFs(legacy.root());
  if (legacy.root().empty() || !Exists(legacy_root, ec) || ec ||
      !fs::is_directory(legacy_root, ec)) {
    return result;
  }
  result.legacy_profile_found = true;

  const fs::path current_root = ToFs(current.root());
  fs::create_directories(current_root, ec);
  if (ec) {
    result.error = "cannot create the profile directory: " + ec.message();
    return result;
  }

  // The migration runs once. The marker tells the next start that there is
  // nothing left to do.
  const fs::path marker = current_root / ToFs(kMigrationMarkerFile);
  if (fs::exists(marker, ec)) {
    result.skipped_files.push_back(kMigrationMarkerFile);
    return result;
  }

  for (const std::string& relative : MigratableProfileFiles()) {
    const fs::path from = legacy_root / ToFs(relative);
    const fs::path to = current_root / ToFs(relative);
    std::error_code file_ec;
    if (!fs::is_regular_file(from, file_ec) || file_ec) {
      continue;
    }
    if (fs::exists(to, file_ec)) {
      result.skipped_files.push_back(relative);
      continue;
    }
    std::error_code copy_ec;
    if (CopyFileIfMissing(from, to, copy_ec)) {
      result.migrated_files.push_back(relative);
      result.migrated = true;
    } else {
      result.skipped_files.push_back(relative);
    }
  }

  for (const std::string& relative : MigratableProfileDirs()) {
    const fs::path from = legacy_root / ToFs(relative);
    const fs::path to = current_root / ToFs(relative);
    std::error_code dir_ec;
    if (!fs::is_directory(from, dir_ec) || dir_ec) {
      continue;
    }
    // A directory that already holds something belongs to the current
    // profile; it is left alone, together with the live data in it.
    std::error_code exists_ec;
    if (fs::is_directory(to, exists_ec) && !fs::is_empty(to, exists_ec)) {
      result.skipped_files.push_back(relative + "/");
      continue;
    }
    std::error_code copy_ec;
    CopyDirIfMissing(from, to, copy_ec);
    if (copy_ec) {
      result.error = "cannot copy " + relative + ": " + copy_ec.message();
      continue;
    }
    result.migrated_files.push_back(relative + "/");
    result.migrated = true;
  }

  if (result.error.empty()) {
    std::error_code marker_ec;
    std::ofstream marker_out(marker, std::ios::binary | std::ios::trunc);
    marker_out << "migrated from " << legacy.root() << "\n";
  }

  return result;
}

MigrationResult MigrateLegacyProfile(const ProfilePaths& current,
                                     const std::string& legacy_root) {
  return MigrateLegacyProfile(current, ProfilePaths(legacy_root));
}

MigrationResult EnsureLegacyProfileMigrated() {
  const std::string legacy_root = LegacyUserDataRoot();
  if (legacy_root.empty()) {
    return MigrationResult{};
  }
  const std::string current_root = DefaultUserDataRoot();
  if (current_root.empty()) {
    return MigrationResult{};
  }
  return MigrateLegacyProfile(ProfilePaths(current_root),
                              ProfilePaths(legacy_root));
}

}  // namespace mesh::profile
