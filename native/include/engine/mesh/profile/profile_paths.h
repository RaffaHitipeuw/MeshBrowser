#pragma once

// Where the engine keeps a user's data.
//
// The layout is a pure function of a profile root: the same root always
// produces the same file names, and two different roots never share a file.
// Nothing here touches global state or CEF, so the layout can be reasoned
// about (and tested) on its own.

#include <string>

#include "mesh/product_identity.h"

namespace mesh::profile {

/** Name of the directory that holds the current profile. */
inline constexpr const char* kProductDirName = product::kDataDirName;

/**
 * Name of the directory that held the profile of the previous product.
 *
 * It is read once, at start-up, to migrate user data into the current
 * layout. It is never written to.
 */
inline constexpr const char* kLegacyProductDirName = product::kLegacyDataDirName;

/**
 * The per-user data directory of the operating system, without a product
 * sub-folder. Empty when the environment does not provide one.
 */
std::string UserDataBaseDir();

/** The per-user root directory for the current product. */
std::string DefaultUserDataRoot();

/** The per-user root directory of the previous product. */
std::string LegacyUserDataRoot();

/**
 * The complete set of paths that make up one profile.
 *
 * A profile owns the settings, the visit history, the bookmarks, the
 * download list, the tab session, the library database, the adblock
 * preferences and the Chromium cache. Instances (secondary windows and
 * private windows) live under the same root but never share files with the
 * primary profile.
 */
class ProfilePaths {
 public:
  ProfilePaths() = default;
  explicit ProfilePaths(std::string root);

  /** The root directory this profile lives in. */
  const std::string& root() const { return root_; }

  /** User settings (JSON object). */
  std::string SettingsFile() const;

  /** Persistent visit history (JSON array of {url,title,ts}). */
  std::string HistoryFile() const;

  /** Persistent bookmarks (JSON array of {url,title,ts}). */
  std::string BookmarksFile() const;

  /** Persistent download list (JSON array). */
  std::string DownloadsFile() const;

  /** Browser tab session snapshot for plugins (JSON object). */
  std::string SessionFile() const;

  /** The library database (SQLite). */
  std::string DatabaseFile() const;

  /** Optional tab payload when spawning a new window (window.newWithTab). */
  std::string PendingOpenTabFile() const;

  /** Adblock preferences and filter lists. */
  std::string AdblockDir() const;

  /** Adblock preferences file. */
  std::string AdblockPrefsFile() const;

  /** Directory that holds the per-instance profiles. */
  std::string InstancesDir() const;

  /** CEF cache root of a single instance ("" = the primary profile). */
  std::string CacheRoot(const std::string& instance_id) const;

  /** Directory used for downloads when the system one is unknown. */
  std::string FallbackDownloadsDir() const;

 private:
  std::string root_;
};

}  // namespace mesh::profile
