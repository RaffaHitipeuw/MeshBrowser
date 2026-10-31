// Shields / ad blocking panel (view "shields").
//
// Port of the shields panel of ui/js/overlay.js. The class names
// (.mesh-shield-*) are the contract with ui/css/overlay.css. The panel is
// opened by the shell's adblock button; the state itself lives in the host,
// the overlay only renders what the host reports.

import { useEffect, useState } from "react";

import { bridge } from "../../services/bridge.js";
import { sendOverlayCommand } from "../../services/overlayController.js";
import { ChevronDownIcon, GearIcon } from "./OverlayIcons.jsx";

function formatShieldCount(n) {
  return (Number(n) || 0).toLocaleString();
}

/**
 * Merges a host report with the previous state (the host only sends the
 * fields it knows about).
 */
export function normalizeShieldData(raw, previous) {
  const prev = previous || {};
  const next = raw && typeof raw === "object" ? raw : {};
  const host = String(next.host || prev.host || "");
  const enabled =
    typeof next.enabled === "boolean" ? next.enabled : Boolean(prev.enabled);
  let siteUp = true;
  if (typeof next.siteShieldsUp === "boolean") {
    siteUp = next.siteShieldsUp;
  } else if (host && Array.isArray(next.allowlist)) {
    siteUp =
      enabled &&
      !next.allowlist.some((entry) => {
        const e = String(entry || "").replace(/^www\./i, "");
        return e === host || host.endsWith(`.${e}`);
      });
  } else if (typeof prev.siteShieldsUp === "boolean") {
    siteUp = prev.siteShieldsUp;
  }
  return {
    host,
    pageUrl: String(next.pageUrl || prev.pageUrl || ""),
    enabled,
    aggressive:
      typeof next.aggressive === "boolean"
        ? next.aggressive
        : Boolean(prev.aggressive),
    siteShieldsUp: siteUp,
    blockedForHost:
      Number(next.blockedForHost != null ? next.blockedForHost : prev.blockedForHost) || 0,
    blockedTotal:
      Number(next.blockedTotal != null ? next.blockedTotal : prev.blockedTotal) || 0,
    allowlist: Array.isArray(next.allowlist) ? next.allowlist : prev.allowlist || [],
  };
}

/**
 * Applies a shields action and returns the host's new state.
 */
async function applyShieldAction(action, data) {
  const host = String(data.host || "");
  try {
    if (action === "toggle-site") {
      if (host) {
        return await bridge.browserAdblockAllowlist(host, Boolean(data.siteShieldsUp));
      }
      return await bridge.browserAdblockSet({
        enabled: !data.enabled,
        host: "",
      });
    }
    if (action === "toggle-aggressive") {
      return await bridge.browserAdblockSet({
        aggressive: !data.aggressive,
        host,
      });
    }
    if (action === "toggle-global") {
      return await bridge.browserAdblockSet({
        enabled: !data.enabled,
        host,
      });
    }
  } catch (_) {
    /* ignore */
  }
  return data;
}

/**
 * @param {{payload: object, panelRef?: React.Ref<HTMLDivElement>}} props
 */
export default function ShieldPanel({ payload, panelRef }) {
  const [state, setState] = useState(() => normalizeShieldData(payload, null));
  const [advancedOpen, setAdvancedOpen] = useState(
    Boolean(payload?.advancedOpen)
  );
  const [faviconFailed, setFaviconFailed] = useState(false);

  useEffect(() => {
    setState((previous) => normalizeShieldData(payload, previous));
  }, [payload]);

  const run = async (action) => {
    const next = await applyShieldAction(action, state);
    setState({
      ...normalizeShieldData(next, state),
      pageUrl: state.pageUrl,
      host: state.host || next.host || "",
    });
  };

  const toggleRow = (label, isOn, action) => (
    <div className="mesh-shield-advanced-row" key={label}>
      <span>{label}</span>
      <button
        type="button"
        className={`mesh-shield-toggle${isOn ? " is-on" : ""}`}
        aria-label={label}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          run(action);
        }}
      />
    </div>
  );

  return (
    <div
      className="mesh-shield"
      role="dialog"
      aria-label="Ad blocking"
      ref={panelRef}
    >
      <div className="mesh-shield-head">
        <div className="mesh-shield-site">
          <div className="mesh-shield-domain-row">
            {state.host ? (
              <img
                className="mesh-shield-favicon"
                alt=""
                referrerPolicy="no-referrer"
                hidden={faviconFailed}
                src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(state.host)}&sz=64`}
                onError={() => setFaviconFailed(true)}
              />
            ) : null}
            <div className="mesh-shield-domain">{state.host || "New Tab"}</div>
          </div>
          <div className="mesh-shield-status">
            {state.host ? (
              <>
                Shields <strong>{state.siteShieldsUp ? "up" : "down"}</strong>{" "}
                for this site
              </>
            ) : (
              <>
                Shields <strong>{state.siteShieldsUp ? "up" : "down"}</strong>
              </>
            )}
          </div>
        </div>
        <button
          type="button"
          className={`mesh-shield-toggle${state.siteShieldsUp ? " is-on" : ""}`}
          aria-label="Toggle shields"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            run("toggle-site");
          }}
        />
      </div>

      <div className="mesh-shield-stat">
        <span className="mesh-shield-stat-count">
          {formatShieldCount(state.blockedForHost)}
        </span>
        <span className="mesh-shield-stat-label">
          trackers, ads, and more blocked
        </span>
      </div>

      <div className="mesh-shield-divider" />

      <button
        type="button"
        className="mesh-shield-advanced-btn"
        aria-expanded={advancedOpen ? "true" : "false"}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setAdvancedOpen((open) => !open);
        }}
      >
        <span className="mesh-shield-icon">
          <GearIcon />
        </span>
        <span>Advanced options</span>
        <span className="mesh-shield-chevron">
          <ChevronDownIcon />
        </span>
      </button>

      <div className="mesh-shield-advanced" hidden={!advancedOpen}>
        {toggleRow("Aggressive blocking", state.aggressive, "toggle-aggressive")}
        {toggleRow("Block ads globally", state.enabled, "toggle-global")}
      </div>

      <div className="mesh-shield-foot">
        If this site seems broken, try Shields down. This may reduce Mesh
        Engine’s privacy protections.{" "}
        <a
          className="mesh-shield-learn"
          href="#"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            sendOverlayCommand({ action: "open-info" });
          }}
        >
          Learn more
        </a>
      </div>
    </div>
  );
}
