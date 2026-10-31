#include "mesh/profile/launch_options.h"

#include "mesh/profile/profile_state.h"

namespace mesh::profile {

LaunchOptions ResolveLaunchOptions(bool private_switch,
                                   bool legacy_private,
                                   const std::string& instance_value,
                                   const std::string& legacy_instance) {
  LaunchOptions options;
  options.private_mode = private_switch || legacy_private;

  const std::string& chosen =
      instance_value.empty() ? legacy_instance : instance_value;
  if (!chosen.empty()) {
    options.has_instance = true;
    options.instance_id = SanitizeInstanceId(chosen);
  }
  return options;
}

}  // namespace mesh::profile
