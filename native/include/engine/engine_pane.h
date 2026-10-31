#pragma once

namespace engine {

/**
 * The engine's view panes. A window is composed of a shell pane (the
 * product's own chrome UI), a content pane (the web page being browsed), an
 * overlay pane (floating menus/tips) and a DevTools pane.
 *
 * This is engine vocabulary: the engine routes network filtering, layout and
 * event fan-out by pane, but knows nothing about what each pane renders.
 */
enum class BrowserPane {
  Shell,
  Content,
  Overlay,
  DevTools,
};

}  // namespace engine
