// The "Updates" panel of the info page.
//
// Mirrors the `#info-panel-updates` section of ui/info.html: the section
// title, the status line and the list of update cards. The list comes from
// the static update data (ui-react/src/services/updatesData.js).

import React from "react";

import { renderMarkdown } from "./Markdown.jsx";

/**
 * Formats an ISO date the way the legacy script did: a long month name in
 * the current locale, parsed at midday UTC so the day never shifts.
 */
export function formatDate(iso) {
  const raw = String(iso || "").trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    return raw || "Update";
  }
  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return raw;
  }
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date);
  } catch (_) {
    return raw;
  }
}

export default function UpdatesPanel({ updates, status, statusVisible, active = false }) {
  return (
    <section
      className={active ? "info-panel is-active" : "info-panel"}
      id="info-panel-updates"
      data-panel="updates"
      hidden={!active}
    >
      <h2 className="info-section-title">Updates</h2>
      <p className="info-updates-status" id="info-updates-status" hidden={!statusVisible}>
        {status}
      </p>
      <div className="info-updates" id="info-updates" aria-live="polite">
        {updates.map((entry) => (
          <article className="info-update" key={entry.id}>
            <p className="info-update-date">{formatDate(entry.date)}</p>
            {entry.title ? (
              <h3 className="info-update-title">{entry.title}</h3>
            ) : null}
            <div className="info-update-body">{renderMarkdown(entry.markdown || "")}</div>
          </article>
        ))}
      </div>
    </section>
  );
}
