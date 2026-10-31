// Search engine group of the settings page.
//
// Mirrors the "Search engine" section of ui/settings.html: a labelled
// `<select id="settings-search-engine">` with the seven supported engines.
// The option order is the order of the legacy markup — it is part of the
// DOM contract and must not be sorted.

import React from "react";

export const SEARCH_ENGINE_OPTIONS = [
  { value: "google", label: "Google" },
  { value: "brave", label: "Brave" },
  { value: "duckduckgo", label: "DuckDuckGo" },
  { value: "qwant", label: "Qwant" },
  { value: "bing", label: "Bing" },
  { value: "startpage", label: "Startpage" },
  { value: "ecosia", label: "Ecosia" },
];

export const DEFAULT_ENGINE_ID = "google";

export function normalizeEngineId(id) {
  return SEARCH_ENGINE_OPTIONS.some((option) => option.value === id)
    ? id
    : DEFAULT_ENGINE_ID;
}

export default function SearchEngineGroup({ value, onChange }) {
  return (
    <section className="settings-group" aria-labelledby="settings-search-title">
      <h2 id="settings-search-title">Search engine</h2>
      <p className="settings-description">
        Used for searches from the address bar and new tab.
      </p>
      <div className="settings-card settings-field">
        <label htmlFor="settings-search-engine">Default search engine</label>
        <select
          id="settings-search-engine"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          {SEARCH_ENGINE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}
