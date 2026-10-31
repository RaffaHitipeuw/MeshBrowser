// Info page.
//
// Port of ui/js/info.js. The markup mirrors ui/info.html exactly: the
// `.hist` wrapper, the aside with the two `data-nav` buttons, the
// `#info-panel-about` section with the hero and the facts, and the
// `#info-panel-updates` section with the update notes.
//
// The update notes come from the static list in
// `ui-react/src/services/updatesData.js` (port of ui/js/updates-data.js);
// they are rendered as React elements, never as injected HTML.

import { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import { installGlobalThemeApi, theme } from "../services/theme.js";
import { listUpdates } from "../services/updatesData.js";

import InfoNav from "../components/info/InfoNav.jsx";
import AboutPanel from "../components/info/AboutPanel.jsx";
import UpdatesPanel from "../components/info/UpdatesPanel.jsx";

export default function InfoPage() {
  const [panel, setPanel] = useState("about");
  const [updates, setUpdates] = useState([]);
  const [updatesLoaded, setUpdatesLoaded] = useState(false);
  const [status, setStatus] = useState("");
  const [statusVisible, setStatusVisible] = useState(false);
  // Bumped when the theme changes so the brand marks are re-rendered.
  const [, setThemeTick] = useState(0);

  useEffect(() => {
    return theme.onThemeChange(() => setThemeTick((tick) => tick + 1));
  }, []);

  const loadUpdates = useCallback(() => {
    if (updatesLoaded) {
      return;
    }
    setStatus("Loading updates…");
    setStatusVisible(true);
    try {
      const list = listUpdates();
      setUpdates(Array.isArray(list) ? list : []);
      setUpdatesLoaded(true);
      if (!list.length) {
        setStatus("No updates yet.");
        setStatusVisible(true);
      } else {
        setStatus("");
        setStatusVisible(false);
      }
    } catch (_) {
      setStatus("Could not load update notes.");
      setStatusVisible(true);
    }
  }, [updatesLoaded]);

  const show = useCallback(
    (id) => {
      const next = String(id || "about");
      setPanel(next);
      if (next === "updates") {
        loadUpdates();
      }
    },
    [loadUpdates]
  );

  return (
    <div className="hist">
      <InfoNav active={panel} onSelect={show} />

      <main className="hist-main">
        <AboutPanel active={panel === "about"} />
        <UpdatesPanel
          updates={updates}
          status={status}
          statusVisible={statusVisible}
          active={panel === "updates"}
        />
      </main>
    </div>
  );
}

installGlobalThemeApi();
theme.boot();

const container = document.getElementById("app-root");
if (container) {
  document.documentElement.setAttribute("data-mesh-ui", "info");
  createRoot(container).render(<InfoPage />);
}
