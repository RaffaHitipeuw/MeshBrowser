// The favicon of a list row.
//
// Port of bindFavicon of the legacy list pages: a list of candidates is
// tried, the last one is an inline SVG fallback.

import { useEffect, useRef, useState } from "react";

const FALLBACK_FAVICON =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><rect width="16" height="16" rx="2" fill="#3a393a"/><circle cx="8" cy="8" r="3" fill="#8a8a8a"/></svg>'
  );

export function faviconCandidates(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return [FALLBACK_FAVICON];
    }
    const host = parsed.hostname;
    const bare = host.replace(/^www\./, "");
    return [
      `${parsed.origin}/favicon.ico`,
      `https://www.google.com/s2/favicons?domain=${encodeURIComponent(bare)}&sz=64`,
      `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`,
      FALLBACK_FAVICON,
    ];
  } catch (_) {
    return [FALLBACK_FAVICON];
  }
}

export default function Favicon({ url, className = "hist-favicon" }) {
  const ref = useRef(null);
  const [index, setIndex] = useState(0);
  const candidates = faviconCandidates(url);

  useEffect(() => {
    setIndex(0);
  }, [url]);

  const src = candidates[Math.min(index, candidates.length - 1)];

  return (
    <img
      ref={ref}
      className={className}
      src={src}
      alt=""
      draggable={false}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => {
        setIndex((current) => (current + 1 < candidates.length ? current + 1 : current));
      }}
    />
  );
}
