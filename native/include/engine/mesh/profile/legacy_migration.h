#pragma once

// Moving a user profile from the previous product layout to the current one.
//
// The previous product kept its data in a directory named after itself. The
// current product uses its own directory. Rather than losing the user's
// history, bookmarks, settings, downloads and cookies, the engine migrates
// the old directory once, on start-up.
//
// The rules of the migration are explicit and testable:
//   - a file that already exists in the new profile is never overwritten;
//   - the legacy directory is only ever read, never modified;
//   - the migration is idempotent: running it twice changes nothing.

#include <string>
#include <vector>

#include "mesh/profile/profile_paths.h"

namespace mesh::profile {

/** The outcome of one migration run. */
struct MigrationResult {
  /** Whether a legacy profile directory was found at all. */
  bool legacy_profile_found = false;
  /** Whether anything was actually copied. */
  bool migrated = false;
  /** Files copied, as paths relative to the profile root. */
  std::vector<std::string> migrated_files;
  /** Files that already existed in the new profile and were left alone. */
  std::vector<std::string> skipped_files;
  /** Set when the migration could not be completed. */
  std::string error;
};

/** The files that make up a profile and are migrated one by one. */
const std::vector<std::string>& MigratableProfileFiles();

/** The directories of a profile that are migrated as a whole. */
const std::vector<std::string>& MigratableProfileDirs();

/**
 * The marker that records that the migration of the legacy profile is done.
 *
 * It lives in the profile root. Without it, every start would look at the
 * legacy profile again.
 */
inline constexpr const char* kMigrationMarkerFile = ".legacy-profile-migrated";

/**
 * The key a setting had in the previous product.
 *
 * Settings of the previous product were named after it ("omni.searchEngine");
 * they are now named after the current one ("mesh.searchEngine"). The old
 * name is returned so that a settings file written before the rename keeps
 * its values.
 *
 * @return The legacy key, or an empty string when the key has no legacy name.
 */
std::string LegacySettingsKey(const std::string& key);

/**
 * Copies the legacy profile into the current profile.
 *
 * @param current The profile the engine is going to use.
 * @param legacy  The profile of the previous product.
 */
MigrationResult MigrateLegacyProfile(const ProfilePaths& current,
                                     const ProfilePaths& legacy);

/**
 * Copies the legacy profile in `legacy_root` into the current profile.
 *
 * @param current     The profile the engine is going to use.
 * @param legacy_root The root directory of the previous product.
 */
MigrationResult MigrateLegacyProfile(const ProfilePaths& current,
                                     const std::string& legacy_root);

/**
 * Migrates the default legacy profile, if there is one.
 *
 * Returns a result with `legacy_profile_found == false` when there is
 * nothing to migrate, which is the normal case for a fresh install.
 */
MigrationResult EnsureLegacyProfileMigrated();

}  // namespace mesh::profile
