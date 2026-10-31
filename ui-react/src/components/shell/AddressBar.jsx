// The address bar of the shell.
//
// Port of the search pill of ui/js/features/shell/titlebar.js and of
// ui/js/features/browser/autocomplete.js. The input is uncontrolled: React
// never writes to it while the user types, so the inline completion and the
// caret restoration of the legacy implementation behave exactly like before.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import Icon from "../Icon.jsx";
import { bridge } from "../../services/bridge.js";
import {
  cleanQuery,
  fetchSearchSuggestions,
  getHistoryAndBookmarkMatches,
  getTopDomainMatches,
  splitHighlight,
} from "../../services/shell/autocomplete.js";
import { isBlankUrl } from "../../lib/url.js";

export default function AddressBar({
  address,
  url,
  mode,
  loading,
  canGoBack,
  canGoForward,
  onNavigate,
  onBack,
  onForward,
  onReload,
  bookmarks,
  history,
  adblockOpen,
  onToggleAdblock,
  adblockEnabled,
  adblockButtonRef,
  registerFocus,
}) {
  const inputRef = useRef(null);
  const formRef = useRef(null);
  const [pillOpen, setPillOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [armed, setArmed] = useState(false);
  const suppressInline = useRef(false);
  const composing = useRef(false);

  // The host focuses the address bar (Ctrl+L) — the native event is handled
  // by the shell page, which calls the registered focus handler.
  useEffect(() => {
    registerFocus(() => {
      const input = inputRef.current;
      if (!input) return;
      input.focus();
      input.select();
    });
  }, [registerFocus]);

  // The pill is only opened after the first user interaction — the legacy
  // code avoided stealing the focus on startup.
  useEffect(() => {
    const arm = () => setArmed(true);
    document.addEventListener("pointerdown", arm, true);
    document.addEventListener("keydown", arm, true);
    return () => {
      document.removeEventListener("pointerdown", arm, true);
      document.removeEventListener("keydown", arm, true);
    };
  }, []);

  // The address of the active tab is shown while the input is not edited.
  useEffect(() => {
    const input = inputRef.current;
    if (!input || focused) {
      return;
    }
    const next = address || "";
    if (input.value !== next) {
      input.value = next;
      setQuery(next);
    }
  }, [address, focused]);

  // Suggestions: bookmarks, history, top domains and (best effort) the
  // search suggestions of the engine.
  useEffect(() => {
    const q = cleanQuery(query);
    if (!q || !focused) {
      setSuggestions([]);
      setActiveIndex(-1);
      return undefined;
    }
    let cancelled = false;
    const local = [
      ...getHistoryAndBookmarkMatches(q, bookmarks, history),
      ...getTopDomainMatches(q),
    ];
    setSuggestions(local);
    setActiveIndex(local.length ? 0 : -1);

    const timer = window.setTimeout(() => {
      fetchSearchSuggestions(q).then((remote) => {
        if (cancelled || !remote.length) {
          return;
        }
        setSuggestions((current) => {
          const next = [...current, ...remote];
          setActiveIndex((index) => (index < 0 ? 0 : index));
          return next;
        });
      });
    }, 140);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, focused, bookmarks, history]);

  const applyInlineCompletion = useCallback((value, matches) => {
    const input = inputRef.current;
    if (!input || suppressInline.current || composing.current) {
      return;
    }
    const q = cleanQuery(value).replace(/^https?:\/\//, "").replace(/^www\./, "");
    if (!q) {
      return;
    }
    const best = matches && matches.length ? matches[0].inlineMatch : "";
    if (!best || !best.toLowerCase().startsWith(q.toLowerCase())) {
      return;
    }
    const typedLength = value.length;
    const full = value + best.slice(q.length);
    input.value = full;
    try {
      input.setSelectionRange(typedLength, full.length);
    } catch (_) {
      /* ignore */
    }
  }, []);

  const onInput = useCallback(
    (event) => {
      const input = event.target;
      const value = input.value;
      // The user typed inside an inline completion: do not complete again.
      if (input.selectionStart !== input.selectionEnd) {
        suppressInline.current = true;
      } else {
        suppressInline.current = false;
      }
      setQuery(value);
      const q = cleanQuery(value);
      const matches = getTopDomainMatches(q);
      applyInlineCompletion(value, matches);
    },
    [applyInlineCompletion]
  );

  const go = useCallback(
    (target) => {
      const value = String(target || "").trim();
      if (!value) {
        return;
      }
      setSuggestions([]);
      setActiveIndex(-1);
      onNavigate(value);
      const input = inputRef.current;
      if (input) {
        input.blur();
      }
    },
    [onNavigate]
  );

  const submit = useCallback(
    (event) => {
      if (event) {
        event.preventDefault();
      }
      const active = suggestions[activeIndex];
      if (active) {
        go(active.value);
        return;
      }
      go(query);
    },
    [activeIndex, go, query, suggestions]
  );

  const onKeyDown = useCallback(
    (event) => {
      if (event.key === "ArrowDown" && suggestions.length) {
        event.preventDefault();
        setActiveIndex((index) => (index + 1) % suggestions.length);
        return;
      }
      if (event.key === "ArrowUp" && suggestions.length) {
        event.preventDefault();
        setActiveIndex((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
        return;
      }
      if (event.key === "Escape") {
        if (suggestions.length) {
          event.preventDefault();
          setSuggestions([]);
          setActiveIndex(-1);
          return;
        }
        const input = inputRef.current;
        if (input) {
          input.blur();
        }
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        submit(event);
      }
    },
    [activeIndex, submit, suggestions]
  );

  const browsing = mode === "browse";
  const hasPage = Boolean(browsing && url);
  const canReload = browsing && (!isBlankUrl(url) || loading || hasPage);
  let adblockHost = "";
  try {
    const parsed = new URL(url || "");
    adblockHost =
      parsed.protocol === "http:" || parsed.protocol === "https:"
        ? parsed.hostname.replace(/^www\./i, "")
        : "";
  } catch (_) {
    adblockHost = "";
  }
  const reloadLabel = loading ? "Stop" : "Reload (Shift+click: Hard Reload)";

  return (
    <>
      <div className="titlebar-nav">
        <button
          type="button"
          className={`topbar-btn ${loading ? "is-loading" : ""}`}
          id="browser-reload"
          aria-label={loading ? "Stop" : "Reload"}
          data-tooltip={reloadLabel}
          disabled={!canReload}
          onClick={(event) => onReload(event.shiftKey)}
        >
          <Icon name={loading ? "x" : "rotate-cw"} />
        </button>
        <button
          type="button"
          className="topbar-btn"
          id="browser-back"
          aria-label="Back"
          disabled={!hasPage || !canGoBack}
          onClick={() => onBack()}
        >
          <Icon name="arrow-left" />
        </button>
        <button
          type="button"
          className="topbar-btn"
          id="browser-forward"
          aria-label="Forward"
          disabled={!hasPage || !canGoForward}
          onClick={() => onForward()}
        >
          <Icon name="arrow-right" />
        </button>

        <div className={`titlebar-search ${pillOpen ? "is-open" : ""}`} id="titlebar-search">
          <form
            className="titlebar-search-form"
            id="browser-search-form"
            ref={formRef}
            autocomplete="off"
            onSubmit={submit}
          >
            <button
              type="button"
              className="titlebar-search-toggle"
              id="browser-search-toggle"
              aria-label="Search"
              data-tooltip="Search (Ctrl+L)"
              onClick={() => {
                const input = inputRef.current;
                if (!input) return;
                setPillOpen(true);
                input.focus();
                input.select();
              }}
            >
              <Icon name="search" />
            </button>
            <input
              type="text"
              className="topbar-search-input"
              id="browser-search-input"
              name="q"
              spellcheck="false"
              autoComplete="off"
              aria-label="Search or enter address"
              placeholder="Search or enter address"
              ref={inputRef}
              defaultValue={address || ""}
              onChange={onInput}
              onKeyDown={onKeyDown}
              onFocus={() => {
                setFocused(true);
                if (!armed) {
                  // No auto focus on startup — the legacy code blurred the
                  // input again until the first user interaction.
                  const input = inputRef.current;
                  if (input) {
                    input.blur();
                  }
                  return;
                }
                setPillOpen(true);
              }}
              onBlur={() => {
                setFocused(false);
                window.setTimeout(() => {
                  if (!adblockOpen) {
                    setPillOpen(false);
                  }
                }, 250);
              }}
              onCompositionStart={() => {
                composing.current = true;
              }}
              onCompositionEnd={() => {
                composing.current = false;
              }}
            />
            <span className="topbar-search-divider" aria-hidden="true" />
            <button
              type="button"
              ref={adblockButtonRef}
              className={`topbar-btn topbar-adblock ${adblockEnabled ? "is-on" : "is-off"} ${
                adblockOpen ? "is-open" : ""
              }`}
              id="browser-adblock"
              aria-label={adblockEnabled ? "Ad blocking on" : "Ad blocking off"}
              aria-haspopup="dialog"
              aria-expanded={adblockOpen ? "true" : "false"}
              data-tooltip={
                adblockHost
                  ? adblockEnabled
                    ? `Shields up for ${adblockHost}`
                    : `Shields down for ${adblockHost}`
                  : adblockEnabled
                  ? "Ad blocking on"
                  : "Ad blocking off"
              }
              onClick={() => onToggleAdblock()}
            >
              <Icon name="shield" />
            </button>

            {suggestions.length > 0 && (
              <div
                className="mesh-autocomplete-popup"
                role="listbox"
                hidden={false}
              >
                {suggestions.map((item, index) => (
                  <div
                    key={`${item.type}-${item.value}-${index}`}
                    className={`mesh-autocomplete-item ${
                      index === activeIndex ? "is-selected" : ""
                    }`}
                    role="option"
                    aria-selected={index === activeIndex ? "true" : "false"}
                    data-index={index}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      go(item.value);
                    }}
                    onMouseEnter={() => setActiveIndex(index)}
                  >
                    <span className="mesh-autocomplete-icon">
                      <Icon name={item.icon} />
                    </span>
                    <div className="mesh-autocomplete-content">
                      <div className="mesh-autocomplete-title">
                        {splitHighlight(item.title, query).map((part, partIndex) =>
                          part.strong ? (
                            <strong key={partIndex}>{part.text}</strong>
                          ) : (
                            <span key={partIndex}>{part.text}</span>
                          )
                        )}
                      </div>
                      <div className="mesh-autocomplete-sub">{item.sub || item.value}</div>
                    </div>
                    <span className="mesh-autocomplete-badge">{item.badge || "Search"}</span>
                  </div>
                ))}
              </div>
            )}
          </form>
        </div>
      </div>
    </>
  );
}
