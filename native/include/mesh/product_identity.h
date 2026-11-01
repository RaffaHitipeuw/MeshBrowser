#pragma once

// The identity of the product.
//
// The name of the product appears in the window title, the MCP server
// description, the user agent, the release feed and the name of the profile
// directory. It is defined once here, so that the product cannot drift into
// several names.

namespace mesh::product {

/** The name of the product, as it is shown to the user. */
inline constexpr const char* kName = "MeshBrowser";

/** The short name of the product; used for file names and identifiers. */
inline constexpr const char* kId = "MeshBrowser";

/** The name of the directory that holds the profile of the user. */
inline constexpr const char* kDataDirName = "MeshBrowser";

/**
 * The name of the directory that held the profile of the previous product.
 *
 * It is only read, to migrate user data into the current layout.
 */
inline constexpr const char* kLegacyDataDirName = "Mesh";

/** The name the MCP server reports itself under. */
inline constexpr const char* kMcpServerName = "MeshBrowser MCP Server";

/** The user agent the browser identifies itself with. */
inline constexpr const char* kUserAgent = "MeshBrowser/1.0";

/** The user agent as a wide string, for the WinHTTP client. */
inline constexpr const wchar_t* kUserAgentWide = L"MeshBrowser/1.0";

/** The repository the releases are published in. */
inline constexpr const char* kReleaseRepo = "/MeshBrowser";

}  // namespace mesh::product
