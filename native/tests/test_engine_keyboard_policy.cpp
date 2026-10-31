// The keyboard routing rule of the browser runtime: which key press means
// which browser action, and where that action is allowed to fire.

#include "test_harness.h"

#include "engine/engine_keyboard_policy.h"

namespace {

engine::KeyEvent Key(int key_code,
                     bool ctrl = false,
                     bool shift = false,
                     bool alt = false) {
  engine::KeyEvent event;
  event.key_code = key_code;
  event.ctrl = ctrl;
  event.shift = shift;
  event.alt = alt;
  return event;
}

/** A key press in the content pane while it is on screen. */
engine::KeyContext Browsing() {
  engine::KeyContext context;
  context.is_content_browser = true;
  context.content_visible = true;
  return context;
}

}  // namespace

MESH_TEST(ResolveKeyAction_F12TogglesTheDeveloperTools) {
  MESH_CHECK(engine::ResolveKeyAction(Key(engine::keys::kF12), Browsing()) ==
             engine::KeyAction::ToggleDevTools);
}

MESH_TEST(ResolveKeyAction_CtrlShiftITogglesTheDeveloperTools) {
  MESH_CHECK(engine::ResolveKeyAction(
                 Key(engine::keys::kI, /*ctrl=*/true, /*shift=*/true),
                 Browsing()) == engine::KeyAction::ToggleDevTools);
}

MESH_TEST(ResolveKeyAction_CtrlLFocusesTheAddressBar) {
  MESH_CHECK(engine::ResolveKeyAction(Key(engine::keys::kL, /*ctrl=*/true),
                                       Browsing()) ==
             engine::KeyAction::FocusAddressBar);
}

MESH_TEST(ResolveKeyAction_CtrlFTogglesTheFindBar) {
  MESH_CHECK(engine::ResolveKeyAction(Key(engine::keys::kF, /*ctrl=*/true),
                                       Browsing()) ==
             engine::KeyAction::ToggleFindBar);
}

MESH_TEST(ResolveKeyAction_TheDevToolsWindowKeepsItsOwnKeys) {
  engine::KeyContext context = Browsing();
  context.is_devtools_browser = true;

  MESH_CHECK(engine::ResolveKeyAction(Key(engine::keys::kF12), context) ==
             engine::KeyAction::None);
  MESH_CHECK(engine::ResolveKeyAction(Key(engine::keys::kL, /*ctrl=*/true),
                                       context) == engine::KeyAction::None);
  MESH_CHECK(engine::ResolveKeyAction(Key(engine::keys::kF, /*ctrl=*/true),
                                       context) == engine::KeyAction::None);
}

MESH_TEST(ResolveKeyAction_F5ReloadsThePage) {
  MESH_CHECK(engine::ResolveKeyAction(Key(engine::keys::kF5), Browsing()) ==
             engine::KeyAction::ReloadPage);
}

MESH_TEST(ResolveKeyAction_ShiftF5ReloadsIgnoringTheCache) {
  MESH_CHECK(engine::ResolveKeyAction(
                 Key(engine::keys::kF5, /*ctrl=*/false, /*shift=*/true),
                 Browsing()) == engine::KeyAction::ReloadPageIgnoringCache);
}

MESH_TEST(ResolveKeyAction_CtrlRReloadsThePage) {
  MESH_CHECK(engine::ResolveKeyAction(Key(engine::keys::kR, /*ctrl=*/true),
                                       Browsing()) == engine::KeyAction::ReloadPage);
}

MESH_TEST(ResolveKeyAction_CtrlShiftRReloadsIgnoringTheCache) {
  MESH_CHECK(engine::ResolveKeyAction(
                 Key(engine::keys::kR, /*ctrl=*/true, /*shift=*/true),
                 Browsing()) == engine::KeyAction::ReloadPageIgnoringCache);
}

MESH_TEST(ResolveKeyAction_TheReloadShortcutsNeedAVisibleContentPane) {
  engine::KeyContext hidden;
  hidden.is_content_browser = true;
  hidden.content_visible = false;

  MESH_CHECK(engine::ResolveKeyAction(Key(engine::keys::kF5), hidden) ==
             engine::KeyAction::None);
  MESH_CHECK(engine::ResolveKeyAction(Key(engine::keys::kR, /*ctrl=*/true),
                                       hidden) == engine::KeyAction::None);
}

MESH_TEST(ResolveKeyAction_TheReloadShortcutsDoNotFireOutsideTheContentPane) {
  engine::KeyContext shell;

  MESH_CHECK(engine::ResolveKeyAction(Key(engine::keys::kF5), shell) ==
             engine::KeyAction::None);
}

MESH_TEST(ResolveKeyAction_PlainKeysAreNotShortcuts) {
  MESH_CHECK(engine::ResolveKeyAction(Key('A'), Browsing()) ==
             engine::KeyAction::None);
}

MESH_TEST(ResolveKeyAction_AltAndShiftCombinationsAreNotShortcuts) {
  MESH_CHECK(engine::ResolveKeyAction(
                 Key(engine::keys::kL, /*ctrl=*/true, /*shift=*/true),
                 Browsing()) == engine::KeyAction::None);
  MESH_CHECK(engine::ResolveKeyAction(
                 Key(engine::keys::kL, /*ctrl=*/true, /*alt=*/true),
                 Browsing()) == engine::KeyAction::None);
}
