// Appearance group of the settings page.
//
// Mirrors the "Appearance" section of ui/settings.html: three radio inputs
// named "appearance" inside `.settings-card.settings-options`.

import React from "react";

const OPTIONS = [
  { value: "system", label: "System default" },
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
];

export default function AppearanceGroup({ value, onChange }) {
  return (
    <section className="settings-group" aria-labelledby="settings-appearance-title">
      <h2 id="settings-appearance-title">Appearance</h2>
      <p className="settings-description">Set the browser theme.</p>
      <div className="settings-card settings-options" id="settings-appearance">
        {OPTIONS.map((option) => (
          <label className="settings-option" key={option.value}>
            <span>{option.label}</span>
            <input
              type="radio"
              name="appearance"
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
          </label>
        ))}
      </div>
    </section>
  );
}
