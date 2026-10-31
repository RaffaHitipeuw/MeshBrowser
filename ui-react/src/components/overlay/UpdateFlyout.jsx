// Update flyout (view "update").
//
// Port of the update flyout of ui/js/overlay.js. The class names
// (.update-flyout-*, .update-btn-*) come from ui/css/update.css.

import { useState } from "react";

import Icon from "../Icon.jsx";
import { bridge } from "../../services/bridge.js";
import { RELEASES_URL, hideOverlay } from "../../services/overlayController.js";

/**
 * @param {{payload: object, panelRef?: React.Ref<HTMLDivElement>}} props
 */
export default function UpdateFlyout({ payload, panelRef }) {
  const data = payload || {};
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const onDownload = async () => {
    if (!data.downloadUrl || !bridge.available()) {
      window.open(data.releaseUrl || RELEASES_URL, "_blank", "noopener");
      return;
    }
    setBusy(true);
    setError("");
    setLabel("Preparing update…");
    try {
      await bridge.call("app.installUpdate", {
        downloadUrl: data.downloadUrl,
        sha256: data.sha256,
      });
      setLabel("Installing and restarting…");
    } catch (err) {
      setBusy(false);
      setLabel("Retry update");
      setError(err?.message || "Could not start the update.");
    }
  };

  return (
    <div
      className="update-flyout"
      role="dialog"
      aria-labelledby="update-flyout-title"
      ref={panelRef}
    >
      <div className="update-flyout-header">
        <div className="update-flyout-badge-wrap">
          <img
            className="update-flyout-logo"
            src="assets/mesh-brand/mesh_kecil.svg"
            alt="MeshBrowser"
          />
          <div className="update-flyout-header-text">
            <span className="update-flyout-title" id="update-flyout-title">
              Update Available
            </span>
            <span className="update-flyout-version">
              {data.version || "New version"}
            </span>
          </div>
        </div>
        <button
          type="button"
          className="update-flyout-close"
          aria-label="Close update panel"
          onClick={() => hideOverlay()}
        >
          <Icon name="x" />
        </button>
      </div>

      <div className="update-flyout-content">
        <p className="update-flyout-notes">
          {data.notes || "A new version of MeshBrowser is available."}
        </p>
        {error ? <p className="update-flyout-notes">{error}</p> : null}
      </div>

      <div className="update-flyout-actions">
        <button
          type="button"
          className="update-btn-release"
          disabled={busy}
          onClick={onDownload}
        >
          <Icon name="download" />
          <span>{label || "Download Update"}</span>
        </button>
        <button
          type="button"
          className="update-btn-dismiss"
          onClick={() => hideOverlay()}
        >
          Later
        </button>
      </div>
    </div>
  );
}
