// The "About" panel of the info page.
//
// Mirrors the `#info-panel-about` section of ui/info.html: the hero block
// with the brand mark, the info card with the lead paragraph and the list
// of facts.

import React from "react";

import { theme } from "../../services/theme.js";

const FACTS = [
  { term: "Product", value: "Mesh Engine" },
  { term: "Engine", value: "Chromium Embedded Framework (CEF)" },
  { term: "Search", value: "Google, Brave, DuckDuckGo, and other web search engines" },
  { term: "Ad blocking", value: "Brave adblock-rust (EasyList / EasyPrivacy)" },
  { term: "Status", value: "Preview — UI is being worked on" },
];

export default function AboutPanel({ active = true }) {
  return (
    <section
      className={active ? "info-panel is-active" : "info-panel"}
      id="info-panel-about"
      data-panel="about"
      hidden={!active}
    >
      <div className="info-hero">
        <img
          className="info-hero-mark"
          src={theme.brandMark()}
          alt=""
          width="56"
          height="56"
        />
        <div className="info-hero-text">
          <h1 className="info-title">Mesh Engine</h1>
          <p className="info-subtitle">Open-source desktop browser</p>
        </div>
      </div>
      <div className="info-card">
        <p className="info-lead">
          A lightweight desktop browser with Chromium under the hood, built-in
          privacy controls, and a start page that stays out of the way.
        </p>
        <dl className="info-facts">
          {FACTS.map((fact) => (
            <div className="info-fact" key={fact.term}>
              <dt>{fact.term}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
