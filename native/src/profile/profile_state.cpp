#include "mesh/profile/profile_state.h"

namespace mesh::profile {

namespace {

std::string g_instance_id;
bool g_private_mode = false;

}  // namespace

std::string SanitizeInstanceId(const std::string& raw) {
  std::string out;
  out.reserve(raw.size());
  for (char c : raw) {
    if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') ||
        (c >= '0' && c <= '9') || c == '-' || c == '_') {
      out.push_back(c);
    }
  }
  if (out.size() > 64) {
    out.resize(64);
  }
  return out;
}

void SetInstanceId(const std::string& id) {
  g_instance_id = SanitizeInstanceId(id);
}

std::string InstanceId() {
  return g_instance_id;
}

void SetPrivateMode(bool on) {
  g_private_mode = on;
}

bool IsPrivateMode() {
  return g_private_mode;
}

void ResetState() {
  g_instance_id.clear();
  g_private_mode = false;
}

}  // namespace mesh::profile
