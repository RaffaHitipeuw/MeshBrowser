#pragma once

namespace engine {

/**
 * Where the app menu is anchored.
 *
 * The engine owns the anchoring rule: the native menu opens at the
 * bottom-right corner of the element that triggered it. The anchor rect is
 * normalised so that a degenerate payload (a right edge that is not to the
 * right of the left edge, or a bottom edge that is not below the top edge)
 * still yields a well-formed point instead of flipping the menu to the
 * wrong side of the window.
 *
 * This header is CEF-free on purpose: the rule is pure arithmetic and is
 * unit-tested without linking Chromium.
 */
struct AppMenuAnchor {
  /** Left edge of the trigger element, in window coordinates. */
  int left = 0;
  /** Top edge of the trigger element, in window coordinates. */
  int top = 0;
  /** Right edge of the trigger element, in window coordinates. */
  int right = 0;
  /** Bottom edge of the trigger element, in window coordinates. */
  int bottom = 0;

  /** The window-relative x the menu opens at (the right edge). */
  int x() const { return right; }
  /** The window-relative y the menu opens at (the bottom edge). */
  int y() const { return bottom; }
};

/**
 * Normalises a raw anchor rect coming from the UI layer.
 *
 * The result always satisfies right >= left and bottom >= top.
 */
AppMenuAnchor NormalizeAppMenuAnchor(int left, int top, int right, int bottom);

}  // namespace engine
