// The native-menu tracker contract. The tracker is the engine's mechanism
// for noticing the platform-native menu window; the product supplies the
// styling and reacts to the dismissal.
//
// These tests only assert the platform-independent contract, so they run
// unchanged on Windows and on platforms without a native menu.

#include "test_harness.h"

#include "engine/engine_native_menu_tracker.h"

MESH_TEST(NativeMenuTracker_IsAProcessWideSingleton) {
  MESH_CHECK(&engine::NativeMenuTracker::Get() ==
             &engine::NativeMenuTracker::Get());
}

MESH_TEST(NativeMenuTracker_HasNoRootMenuBeforeOneIsTracked) {
  // A fresh tracker has not seen a native menu popup yet.
  MESH_CHECK(!engine::NativeMenuTracker::Get().root_menu_present());
  MESH_CHECK(!engine::NativeMenuTracker::Get().root_menu_visible());
}

MESH_TEST(NativeMenuTracker_RemoveIsSafeWithoutAnInstall) {
  // Removing a tracker that was never installed must be a no-op, not a
  // crash: the product tears the tracker down on every menu close.
  engine::NativeMenuTracker::Get().Remove();

  MESH_CHECK(!engine::NativeMenuTracker::Get().root_menu_present());
}

MESH_TEST(NativeMenuTracker_RemoveClearsTheCallbacks) {
  engine::NativeMenuTracker& tracker = engine::NativeMenuTracker::Get();

  engine::NativeMenuTracker::Callbacks callbacks;
  callbacks.log = [](const std::string&) {};
  tracker.Remove();

  MESH_CHECK(!tracker.callbacks().on_popup_created);
  MESH_CHECK(!tracker.callbacks().on_menu_closed);
  MESH_CHECK(!tracker.callbacks().is_foreign_window);
  MESH_CHECK(!tracker.callbacks().log);
}
