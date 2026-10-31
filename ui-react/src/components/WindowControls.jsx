// The window buttons of the titlebar.
//
// Port of ui/js/features/shell/titlebar.js and
// ui/js/features/shell/window-icons.js. The glyphs are the native Windows
// characters (Segoe Fluent Icons / Segoe MDL2 Assets) — the same ones the
// legacy module rendered.

import { useCallback, useEffect, useState } from "react";
import { bridge } from "../services/bridge.js";

const GLYPHS = {
  minimize: "", // ChromeMinimize
  maximize: "", // ChromeMaximize
  restore: "", // ChromeRestore
  close: "", // ChromeClose
};

export default function WindowControls() {
  const [maximized, setMaximized] = useState(false);

  const syncMaximized = useCallback(async () => {
    try {
      const state = await bridge.windowIsMaximized();
      setMaximized(Boolean(state && state.maximized));
    } catch (_) {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    syncMaximized();
    window.addEventListener("resize", syncMaximized);
    return () => window.removeEventListener("resize", syncMaximized);
  }, [syncMaximized]);

  useEffect(() => {
    document.body.classList.toggle("is-maximized", maximized);
  }, [maximized]);

  const onMaximize = useCallback(async () => {
    try {
      const result = await bridge.windowToggleMaximize();
      setMaximized(Boolean(result && result.maximized));
    } catch (err) {
      console.error(err);
    }
  }, []);

  return (
    <div className="titlebar-controls">
      <button type="button" className="titlebar-btn" id="titlebar-min" aria-label="Minimize" onClick={() => bridge.windowMinimize().catch(console.error)}>
        <span className="window-icon" aria-hidden="true">{GLYPHS.minimize}</span>
      </button>
      <button
        type="button"
        className="titlebar-btn"
        id="titlebar-max"
        aria-label={maximized ? "Restore" : "Maximize"}
        onClick={onMaximize}
      >
        <span className="window-icon" id="icon-maximize" aria-hidden="true" hidden={maximized}>
          {GLYPHS.maximize}
        </span>
        <span className="window-icon hidden" id="icon-restore" aria-hidden="true" hidden={!maximized}>
          {GLYPHS.restore}
        </span>
      </button>
      <button type="button" className="titlebar-btn close" id="titlebar-close" aria-label="Close" onClick={() => bridge.windowClose().catch(console.error)}>
        <span className="window-icon" aria-hidden="true">{GLYPHS.close}</span>
      </button>
    </div>
  );
}
