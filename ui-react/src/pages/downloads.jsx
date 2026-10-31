// The downloads page.
//
// Port of ui/js/downloads.js: the day grouping, the site icon with its
// fallback, the file icon and the three row actions (copy link, show in
// folder, remove).

import { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import React from "react";

import ListPage from "../components/list/ListPage.jsx";
import { bridge } from "../services/bridge.js";
import { installGlobalThemeApi, theme } from "../services/theme.js";
import { dayKey, dayLabel } from "../lib/time.js";

function extensionOf(filename) {
  const value = String(filename || "");
  const dot = value.lastIndexOf(".");
  if (dot < 0 || dot === value.length - 1) {
    return "";
  }
  return value.slice(dot + 1).toLowerCase();
}

/** Port of fileKind() of the legacy downloads page. */
function fileKind(filename, mime) {
  const ext = extensionOf(filename);
  const m = String(mime || "").toLowerCase();
  if (
    ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "avif"].includes(ext) ||
    m.startsWith("image/")
  ) {
    return "image";
  }
  if (["mp4", "mkv", "webm", "mov", "avi", "m4v"].includes(ext) || m.startsWith("video/")) {
    return "video";
  }
  if (["mp3", "wav", "flac", "ogg", "m4a", "aac"].includes(ext) || m.startsWith("audio/")) {
    return "audio";
  }
  if (["zip", "rar", "7z", "tar", "gz", "tgz", "bz2"].includes(ext)) {
    return "archive";
  }
  if (ext === "pdf" || m === "application/pdf") {
    return "pdf";
  }
  if (["exe", "msi", "dmg", "appx", "msix", "deb", "rpm"].includes(ext)) {
    return "app";
  }
  if (["js", "ts", "tsx", "jsx", "py", "rs", "go", "c", "cpp", "h", "java", "rb", "php"].includes(ext)) {
    return "code";
  }
  if (["doc", "docx", "odt", "rtf", "txt", "md"].includes(ext)) {
    return "doc";
  }
  return "file";
}

function originFromUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }
    return parsed.origin;
  } catch (_) {
    return "";
  }
}

/** Port of sourceInfo() of the legacy downloads page. */
function sourceInfo(entry) {
  const candidates = [entry && entry.originalUrl, entry && entry.url].filter(
    (value) => typeof value === "string" && value.trim()
  );
  for (const raw of candidates) {
    const value = raw.trim();
    if (value.startsWith("blob:")) {
      const origin = originFromUrl(value.slice(5));
      if (origin) {
        return { display: origin, href: origin };
      }
      continue;
    }
    const origin = originFromUrl(value);
    if (origin) {
      return { display: origin, href: value };
    }
  }
  if (candidates[0]) {
    return { display: candidates[0], href: candidates[0] };
  }
  return { display: "", href: "" };
}

/** Port of stateLabel() of the legacy downloads page. */
function stateLabel(entry) {
  const state = String(entry.state || "");
  if (state === "in_progress") {
    const pct = Number(entry.percent);
    if (Number.isFinite(pct) && pct >= 0) {
      return `${pct}%`;
    }
    return "Downloading…";
  }
  if (state === "canceled") {
    return "Canceled";
  }
  if (state === "interrupted") {
    return "Interrupted";
  }
  return "";
}

function siteIconCandidates(url, originalUrl) {
  const hosts = [];
  const pushHost = (value) => {
    try {
      let raw = String(value || "");
      if (raw.startsWith("blob:")) {
        raw = raw.slice(5);
      }
      const parsed = new URL(raw);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return;
      }
      hosts.push(parsed.hostname, parsed.hostname.replace(/^www\./, ""));
    } catch (_) {
      /* ignore */
    }
  };
  pushHost(originalUrl);
  pushHost(url);
  const unique = Array.from(new Set(hosts.filter(Boolean)));
  const out = [];
  unique.forEach((host) => {
    const bare = host.replace(/^www\./, "");
    out.push(
      `https://icons.duckduckgo.com/ip3/${encodeURIComponent(host)}.ico`,
      `https://www.google.com/s2/favicons?domain=${encodeURIComponent(bare)}&sz=64`,
      `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`,
      `https://logo.clearbit.com/${encodeURIComponent(bare)}`
    );
  });
  return out;
}

function SiteIcon({ entry }) {
  const candidates = siteIconCandidates(entry.url, entry.originalUrl);
  const [index, setIndex] = useState(0);
  const src = candidates[Math.min(index, Math.max(0, candidates.length - 1))];
  return (
    <span
      className={`hist-site-icon ${candidates.length ? "" : "is-fallback"}`}
      aria-hidden="true"
    >
      {candidates.length ? (
        <img
          src={src}
          alt=""
          draggable={false}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setIndex((current) => current + 1)}
        />
      ) : (
        <span className={`hist-file-icon is-${fileKind(entry.filename, entry.mime)}`} />
      )}
    </span>
  );
}

