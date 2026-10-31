// The overlay page root.
//
// The host shows one of four overlays (tab tip, media panel, history flyout,
// update flyout — plus the shields panel) in a dedicated native view. The page
// renders the requested view and reports the size of the rendered panel back
// to the host, because the native overlay view is sized by the UI.

import { useEffect, useLayoutEffect, useRef } from "react";

import { useNativeChannel, useStore } from "../../hooks/useStore.js";
import {
  handleOverlayEvent,
  overlayStore,
  reportOverlaySize,
  resetOverlaySizeReport,
} from "../../services/overlayController.js";
import HistoryFlyout from "./HistoryFlyout.jsx";
import MediaPanel from "./MediaPanel.jsx";
import ShieldPanel from "./ShieldPanel.jsx";
import TabTip from "./TabTip.jsx";
import UpdateFlyout from "./UpdateFlyout.jsx";

const BODY_CLASSES = [
  "is-tab-tip",
  "is-history",
  "is-media",
  "is-shields",
  "is-update",
  "is-find",
];

export default function OverlayPage() {
  const { view, payload } = useStore(overlayStore);
  const panelRef = useRef(null);

  // The host pushes "show" / "hide" over the overlay channel.
  useNativeChannel("overlay", handleOverlayEvent);

  // The stylesheet paints the page background per view (ui/css/overlay.css).
  useEffect(() => {
    document.body.classList.remove(...BODY_CLASSES);
    if (view) {
      document.body.classList.add(`is-${view}`);
    }
    return () => {
      document.body.classList.remove(...BODY_CLASSES);
    };
  }, [view]);

  // A new panel always reports its size again.
  useLayoutEffect(() => {
    resetOverlaySizeReport();
  }, [view]);

  // Measure the panel: a ResizeObserver reports every size change, the
  // animation frame reports the size right after the content changed.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) {
      return undefined;
    }
    const report = () => reportOverlaySize(panel);
    const frame = window.requestAnimationFrame(report);
    let observer = null;
    if (typeof ResizeObserver === "function") {
      observer = new ResizeObserver(report);
      observer.observe(panel);
    }
    return () => {
      window.cancelAnimationFrame(frame);
      if (observer) {
        observer.disconnect();
      }
    };
  }, [view, payload]);

  let panel = null;
  if (view === "tab-tip") {
    panel = <TabTip payload={payload} panelRef={panelRef} />;
  } else if (view === "media") {
    panel = <MediaPanel payload={payload} panelRef={panelRef} />;
  } else if (view === "history") {
    panel = <HistoryFlyout payload={payload} panelRef={panelRef} />;
  } else if (view === "update") {
    panel = <UpdateFlyout payload={payload} panelRef={panelRef} />;
  } else if (view === "shields") {
    panel = <ShieldPanel payload={payload} panelRef={panelRef} />;
  }

  return panel;
}
