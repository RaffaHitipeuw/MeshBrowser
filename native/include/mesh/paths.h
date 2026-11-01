#pragma once

// The public face of the profile locations.
//
// The layout itself lives in mesh/profile/profile_paths.h: it is a pure
// function of a profile root. This header is the façade that the rest of
// the engine uses, because most callers only want "where is the settings
// file", not a profile object.

#include <cstdint>
#include <string>

namespace mesh::paths {

/** The directory the running executable lives in. */
std::string ExecutableDir();

/** The root directory of the profile of this process. */
std::string AppDataDir();

/** The root directory of the profile of this process, created if needed. */
std::string EnsureAppDataDir();

/** The library database (SQLite). */
std::string DatabasePath();

/** Persistent visit history (JSON array of {url,title,ts}). */
std::string HistoryPath();

/** Persistent bookmarks (JSON array of {url,title,ts}). */
std::string BookmarksPath();

/** Persistent download list (JSON array). */
std::string DownloadsPath();

/** User settings (JSON object). */
std::string SettingsPath();

/** Browser tab session snapshot for plugins (JSON object). */
std::string SessionPath();

/** Bundled plugin manifests under ui/plugins/. */
std::string PluginsDir();

/** Optional tab payload when spawning a new window (window.newWithTab). */
std::string PendingOpenTabPath();

/** User Downloads folder (or the profile fallback). */
std::string UserDownloadsDir();
std::string EnsureUserDownloadsDir();

/**
 * Selects the profile instance this process writes to.
 *
 * @param id The raw instance id; it is sanitized before use.
 */
void SetProfileInstanceId(const std::string& id);

/** The profile instance this process writes to ("" = the primary profile). */
std::string ProfileInstanceId();

/** Monotonic-ish tick in milliseconds (GetTickCount64 / CLOCK_MONOTONIC). */
uint64_t NowTickMs();

/** Private window: isolated CEF profile, no visit history, wiped on exit. */
void SetPrivateMode(bool on);
bool IsPrivateMode();
void WipePrivateProfile();

/** CEF profile root (cookies, localStorage, history disk state). */
std::string CacheRootDir();
std::string EnsureCacheRootDir();

/** Directory that contains index.html (repo ui/ in dev, exe/ui in release). */
std::string UiRootDir();

/** Adblock-rust filter lists / prefs under the profile and bundled defaults. */
std::string AdblockDir();
std::string EnsureAdblockDir();
std::string AdblockPrefsPath();
std::string BundledAdblockDir();

/** file:/// URL to index.html */
std::string UiEntryUrl();

/** file:/// URL to overlay.html (dropdown overlay browser). */
std::string UiOverlayUrl();

/** Converts a filesystem path into a file:/// URL. */
std::string PathToFileUrl(const std::string& path);

/**
 * Migrates the profile of the previous product, if there is one.
 *
 * Runs at most once per process. Safe to call from anywhere; the migration
 * never overwrites data that already exists in the current profile.
 */
void MigrateLegacyProfileIfNeeded();

}  // namespace mesh::paths
