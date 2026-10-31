// The floating overlay page.
//
// The host shows the overlay in a dedicated browser view (ui/overlay.html).
// It is driven by the "overlay.subscribe" event stream and reports its size
// back to the host, which sizes the native view accordingly.

import { createRoot } from "react-dom/client";

import OverlayPage from "../components/overlay/OverlayPage.jsx";
import { installGlobalThemeApi, theme } from "../services/theme.js";

installGlobalThemeApi();
theme.boot();

const container =
  typeof document !== "undefined"
    ? document.getElementById("app-root") || document.getElementById("overlay-root")
    : null;

if (container) {
  document.documentElement.setAttribute("data-mesh-ui", "overlay");
  createRoot(container).render(<OverlayPage />);
}
