// The app-menu dismissal rule: closing the root menu always dismisses the
// app menu, closing a submenu does not while the native root menu is up.

#include "test_harness.h"

#include "engine/engine_app_menu_dismissal.h"

MESH_TEST(DecideAppMenuDismissal_ClosingTheRootMenuDismisses) {
  MESH_CHECK(engine::DecideAppMenuDismissal(/*is_submenu=*/false,
                                             /*root_menu_visible=*/false) ==
             engine::AppMenuDismissal::Dismiss);
}

MESH_TEST(DecideAppMenuDismissal_ClosingTheRootMenuDismissesEvenWhenVisible) {
  MESH_CHECK(engine::DecideAppMenuDismissal(/*is_submenu=*/false,
                                             /*root_menu_visible=*/true) ==
             engine::AppMenuDismissal::Dismiss);
}

MESH_TEST(DecideAppMenuDismissal_ClosingASubmenuKeepsTheMenuWhileRootIsUp) {
  MESH_CHECK(engine::DecideAppMenuDismissal(/*is_submenu=*/true,
                                             /*root_menu_visible=*/true) ==
             engine::AppMenuDismissal::Keep);
}

MESH_TEST(DecideAppMenuDismissal_ClosingASubmenuDismissesWhenRootIsGone) {
  MESH_CHECK(engine::DecideAppMenuDismissal(/*is_submenu=*/true,
                                             /*root_menu_visible=*/false) ==
             engine::AppMenuDismissal::Dismiss);
}
