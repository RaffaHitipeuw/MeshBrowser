#include "engine/engine_app_menu_dismissal.h"

namespace engine {

AppMenuDismissal DecideAppMenuDismissal(bool is_submenu,
                                        bool root_menu_visible) {
  if (is_submenu && root_menu_visible) {
    // The native root menu is still up: only the submenu closed.
    return AppMenuDismissal::Keep;
  }
  return AppMenuDismissal::Dismiss;
}

}  // namespace engine
