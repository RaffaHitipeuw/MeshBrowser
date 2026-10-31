// Side navigation of the info page.
//
// Mirrors ui/info.html: the `.hist-aside` block with the brand mark, the
// brand name "Info" and the two `data-nav` buttons. The active button
// carries `is-active`, exactly like the legacy script did.

import React from "react";

import { theme } from "../../services/theme.js";

export default function InfoNav({ active, onSelect }) {
  const items = [
    { id: "about", label: "About", elementId: "info-nav-about" },
    { id: "updates", label: "Updates", elementId: "info-nav-updates" },
  ];

  return (
    <aside className="hist-aside" aria-label="Info">
      <div className="hist-brand">
        <img
          className="hist-brand-mark"
          src={theme.brandMark()}
          alt=""
          width="28"
          height="28"
        />
        <span className="hist-brand-name">Info</span>
      </div>
      <nav className="hist-navs" aria-label="Info sections">
        {items.map((item) => {
          const selected = item.id === active;
          return (
            <button
              key={item.id}
              type="button"
              id={item.elementId}
              className={selected ? "hist-nav is-active" : "hist-nav"}
              data-nav={item.id}
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
