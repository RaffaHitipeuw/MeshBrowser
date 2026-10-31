// The bookmarks page.
//
// Port of ui/js/bookmarks.js.

import { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

import ListPage from "../components/list/ListPage.jsx";
import Favicon from "../components/list/Favicon.jsx";
import Icon from "../components/Icon.jsx";
import { bridge } from "../services/bridge.js";
import { installGlobalThemeApi, theme } from "../services/theme.js";
import { useNativeChannel } from "../hooks/useStore.js";

export default function BookmarksPage() {
  const [entries, setEntries] = useState([]);
  const [query, setQuery] = useState("");

  const load = useCallback(() => {
    bridge
      .bookmarksList()
      .then((result) => {
        setEntries(Array.isArray(result && result.entries) ? result.entries : []);
      })
      .catch(() => setEntries([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // The host announces bookmark changes over the browser event stream.
  useNativeChannel("browser", (msg) => {
    if (msg && msg.type === "bookmarks") {
      load();
    }
  });

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

  const remove = useCallback(
    (url) => {
      bridge.bookmarksRemove(url).catch(() => {});
      load();
    },
    [load]
  );

  const clearAll = useCallback(() => {
    if (!window.confirm("Delete all bookmarks?")) {
      return Promise.resolve();
    }
    return bridge.bookmarksClear().catch(() => {}).then(() => load());
  }, [load]);

  return (
    <ListPage
      ids={{
        navMesh: "bm-nav-mesh",
        navClear: "bm-nav-clear",
        search: "bm-search",
        q: "bm-q",
        list: "bm-list",
        empty: "bm-empty",
        placeholder: "Search bookmarks",
      }}
      title="Bookmarks"
      navMeshLabel="Mesh Engine bookmarks"
      navClearLabel="Delete all bookmarks"
      query={query}
      onQueryChange={setQuery}
      emptyText="No bookmarks yet."
      emptyMatchText="No matching bookmarks."
      hasItems={filtered.length > 0}
      onClearAll={clearAll}
    >
      {filtered.length > 0 && (
        <section className="hist-day-box">
          <div className="hist-day-rows">
            {filtered.map((entry) => (
              <div className="hist-row" key={entry.url}>
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
                  className="hist-tool"
                  aria-label="Remove bookmark"
                  title="Remove bookmark"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    remove(entry.url);
                  }}
                >
                  <Icon name="x" className="icon" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </ListPage>
  );
}

const container =
  typeof document !== "undefined" ? document.getElementById("app-root") : null;

if (container) {
  installGlobalThemeApi();
  theme.boot();
  document.documentElement.setAttribute("data-mesh-ui", "bookmarks");
  createRoot(container).render(<BookmarksPage />);
}
