#pragma once

// The parts of a profile that change while the browser runs.
//
// Private mode and the instance id are process-wide facts: they decide
// which profile the current process reads and writes. They live in their own
// module so that the profile layout (profile_paths.h) stays a pure function
// of a root directory, and so that the state can be tested without a
// browser.

#include <string>

namespace mesh::profile {

/**
 * Turns a raw instance id into a safe directory name.
 *
 * Only letters, digits, '-' and '_' survive; the result is truncated to 64
 * characters. An id that contains nothing usable becomes empty, which means
 * "the primary profile".
 */
std::string SanitizeInstanceId(const std::string& raw);

/** Selects the instance this process writes to ("" = the primary profile). */
void SetInstanceId(const std::string& id);

/** The instance this process writes to ("" = the primary profile). */
std::string InstanceId();

/** Turns private mode on or off. */
void SetPrivateMode(bool on);

/** Whether this process runs in private mode. */
bool IsPrivateMode();

/** Clears every piece of process state. Intended for tests. */
void ResetState();

}  // namespace mesh::profile