function ActionButton({ label, path, children, onClick }) {
  return (
    <button
      type="button"
      className="hist-tool"
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
    >
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        {path}
      </svg>
    </button>
  );
}

async function copyDownloadLink(url) {
  const value = String(url || "");
  if (!value) {
    return;
  }
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }
  } catch (_) {
    /* fall through */
  }
  const input = document.createElement("textarea");
  input.value = value;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.left = "-9999px";
  document.body.appendChild(input);
  input.select();
  try {
    document.execCommand("copy");
  } catch (_) {
    /* ignore */
  }
  input.remove();
}

export default function DownloadsPage() {
  const [entries, setEntries] = useState([]);
  const [query, setQuery] = useState("");

  const load = useCallback(() => {
    bridge
      .downloadsList()
      .then((result) => {
        setEntries(Array.isArray(result && result.entries) ? result.entries : []);
      })
      .catch(() => setEntries([]));
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 4000);
    return () => window.clearInterval(timer);
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return entries;
    }
    return entries.filter((entry) => {
      const filename = String(entry.filename || "").toLowerCase();
      const url = String(entry.url || "").toLowerCase();
      return filename.includes(q) || url.includes(q);
    });
  }, [entries, query]);

  const open = useCallback((url) => {
    bridge
      .call("browser.navigate", { url })
      .catch(() => {
        window.location.href = url;
      });
  }, []);

  const removeIds = useCallback(
    (ids) => {
      const unique = Array.from(new Set(ids.filter(Boolean)));
      Promise.all(unique.map((id) => bridge.downloadsRemove(id).catch(() => {}))).then(() => load());
    },
    [load]
  );

  const clearAll = useCallback(() => {
    if (!window.confirm("Clear downloads?")) {
      return Promise.resolve();
    }
    return bridge.downloadsClear().catch(() => {}).then(() => load());
  }, [load]);

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

  return (
    <ListPage
      ids={{
        navMesh: "dl-nav-mesh",
        navClear: "dl-nav-clear",
        search: "dl-search",
        q: "dl-q",
        list: "dl-list",
        empty: "dl-empty",
        placeholder: "Search downloads",
      }}
      title="Downloads"
      navMeshLabel="Mesh Engine downloads"
      navClearLabel="Clear downloads"
      query={query}
      onQueryChange={setQuery}
      emptyText="No downloads yet."
      emptyMatchText="No matching downloads."
      hasItems={filtered.length > 0}
      onClearAll={clearAll}
    >
      {groups.map((group) => (
        <React.Fragment key={group.key}>
          <h2 className="hist-day">{group.label}</h2>
          {group.entries.map((entry) => {
            const source = sourceInfo(entry);
            const status = stateLabel(entry);
            return (
              <article className="hist-file-box" key={entry.id || entry.url}>
                <div className="hist-row">
                  <SiteIcon entry={entry} />
                  <div className="hist-copy">
                    <div className="hist-filename">{entry.filename || entry.url || "download"}</div>
                    {source.display ? (
                      <a
                        className="hist-from"
                        href={source.href || source.display}
                        onClick={(event) => {
                          event.preventDefault();
                          open(source.href || source.display);
                        }}
                      >
                        {status ? `${status} · From ${source.display}` : `From ${source.display}`}
                      </a>
                    ) : (
                      <div className="hist-domain">{status || " "}</div>
                    )}
                  </div>
                  <div className="hist-tools">
                    <ActionButton
                      label="Copy download link"
                      path={
                        <path d="M10 13a5 5 0 007.07 0l1.41-1.41a5 5 0 00-7.07-7.07L10 5.93M14 11a5 5 0 00-7.07 0L5.52 12.4a5 5 0 007.07 7.07L14 18.07" />
                      }
                      onClick={() => copyDownloadLink(source.href || entry.url || entry.originalUrl)}
                    />
                    <ActionButton
                      label="Show in folder"
                      path={<path d="M3 8a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />}
                      onClick={() => {
                        if (!entry.path) {
                          return;
                        }
                        bridge.downloadsShowInFolder(entry.path).catch(() => {});
                      }}
                    />
                    <ActionButton
                      label="Remove from downloads"
                      path={<path d="M6 6l12 12M18 6L6 18" />}
                      onClick={() => removeIds([entry.id])}
                    />
                  </div>
                </div>
              </article>
            );
          })}
        </React.Fragment>
      ))}
    </ListPage>
  );
}

const container =
  typeof document !== "undefined" ? document.getElementById("app-root") : null;

if (container) {
  installGlobalThemeApi();
  theme.boot();
  document.documentElement.setAttribute("data-mesh-ui", "downloads");
  createRoot(container).render(<DownloadsPage />);
}
