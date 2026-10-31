// The identity of the product: the names that appear in the window title,
// the MCP server, the user agent and the profile directory.

#include "test_harness.h"

#include <string>

#include "mesh/product_identity.h"

MESH_TEST(ProductIdentity_TheNamesAreConsistent) {
  // The profile directory and the executable share the short name, so that
  // a build directory and a profile directory are easy to tell apart.
  MESH_CHECK_EQ(std::string(mesh::product::kDataDirName),
                std::string(mesh::product::kId));
  // The MCP server reports itself with the short name.
  MESH_CHECK_EQ(std::string(mesh::product::kMcpServerName).find(
                    mesh::product::kId),
                0u);
  // The user agent starts with the short name as well.
  MESH_CHECK_EQ(std::string(mesh::product::kUserAgent).find(
                    mesh::product::kId),
                0u);
}

MESH_TEST(ProductIdentity_TheLegacyDirectoryIsOnlyRead) {
  MESH_CHECK_NE(std::string(mesh::product::kDataDirName),
                std::string(mesh::product::kLegacyDataDirName));
  MESH_CHECK_EQ(std::string(mesh::product::kLegacyDataDirName),
                std::string("OmniBrowser"));
}

MESH_TEST(ProductIdentity_TheProductHasAName) {
  MESH_CHECK_EQ(std::string(mesh::product::kName),
                std::string("Mesh Engine"));
}
