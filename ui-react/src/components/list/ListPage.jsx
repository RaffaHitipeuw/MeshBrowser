// The layout of the list pages (bookmarks, history, downloads).
//
// Port of the markup of ui/bookmarks.html, ui/history.html and
// ui/downloads.html. The ids differ per page, so they are passed in.

import { useEffect, useState } from "react";

export default function ListPage({
  ids,
  title,
  navMeshLabel,
  navClearLabel,
  query,
  onQueryChange,
  emptyText,
  emptyMatchText,
  hasItems,
  selection,
  onRemoveSelected,
  onClearAll,
  children,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [clearActive, setClearActive] = useState(false);

  const activate = (clear) => {
    setClearActive(clear);
    if (clear && typeof onClearAll === "function") {
      const result = onClearAll();
      // The legacy navigation restored the "mesh" entry after the action.
      if (result && typeof result.then === "function") {
        result.finally(() => setClearActive(false));
      }
    }
  };

  useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }
    const close = () => setMenuOpen(false);
    document.addEventListener("pointerdown", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", close, true);
      window.removeEventListener("resize", close);
    };
  }, [menuOpen]);

  return (
    <div className="hist">
      <aside className="hist-aside" aria-label={title}>
        <div className="hist-brand">
          <img className="hist-brand-mark" src="assets/mesh-brand/mesh_kecil.svg" alt="" width="28" height="28" />
          <span className="hist-brand-name">{title}</span>
        </div>
        <nav className="hist-navs" aria-label={`${title} actions`}>
          <button
            type="button"
            className={`hist-nav ${clearActive ? "" : "is-active"}`}
            id={ids.navMesh}
            data-nav="mesh"
            onClick={() => activate(false)}
          >
            {navMeshLabel}
          </button>
          <button
            type="button"
            className={`hist-nav ${clearActive ? "is-active" : ""}`}
            id={ids.navClear}
            data-nav="clear"
            onClick={() => activate(true)}
          >
            {navClearLabel}
          </button>
        </nav>
      </aside>

      <main className="hist-main">
        <div className="hist-search-row">
          <form className="hist-search" id={ids.search} role="search" autoComplete="off" onSubmit={(event) => event.preventDefault()}>
            <svg className="hist-search-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M20 20l-3.5-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              className="hist-search-input"
              id={ids.q}
              type="search"
              name="q"
              placeholder={ids.placeholder}
              spellcheck="false"
              aria-label={ids.placeholder}
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
            />
          </form>
          {ids.actions ? (
            <div className="hist-actions" id={ids.actions} hidden={!selection || selection.length === 0}>
              <button
                type="button"
                className="hist-action"
                id={ids.removeSelected}
                aria-label="Remove selected"
                onClick={() => onRemoveSelected(selection)}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                  <path
                    d="M5 7h14M10 11v6M14 11v6M9 7V5h6v2M7 7l1 12h8l1-12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          ) : null}
        </div>

        <div className="hist-list" id={ids.list} aria-live="polite">
          {children}
        </div>
        <p className="hist-empty" id={ids.empty} hidden={hasItems}>
          {query.trim() ? emptyMatchText : emptyText}
        </p>
      </main>
    </div>
  );
}
