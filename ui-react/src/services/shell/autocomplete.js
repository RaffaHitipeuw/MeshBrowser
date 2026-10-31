// Suggestion engine of the address bar.
//
// Port of the pure half of ui/js/features/browser/autocomplete.js: the
// top-domain list, the bookmark/history matching and the DuckDuckGo
// suggestion lookup. The rendering and the keyboard handling live in the
// React components (components/shell/Autocomplete*).

const TOP_DOMAINS = [
  "youtube.com",
  "google.com",
  "github.com",
  "reddit.com",
  "wikipedia.org",
  "amazon.de",
  "amazon.com",
  "twitter.com",
  "x.com",
  "twitch.tv",
  "netflix.com",
  "chatgpt.com",
  "openai.com",
  "discord.com",
  "spotify.com",
  "instagram.com",
  "facebook.com",
  "tiktok.com",
  "linkedin.com",
  "stackoverflow.com",
  "ebay.de",
  "ebay.com",
  "duckduckgo.com",
  "pinterest.com",
  "microsoft.com",
  "apple.com",
  "yahoo.com",
  "outlook.com",
  "gmail.com",
  "bing.com",
  "imdb.com",
  "fandom.com",
  "steampowered.com",
  "roblox.com",
  "cnn.com",
  "bbc.com",
  "spiegel.de",
  "tagesschau.de",
  "zeit.de",
  "heise.de",
  "golem.de",
  "wetter.com",
  "translate.google.com",
  "maps.google.com",
  "whatsapp.com",
  "telegram.org",
  "signal.org",
  "medium.com",
  "dev.to",
  "gitlab.com",
  "bitbucket.org",
  "npm.js.org",
  "npmjs.com",
  "claude.ai",
  "gemini.google.com",
];

export const SUGGESTION_ICONS = {
  search: "search",
  globe: "globe",
  history: "clock",
  bookmark: "bookmark",
};

export function cleanQuery(value) {
  return String(value || "").trim().toLowerCase();
}

function domainFromUrl(url) {
  try {
    const parsed = new URL(url.includes("://") ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./, "");
  } catch (_) {
    return url;
  }
}

/**
 * Bookmarks and history entries that match the query.
 * @param {string} query
 * @param {{url: string, title?: string}[]} bookmarks
 * @param {{url: string, title?: string}[]} history
 */
export function getHistoryAndBookmarkMatches(query, bookmarks = [], history = []) {
  const q = cleanQuery(query);
  if (!q) {
    return [];
  }
  const results = [];
  const seen = new Set();

  const collect = (entries, type, badge, icon) => {
    for (const entry of entries) {
      if (!entry || !entry.url) continue;
      const dom = domainFromUrl(entry.url);
      const title = String(entry.title || "").toLowerCase();
      if (
        dom.toLowerCase().includes(q) ||
        entry.url.toLowerCase().includes(q) ||
        title.includes(q)
      ) {
        if (seen.has(entry.url)) continue;
        seen.add(entry.url);
        results.push({
          type,
          title: entry.title || dom,
          value: entry.url,
          sub: entry.url,
          badge,
          icon,
        });
      }
    }
  };

  collect(bookmarks, "bookmark", "Bookmark", SUGGESTION_ICONS.bookmark);
  collect(history, "history", "History", SUGGESTION_ICONS.history);

  return results.slice(0, 4);
}

/** Top domains that start with the query. */
export function getTopDomainMatches(query) {
  const q = cleanQuery(query).replace(/^https?:\/\//, "").replace(/^www\./, "");
  if (!q) {
    return [];
  }
  const matches = [];
  for (const domain of TOP_DOMAINS) {
    if (domain.startsWith(q)) {
      matches.push({
        type: "domain",
        title: domain,
        value: `https://${domain}`,
        sub: `https://${domain}`,
        badge: "Website",
        icon: SUGGESTION_ICONS.globe,
        inlineMatch: domain,
      });
    }
  }
  return matches.slice(0, 3);
}

/** Live search suggestions from DuckDuckGo (best effort, never throws). */
export async function fetchSearchSuggestions(query) {
  const q = cleanQuery(query);
  if (!q || q.length < 2) {
    return [];
  }
  try {
    const url = `https://duckduckgo.com/ac/?q=${encodeURIComponent(q)}&type=list`;
    const res = await fetch(url, { signal: AbortSignal.timeout(600) });
    if (!res.ok) {
      return [];
    }
    const data = await res.json();
    if (Array.isArray(data) && Array.isArray(data[1])) {
      return data[1].slice(0, 5).map((item) => ({
        type: "search",
        title: String(item),
        value: String(item),
        sub: "Search with default engine",
        badge: "Search",
        icon: SUGGESTION_ICONS.search,
      }));
    }
  } catch (_) {
    // Offline or blocked
  }
  return [];
}

/**
 * Splits a text into the parts before / inside / after the match so React
 * can render the highlighted part as a <strong> element (the legacy code
 * built the same markup with innerHTML).
 *
 * @returns {{text: string, strong: boolean}[]}
 */
export function splitHighlight(text, query) {
  const q = cleanQuery(query);
  const value = String(text || "");
  if (!q) {
    return [{ text: value, strong: false }];
  }
  const lower = value.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx === -1) {
    return [{ text: value, strong: false }];
  }
  return [
    { text: value.slice(0, idx), strong: false },
    { text: value.slice(idx, idx + q.length), strong: true },
    { text: value.slice(idx + q.length), strong: false },
  ].filter((part) => part.text !== "");
}
