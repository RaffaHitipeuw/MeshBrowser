// Side navigation of the settings page.
//
// The markup mirrors ui/settings.html exactly: the `.hist-aside` block with
// the brand mark, the brand name and the two `data-settings-nav` buttons.
// The active button carries `is-active` and `aria-current="page"`.

import React from "react";

import { theme } from "../../services/theme.js";

export default function SettingsNav({ active, onSelect }) {
  const items = [
    { id: "general", label: "General" },
    { id: "privacy", label: "Privacy & security" },
  ];

  return (
    <aside className="hist-aside" aria-label="Settings">
      <div className="hist-brand">
        <img
          className="hist-brand-mark"
          src={theme.brandMark()}
          alt=""
          width="28"
          height="28"
        />
        <span className="hist-brand-name">Settings</span>
      </div>
      <nav className="hist-navs" aria-label="Settings sections">
        {items.map((item) => {
          const selected = item.id === active;
          return (
            <button
              key={item.id}
              type="button"
              className={selected ? "hist-nav is-active" : "hist-nav"}
              data-settings-nav={item.id}
              aria-current={selected ? "page" : undefined}
              onClick={() => onSelect(item.id)}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
