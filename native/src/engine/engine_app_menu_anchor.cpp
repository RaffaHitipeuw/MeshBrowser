#include "engine/engine_app_menu_anchor.h"

namespace engine {

AppMenuAnchor NormalizeAppMenuAnchor(int left, int top, int right, int bottom) {
  AppMenuAnchor anchor;
  anchor.left = left;
  anchor.top = top;
  // A degenerate payload (right <= left) would flip the menu to the wrong
  // side of the window; collapse the edge instead.
  anchor.right = right > left ? right : left;
  anchor.bottom = bottom > top ? bottom : top;
  return anchor;
}

}  // namespace engine
