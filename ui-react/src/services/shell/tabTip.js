// Hover card of a tab.
//
// Port of the tab-tip half of ui/js/features/browser/browser.js: hovering a
// tab for 420 ms opens the native overlay ("tab-tip" view) with the title,
// the domain, the audio state and the memory usage of the frame. The memory
// value is polled from the host while the card is open.
//
// The legacy module also had a fallback that reused the HTML tooltip layer
// (MeshTooltip.showTab / updateTab). The React tooltip layer has no such
// API, so only the native overlay path exists — which is the path the app
// always used (the host always provides the overlay).

import { bridge } from "../bridge.js";

const TAB_TIP_WIDTH = 280;
const TAB_TIP_DELAY_MS = 420;
// Memory is cosmetic; avoid hammering browser.state while the tip is open.
const TAB_TIP_MEMORY_POLL_MS = 4000;

/** @type {Map<string, number>} */
const tabMemoryMb = new Map();

let lastContentMemoryMb = null;

let tipId = null;
let tipTimer = 0;
let tipPollTimer = 0;
let tipOverlayOpen = false;
let tipDataKey = "";

export function isTabTipOpen() {
  return tipId !== null;
}

/** True while the native find bar is open — the legacy code skipped the tip then. */
let findOpen = false;
export function setFindOpen(value) {
  findOpen = Boolean(value);
}

function domainOf(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch (_) {
    return "";
  }
}

function payloadFor(tab, memoryMb) {
  let memory = null;
  if (typeof memoryMb === "number" && Number.isFinite(memoryMb)) {
    memory = Math.max(0, memoryMb);
  } else if (!tab.url || tab.start) {
    memory = 0;
  } else if (tabMemoryMb.has(tab.id)) {
    memory = tabMemoryMb.get(tab.id);
  } else if (typeof lastContentMemoryMb === "number") {
    memory = lastContentMemoryMb;
  }
  return {
    title: tab.title || "New Tab",
    domain: domainOf(tab.url || ""),
    audioPlaying: Boolean(tab.audioPlaying),
    audioMuted: Boolean(tab.audioMuted),
    memoryMb: memory,
  };
}

function dataKey(data) {
  const mem =
    typeof data.memoryMb === "number" && Number.isFinite(data.memoryMb)
      ? Math.round(data.memoryMb)
      : "";
  return [
    data.title || "",
    data.domain || "",
    data.audioPlaying ? "1" : "0",
    data.audioMuted ? "1" : "0",
    mem,
  ].join("\0");
}

async function readMemoryMb(tab) {
  if (!tab || !tab.url || tab.start) {
    return 0;
  }
  try {
    const state = await bridge.browserState();
    if (state && typeof state.memoryMb === "number") {
      const mb = Math.max(0, state.memoryMb);
      lastContentMemoryMb = mb;
      tabMemoryMb.set(tab.id, mb);
      return mb;
    }
  } catch (_) {
    /* ignore */
  }
  if (tabMemoryMb.has(tab.id)) {
    return tabMemoryMb.get(tab.id);
  }
  return typeof lastContentMemoryMb === "number" ? lastContentMemoryMb : null;
}

function present(anchor, data) {
  if (!anchor || !anchor.isConnected || findOpen) {
    return;
  }
  const rect = anchor.getBoundingClientRect();
  let left = Math.round(rect.left);
  const maxLeft = Math.max(8, window.innerWidth - TAB_TIP_WIDTH - 8);
  left = Math.max(8, Math.min(left, maxLeft));
  bridge
    .overlayShow({
      anchorRight: left + TAB_TIP_WIDTH,
      anchorTop: Math.round(rect.bottom + 6),
      width: TAB_TIP_WIDTH,
      // 0 = keep current host size when already open (avoids a shrink→grow pulse).
      height: tipOverlayOpen ? 0 : 120,
      payload: {
        view: "tab-tip",
        title: data.title,
        domain: data.domain || "",
        audioPlaying: Boolean(data.audioPlaying),
        audioMuted: Boolean(data.audioMuted),
        memoryMb: data.memoryMb,
      },
    })
    .catch(() => {});
  tipOverlayOpen = true;
  tipDataKey = dataKey(data);
}

function stopPoll() {
  if (tipPollTimer) {
    window.clearTimeout(tipPollTimer);
    tipPollTimer = 0;
  }
}

function startPoll(anchor, tab) {
  stopPoll();
  const id = tab.id;
  const tick = async () => {
    tipPollTimer = 0;
    if (tipId !== id || !anchor.isConnected) {
      return;
    }
    const memoryMb = await readMemoryMb(tab);
    if (tipId !== id || !anchor.isConnected) {
      return;
    }
    const data = payloadFor(tab, memoryMb);
    const key = dataKey(data);
    if (tipOverlayOpen && key === tipDataKey) {
      return;
    }
    present(anchor, data);
    tipPollTimer = window.setTimeout(tick, TAB_TIP_MEMORY_POLL_MS);
  };
  tipPollTimer = window.setTimeout(tick, 0);
}

/**
 * Starts the hover timer for a tab.
 * @param {Element} anchor the tab element
 * @param {{id: string, title: string, url: string, start: boolean, audioPlaying: boolean, audioMuted: boolean}} tab
 */
export function showTabTip(anchor, tab) {
  if (!anchor || !tab) {
    return;
  }
  tipId = tab.id;
  stopPoll();
  if (tipTimer) {
    window.clearTimeout(tipTimer);
  }
  // Prefetch the RAM while the hover delay runs so the card opens with a value.
  const prefetch = readMemoryMb(tab);
  tipTimer = window.setTimeout(async () => {
    tipTimer = 0;
    if (tipId !== tab.id || !anchor.isConnected) {
      return;
    }
    let memoryMb = null;
    try {
      memoryMb = await prefetch;
    } catch (_) {
      memoryMb = null;
    }
    if (tipId !== tab.id || !anchor.isConnected) {
      return;
    }
    present(anchor, payloadFor(tab, memoryMb));
    startPoll(anchor, tab);
  }, TAB_TIP_DELAY_MS);
}

/** Hides the hover card and dismisses the native overlay. */
export function hideTabTip() {
  if (tipTimer) {
    window.clearTimeout(tipTimer);
    tipTimer = 0;
  }
  stopPoll();
  tipId = null;
  tipDataKey = "";
  if (tipOverlayOpen) {
    tipOverlayOpen = false;
    bridge.overlayHide().catch(() => {});
  }
}

/**
 * Clears the tip state without dismissing the shared native overlay — the
 * legacy `releaseTabTipOverlay`, used when another panel takes over.
 */
export function releaseTabTip() {
  if (tipTimer) {
    window.clearTimeout(tipTimer);
    tipTimer = 0;
  }
  stopPoll();
  tipId = null;
  tipDataKey = "";
  tipOverlayOpen = false;
}

/** The native overlay was dismissed — the card is gone with it. */
export function onOverlayDismissed() {
  tipId = null;
  tipDataKey = "";
  tipOverlayOpen = false;
}
