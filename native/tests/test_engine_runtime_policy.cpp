// The URL classification rules of the browser runtime: which URL belongs in
// the content pane, what happens to a popup, and how a suggested download
// name is made safe.

#include "test_harness.h"

#include <string>

#include "engine/engine_runtime_policy.h"

MESH_TEST(IsDevToolsUrl_RecognisesBothDevToolsSchemes) {
  MESH_CHECK(engine::IsDevToolsUrl("devtools://devtools/bundled/x.html"));
  MESH_CHECK(engine::IsDevToolsUrl("chrome-devtools://devtools/x.html"));
}

MESH_TEST(IsDevToolsUrl_IgnoresOrdinaryPages) {
  MESH_CHECK(!engine::IsDevToolsUrl("https://example.com/"));
  MESH_CHECK(!engine::IsDevToolsUrl("chrome://settings"));
  MESH_CHECK(!engine::IsDevToolsUrl(""));
}

MESH_TEST(IsAboutUrl_CoversEmptyBlankAndEveryAboutScheme) {
  MESH_CHECK(engine::IsAboutUrl(""));
  MESH_CHECK(engine::IsAboutUrl("about:blank"));
  MESH_CHECK(engine::IsAboutUrl("about:version"));
  MESH_CHECK(!engine::IsAboutUrl("https://example.com/"));
}

MESH_TEST(ShouldOpenInContent_AcceptsWebPages) {
  MESH_CHECK(engine::ShouldOpenInContent("https://example.com/"));
  MESH_CHECK(engine::ShouldOpenInContent("http://example.com/page?q=1"));
}

MESH_TEST(ShouldOpenInContent_KeepsTheShellOnItsOwnUi) {
  MESH_CHECK(!engine::ShouldOpenInContent(""));
  MESH_CHECK(!engine::ShouldOpenInContent("about:blank"));
  MESH_CHECK(!engine::ShouldOpenInContent("file:///c:/ui/index.html"));
  MESH_CHECK(!engine::ShouldOpenInContent("data:text/html,hello"));
  MESH_CHECK(!engine::ShouldOpenInContent("chrome://settings"));
  MESH_CHECK(!engine::ShouldOpenInContent("devtools://devtools/x.html"));
}

MESH_TEST(DecidePopupAction_DevToolsOpensAsANativeWindow) {
  MESH_CHECK(engine::DecidePopupAction("devtools://devtools/x.html", "") ==
             engine::PopupAction::AllowNativeChrome);
  MESH_CHECK(engine::DecidePopupAction("https://example.com/", "DevTools") ==
             engine::PopupAction::AllowNativeChrome);
}

MESH_TEST(DecidePopupAction_AWebPageOpensInAContentTab) {
  MESH_CHECK(engine::DecidePopupAction("https://example.com/popup", "") ==
             engine::PopupAction::OpenInContentTab);
}

MESH_TEST(DecidePopupAction_AnythingElseIsDropped) {
  MESH_CHECK(engine::DecidePopupAction("", "") == engine::PopupAction::Block);
  MESH_CHECK(engine::DecidePopupAction("about:blank", "") ==
             engine::PopupAction::Block);
  MESH_CHECK(engine::DecidePopupAction("file:///c:/tmp/x.html", "") ==
             engine::PopupAction::Block);
}

MESH_TEST(SanitizeDownloadFileName_ReplacesPathAndIllegalCharacters) {
  MESH_CHECK_EQ(engine::SanitizeDownloadFileName("a/b\\c:d*e?f\"g<h>i|j"),
                std::string("a_b_c_d_e_f_g_h_i_j"));
}

MESH_TEST(SanitizeDownloadFileName_KeepsOrdinaryNames) {
  MESH_CHECK_EQ(engine::SanitizeDownloadFileName("report 2024.pdf"),
                std::string("report 2024.pdf"));
}
