#pragma once

// The identity of the product.
//
// The name of the product appears in the window title, the MCP server
// description, the user agent, the release feed and the name of the profile
// directory. It is defined once here, so that the product cannot drift into
// several names.

namespace mesh::product {

/** The name of the product, as it is shown to the user. */
inline constexpr const char* kName = "Mesh Engine";

/** The short name of the product; used for file names and identifiers. */
inline constexpr const char* kId = "MeshEngine";

/** The name of the directory that holds the profile of the user. */
inline constexpr const char* kDataDirName = "MeshEngine";

/**
 * The name of the directory that held the profile of the previous product.
 *
 * It is only read, to migrate user data into the current layout.
 */
inline constexpr const char* kLegacyDataDirName = "OmniBrowser";

/** The name the MCP server reports itself under. */
inline constexpr const char* kMcpServerName = "MeshEngine MCP Server";

/** The user agent the browser identifies itself with. */
inline constexpr const char* kUserAgent = "MeshEngine/1.0";

/** The user agent as a wide string, for the WinHTTP client. */
inline constexpr const wchar_t* kUserAgentWide = L"MeshEngine/1.0";

/** The repository the releases are published in. */
inline constexpr const char* kReleaseRepo = "/MeshEngine";

}  // namespace mesh::product
