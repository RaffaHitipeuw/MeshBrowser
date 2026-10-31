#include "engine/engine_keyboard_policy.h"

namespace engine {
namespace {

/** True for a letter key, regardless of the case the layout reports. */
bool IsLetter(int key_code, char letter) {
  const char upper = static_cast<char>(letter);
  const char lower = static_cast<char>(letter - 'A' + 'a');
  return key_code == upper || key_code == lower;
}

}  // namespace

KeyAction ResolveKeyAction(const KeyEvent& event, const KeyContext& context) {
  // The DevTools window has its own key handling; browser shortcuts stay
  // out of the way while it has the focus.
  if (!context.is_devtools_browser) {
    if (event.key_code == keys::kF12) {
      return KeyAction::ToggleDevTools;
    }
    if (event.ctrl && event.shift && !event.alt &&
        IsLetter(event.key_code, keys::kI)) {
      return KeyAction::ToggleDevTools;
    }
    if (event.ctrl && !event.shift && !event.alt &&
        IsLetter(event.key_code, keys::kL)) {
      return KeyAction::FocusAddressBar;
    }
    if (event.ctrl && !event.shift && !event.alt &&
        IsLetter(event.key_code, keys::kF)) {
      return KeyAction::ToggleFindBar;
    }
  }

  // The reload shortcuts belong to the page: they only apply while the
  // content pane is the focused, visible pane.
  if (!context.is_content_browser || !context.content_visible) {
    return KeyAction::None;
  }
  if (event.key_code == keys::kF5) {
    return (event.shift || event.ctrl) ? KeyAction::ReloadPageIgnoringCache
                                       : KeyAction::ReloadPage;
  }
  if (event.ctrl && IsLetter(event.key_code, keys::kR)) {
    return event.shift ? KeyAction::ReloadPageIgnoringCache
                       : KeyAction::ReloadPage;
  }
  return KeyAction::None;
}

}  // namespace engine
