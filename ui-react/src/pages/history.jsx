// The history page.
//
// Port of ui/js/history.js: the day grouping, the multi selection (with the
// shift-click range) and the "more" menu of a row.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { createPortal } from "react-dom";

import ListPage from "../components/list/ListPage.jsx";
import Favicon from "../components/list/Favicon.jsx";
import { bridge } from "../services/bridge.js";
import { installGlobalThemeApi, theme } from "../services/theme.js";
import { dayKey, dayLabel, timeLabel } from "../lib/time.js";

function RowMenu({ anchor, onRemove }) {
  const [position, setPosition] = useState({ left: 8, top: 8 });

  useEffect(() => {
    if (!anchor) {
      return;
    }
    const rect = anchor.getBoundingClientRect();
    setPosition({
      left: Math.max(8, rect.right - 180),
      top: rect.bottom + 4,
    });
  }, [anchor]);

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="hist-menu" role="menu" style={{ left: `${position.left}px`, top: `${position.top}px` }}>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onRemove();
        }}
      >
        Remove from history
      </button>
    </div>,
    document.body
  );
}

export default function HistoryPage() {
  const [entries, setEntries] = useState([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState([]);
  const [menu, setMenu] = useState(null);
  const lastCheckedIndex = useRef(-1);

  const load = useCallback(() => {
    bridge
      .historyList()
      .then((result) => {
        setEntries(Array.isArray(result && result.entries) ? result.entries : []);
      })
      .catch(() => setEntries([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return entries;
    }
    return entries.filter((entry) => {
      const title = String(entry.title || "").toLowerCase();
      const url = String(entry.url || "").toLowerCase();
      return title.includes(q) || url.includes(q);
    });
  }, [entries, query]);

  const open = useCallback((url) => {
    bridge
      .call("browser.navigate", { url })
      .catch(() => {
        window.location.href = url;
      });
  }, []);

  const removeUrls = useCallback(
    (urls) => {
      const unique = Array.from(new Set(urls.filter(Boolean)));
      Promise.all(unique.map((url) => bridge.historyRemove(url).catch(() => {})))
        .then(() => {
          setSelected([]);
          load();
        });
    },
    [load]
  );

  const clearAll = useCallback(() => {
    if (!window.confirm("Delete browsing data?")) {
      return Promise.resolve();
    }
    return bridge.historyClear().catch(() => {}).then(() => load());
  }, [load]);

  const toggle = useCallback((entry, index, shiftKey) => {
    setSelected((current) => {
      const next = new Set(current);
      if (shiftKey && lastCheckedIndex.current >= 0 && lastCheckedIndex.current !== index) {
        const from = Math.min(lastCheckedIndex.current, index);
        const to = Math.max(lastCheckedIndex.current, index);
        filtered.slice(from, to + 1).forEach((item) => next.add(item.url));
      } else if (next.has(entry.url)) {
        next.delete(entry.url);
      } else {
        next.add(entry.url);
      }
      return Array.from(next);
    });
    lastCheckedIndex.current = index;
  }, [filtered]);

  // Group the rows by day, exactly like the legacy page.
  const groups = useMemo(() => {
    const out = [];
    let current = null;
    filtered.forEach((entry) => {
      const key = dayKey(entry.ts);
      if (!current || current.key !== key) {
        current = { key, label: dayLabel(entry.ts), entries: [] };
        out.push(current);
      }
      current.entries.push(entry);
    });
    return out;
  }, [filtered]);

  let flatIndex = -1;

  return (
    <ListPage
      ids={{
        navMesh: "hist-nav-mesh",
        navClear: "hist-nav-clear",
        search: "hist-search",
        q: "hist-q",
        list: "hist-list",
        empty: "hist-empty",
        actions: "hist-actions",
        removeSelected: "hist-remove-selected",
        placeholder: "Search history",
      }}
      title="History"
      navMeshLabel="Mesh Browser history"
      navClearLabel="Delete browsing data"
      query={query}
      onQueryChange={setQuery}
      emptyText="No history yet."
      emptyMatchText="No matching history."
      hasItems={filtered.length > 0}
      selection={selected}
      onRemoveSelected={removeUrls}
      onClearAll={clearAll}
    >
      {groups.map((group) => (
        <section className="hist-day-box" key={group.key}>
          <h2 className="hist-day">{group.label}</h2>
          <div className="hist-day-rows">
            {group.entries.map((entry) => {
              flatIndex += 1;
              const index = flatIndex;
              const checked = selected.includes(entry.url);
              return (
                <div className="hist-row" key={`${group.key}-${entry.url}-${index}`}>
                  <input
                    type="checkbox"
                    data-url={entry.url}
                    checked={checked}
                    onChange={(event) =>
                      toggle(entry, index, event.nativeEvent.shiftKey)
                    }
                    onClick={(event) => {
                      if (event.shiftKey) {
                        event.preventDefault();
                        toggle(entry, index, true);
                      }
                    }}
                  />
                  <span className="hist-time">{timeLabel(entry.ts)}</span>
                  <Favicon url={entry.url} />
                  <div className="hist-copy">
                    <a
                      className="hist-link"
                      href={entry.url}
                      onClick={(event) => {
                        event.preventDefault();
                        open(entry.url);
                      }}
                    >
                      {entry.title || entry.url}
                    </a>
                  </div>
                  <button
                    type="button"
                    className="hist-more"
                    aria-label="More actions"
                    aria-expanded={menu && menu.url === entry.url ? "true" : "false"}
                    onClick={(event) => {
                      event.stopPropagation();
                      setMenu(
                        menu && menu.url === entry.url
                          ? null
                          : { url: entry.url, anchor: event.currentTarget }
                      );
                    }}
                  >
                    ⋮
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      ))}
      {menu && (
        <RowMenu
          anchor={menu.anchor}
          onRemove={() => {
            const url = menu.url;
            setMenu(null);
            removeUrls([url]);
          }}
        />
      )}
    </ListPage>
  );
}

const container =
  typeof document !== "undefined" ? document.getElementById("app-root") : null;

if (container) {
  installGlobalThemeApi();
  theme.boot();
  document.documentElement.setAttribute("data-mesh-ui", "history");
  createRoot(container).render(<HistoryPage />);
}
