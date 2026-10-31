#pragma once

// How the command line of a launch is turned into profile options.
//
// The engine is started by other programs: by itself, by the shell UI, by
// the updater, and by MCP hosts. Those callers use switches, and the older
// builds of the product used different switch names. The resolution rules
// live here, away from CEF, so both the Windows and the Linux entry point
// behave identically and so the rules can be tested.

#include <string>

namespace mesh::profile {

/** Switch that opens the browser in private mode. */
inline constexpr const char* kPrivateSwitch = "mesh-private";

/** Switch of the previous product that opened the browser in private mode. */
inline constexpr const char* kLegacyPrivateSwitch = "omni-private";

/** Switch that selects the profile instance a process writes to. */
inline constexpr const char* kInstanceSwitch = "mesh-instance";

/** Switch of the previous product that selected the profile instance. */
inline constexpr const char* kLegacyInstanceSwitch = "omni-instance";

/** The profile options a launch asks for. */
struct LaunchOptions {
  /** Whether the browser runs in private mode. */
  bool private_mode = false;
  /** The profile instance to use ("" = the primary profile). */
  std::string instance_id;
  /** Whether an instance id was given at all. */
  bool has_instance = false;
};

/**
 * Resolves the launch options from the values of the command line.
 *
 * The current switch names win; the legacy names are accepted so that
 * scripts written for the previous product keep working.
 *
 * @param private_switch     Whether the private switch was present.
 * @param legacy_private     Whether the legacy private switch was present.
 * @param instance_value     Value of the current instance switch.
 * @param legacy_instance    Value of the legacy instance switch.
 */
LaunchOptions ResolveLaunchOptions(bool private_switch,
                                   bool legacy_private,
                                   const std::string& instance_value,
                                   const std::string& legacy_instance);

}  // namespace mesh::profile
