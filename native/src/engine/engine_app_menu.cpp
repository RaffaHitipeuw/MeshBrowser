#include "engine/engine_app_menu.h"

namespace engine {
namespace {

cef_color_t Argb(int r, int g, int b) {
  return CefColorSetARGB(255, r, g, b);
}

}  // namespace

void ApplyAppMenuColors(CefRefPtr<CefMenuModel> menu, bool dark) {
  if (!menu) {
    return;
  }
  const cef_color_t hover = dark ? Argb(0x38, 0x38, 0x38) : Argb(0xe8, 0xe8, 0xe8);
  const cef_color_t text = dark ? Argb(0xe4, 0xe4, 0xe4) : Argb(0x1a, 0x19, 0x1a);
  const cef_color_t muted = dark ? Argb(0x9e, 0x9e, 0x9e) : Argb(0x75, 0x75, 0x75);

  // 0 removes explicit item background color so items seamlessly match the container background.
  menu->SetColorAt(-1, CEF_MENU_COLOR_BACKGROUND, 0);
  menu->SetColorAt(-1, CEF_MENU_COLOR_BACKGROUND_HOVERED, hover);
  menu->SetColorAt(-1, CEF_MENU_COLOR_TEXT, text);
  menu->SetColorAt(-1, CEF_MENU_COLOR_TEXT_HOVERED, text);
  menu->SetColorAt(-1, CEF_MENU_COLOR_TEXT_ACCELERATOR, muted);
  menu->SetColorAt(-1, CEF_MENU_COLOR_TEXT_ACCELERATOR_HOVERED, muted);
  const size_t count = menu->GetCount();
  for (size_t i = 0; i < count; ++i) {
    const int idx = static_cast<int>(i);
    menu->SetColorAt(idx, CEF_MENU_COLOR_BACKGROUND, 0);
    menu->SetColorAt(idx, CEF_MENU_COLOR_BACKGROUND_HOVERED, hover);
    menu->SetColorAt(idx, CEF_MENU_COLOR_TEXT, text);
    menu->SetColorAt(idx, CEF_MENU_COLOR_TEXT_HOVERED, text);
    menu->SetColorAt(idx, CEF_MENU_COLOR_TEXT_ACCELERATOR, muted);
    menu->SetColorAt(idx, CEF_MENU_COLOR_TEXT_ACCELERATOR_HOVERED, muted);
    if (auto sub = menu->GetSubMenuAt(idx)) {
      ApplyAppMenuColors(sub, dark);
    }
  }
}

}  // namespace engine
