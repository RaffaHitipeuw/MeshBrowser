// Shields group of the settings page.
//
// Mirrors the "Shields" section of ui/settings.html: two toggle rows inside
// `.settings-card.settings-options`. The aggressive toggle is disabled while
// the blocking toggle is off — the same rule the legacy script applied.

import React from "react";

export default function AdblockGroup({ enabled, aggressive, available, onChange }) {
  return (
    <section className="settings-group" aria-labelledby="settings-shields-title">
      <h2 id="settings-shields-title">Shields</h2>
      <div className="settings-card settings-options">
        <label className="settings-option settings-toggle-row">
          <span>
            <strong>Block ads and trackers</strong>
            <small>Use the built-in filter lists on websites.</small>
          </span>
          <input
            id="settings-adblock-enabled"
            type="checkbox"
            checked={enabled}
            disabled={!available}
            onChange={(event) => onChange({ enabled: event.target.checked, aggressive })}
          />
        </label>
        <label className="settings-option settings-toggle-row">
          <span>
            <strong>Aggressive blocking</strong>
            <small>Apply additional filters for stronger protection.</small>
          </span>
          <input
            id="settings-adblock-aggressive"
            type="checkbox"
            checked={aggressive}
            disabled={!available || !enabled}
            onChange={(event) => onChange({ enabled, aggressive: event.target.checked })}
          />
        </label>
      </div>
    </section>
  );
}
