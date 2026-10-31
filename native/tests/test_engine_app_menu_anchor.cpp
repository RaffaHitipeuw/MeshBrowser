// The app-menu anchoring rule: the menu opens at the bottom-right corner of
// the element that triggered it, and a degenerate rect must not flip it to
// the wrong side of the window.

#include "test_harness.h"

#include "engine/engine_app_menu_anchor.h"

MESH_TEST(NormalizeAppMenuAnchor_KeepsAWellFormedRect) {
  const engine::AppMenuAnchor anchor =
      engine::NormalizeAppMenuAnchor(10, 20, 110, 60);

  MESH_CHECK_EQ(anchor.left, 10);
  MESH_CHECK_EQ(anchor.top, 20);
  MESH_CHECK_EQ(anchor.right, 110);
  MESH_CHECK_EQ(anchor.bottom, 60);
}

MESH_TEST(NormalizeAppMenuAnchor_OpensAtTheBottomRightCorner) {
  const engine::AppMenuAnchor anchor =
      engine::NormalizeAppMenuAnchor(10, 20, 110, 60);

  MESH_CHECK_EQ(anchor.x(), 110);
  MESH_CHECK_EQ(anchor.y(), 60);
}

MESH_TEST(NormalizeAppMenuAnchor_CollapsesADegenerateRect) {
  const engine::AppMenuAnchor anchor =
      engine::NormalizeAppMenuAnchor(100, 50, 90, 40);

  MESH_CHECK_EQ(anchor.right, 100);
  MESH_CHECK_EQ(anchor.bottom, 50);
  MESH_CHECK(anchor.right >= anchor.left);
  MESH_CHECK(anchor.bottom >= anchor.top);
}

MESH_TEST(NormalizeAppMenuAnchor_CollapsesANegativeRect) {
  const engine::AppMenuAnchor anchor =
      engine::NormalizeAppMenuAnchor(-5, -10, -20, -30);

  MESH_CHECK_EQ(anchor.right, -5);
  MESH_CHECK_EQ(anchor.bottom, -10);
}
