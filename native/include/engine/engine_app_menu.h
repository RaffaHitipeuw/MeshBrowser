#pragma once

#include "include/cef_menu_model.h"

namespace engine {

/**
 * The engine's app-menu mechanism: how a native menu is painted.
 *
 * The engine owns the look of the menu surface (background, hover, text and
 * accelerator colours). The product decides whether the menu is dark or
 * light, and owns the menu content (items, commands, accelerators).
 */
void ApplyAppMenuColors(CefRefPtr<CefMenuModel> menu, bool dark);

}  // namespace engine
