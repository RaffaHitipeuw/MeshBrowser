// The tab strip of the titlebar.
//
// Port of the tab rendering and the pointer drag of
// ui/js/features/browser/browser.js (renderTabs + the tabDrag handlers).
//
// The legacy implementation moved the dragged tab inside the DOM and read
// the new order back from the DOM when the drag ended (syncTabsOrderFromDom).
// Here the order lives in the controller: during the drag the target index
// is computed from the geometry of the strip and handed to the controller,
// which re-renders the tabs in the new order. The drag ghost is a clone that
// lives outside the React tree (document.body), so React never owns it.

import { useCallback, useEffect, useRef, useState } from "react";

import Icon from "../Icon.jsx";
import { bridge } from "../../services/bridge.js";
import { showTabTip, hideTabTip } from "../../services/shell/tabTip.js";

const DRAG_THRESHOLD = 5;

function TabItem({ tab, active, onActivate, onClose, onToggleMute, onHover, onLeave }) {
  const ref = useRef(null);

  return (
    <div
      ref={ref}
      className={`titlebar-tab ${active ? "is-active" : ""}`}
      role="tab"
      tabIndex={0}
      aria-selected={active ? "true" : "false"}
      data-tab-id={tab.id}
      onClick={() => onActivate(tab.id)}
      onAuxClick={(event) => {
        if (event.button === 1) {
          event.preventDefault();
          onClose(tab.id);
        }
      }}
      onPointerOver={(event) => {
        if (event.target.closest(".titlebar-tab-close, .titlebar-tab-audio")) {
          return;
        }
        onHover(tab, ref.current);
      }}
      onPointerOut={(event) => {
        const related = event.relatedTarget;
        if (related && ref.current && ref.current.contains(related)) {
          return;
        }
        onLeave();
      }}
    >
      {tab.audioPlaying && (
        <button
          type="button"
          className={`titlebar-tab-audio ${tab.audioMuted ? "is-muted" : ""}`}
          data-audio-mute="1"
          aria-label={tab.audioMuted ? "Unmute tab" : "Mute tab"}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onToggleMute(tab.id);
          }}
        >
          <Icon name="volume-2" />
        </button>
      )}
      <img className="titlebar-tab-favicon" src={tab.favicon} alt="" draggable={false} aria-hidden="true" />
      <span className="titlebar-tab-label">{tab.displayTitle}</span>
      <button
        type="button"
        className="titlebar-tab-close"
        aria-label="Close tab"
        data-close-id={tab.id}
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          hideTabTip();
          onClose(tab.id);
        }}
      >
        <Icon name="x" />
      </button>
    </div>
  );
}

export default function TabStrip({
  tabs,
  activeId,
  onActivate,
  onClose,
  onToggleMute,
  onNewTab,
  onReorder,
}) {
  const stripRef = useRef(null);
  const dragRef = useRef(null);
  const [dragTabId, setDragTabId] = useState(null);

  // The favicon of a tab is a plain image; the legacy code tried a list of
  // candidates. The React version uses the first candidate of the controller.
  const withFavicon = tabs.map((tab) => ({
    ...tab,
    favicon: tab.favicon || "assets/mesh-brand/mesh_kecil.svg",
  }));

  const removeGhost = useCallback(() => {
    const drag = dragRef.current;
    if (drag && drag.ghost && drag.ghost.parentNode) {
      drag.ghost.parentNode.removeChild(drag.ghost);
    }
    if (drag) {
      drag.ghost = null;
    }
    document.querySelectorAll(".titlebar-tab-ghost").forEach((node) => node.remove());
  }, []);

  const endDrag = useCallback(() => {
    const drag = dragRef.current;
    if (!drag) {
      return;
    }
    dragRef.current = null;
    setDragTabId(null);
    removeGhost();
    const strip = stripRef.current;
    if (strip) {
      strip.classList.remove("is-reordering");
    }
    document.querySelectorAll(".titlebar-tab.is-drag-source").forEach((node) => {
      node.classList.remove("is-drag-source");
    });
    try {
      if (drag.el && drag.el.hasPointerCapture && drag.el.hasPointerCapture(drag.pointerId)) {
        drag.el.releasePointerCapture(drag.pointerId);
      }
    } catch (_) {
      /* ignore */
    }
  }, [removeGhost]);

  /** The index the dragged tab would take at the given x position. */
  const targetIndex = useCallback((clientX, tabId) => {
    const strip = stripRef.current;
    if (!strip) {
      return -1;
    }
    const nodes = Array.from(strip.children).filter(
      (node) => node.classList.contains("titlebar-tab") && node.dataset.tabId !== tabId
    );
    let index = 0;
    for (const node of nodes) {
      const rect = node.getBoundingClientRect();
      if (clientX < rect.left + rect.width / 2) {
        return index;
      }
      index += 1;
    }
    return index;
  }, []);

  /** Moves the dragged tab to the given index and reports the new order. */
  const applyOrder = useCallback(
    (tabId, index) => {
      const strip = stripRef.current;
      if (!strip || typeof onReorder !== "function") {
        return;
      }
      const ids = Array.from(strip.children)
        .filter((node) => node.classList.contains("titlebar-tab"))
        .map((node) => node.dataset.tabId)
        .filter(Boolean);
      if (!ids.includes(tabId)) {
        return;
      }
      const without = ids.filter((id) => id !== tabId);
      without.splice(Math.max(0, Math.min(without.length, index)), 0, tabId);
      if (without.join("|") === ids.join("|")) {
        return;
      }
      onReorder(without, tabId);
    },
    [onReorder]
  );

  const onPointerDown = useCallback(
    (event) => {
      if (event.button !== 0) {
        return;
      }
      if (
        event.target.closest(
          "[data-close-id], .titlebar-tab-close, [data-audio-mute], .titlebar-tab-audio"
        )
      ) {
        return;
      }
      const el = event.target.closest(".titlebar-tab");
      const strip = stripRef.current;
      if (!el || !strip || !strip.contains(el)) {
        return;
      }
      const tabId = el.dataset.tabId;
      if (!tabId) {
        return;
      }
      hideTabTip();
      const rect = el.getBoundingClientRect();
      dragRef.current = {
        tabId,
        el,
        pointerId: event.pointerId,
        moved: false,
        grabX: Math.max(0, event.clientX - rect.left),
        grabY: Math.max(0, event.clientY - rect.top),
        startClientX: event.clientX,
        startClientY: event.clientY,
        ghost: null,
      };
      try {
        el.setPointerCapture(event.pointerId);
      } catch (_) {
        /* ignore */
      }
    },
    []
  );

  const onPointerMove = useCallback(
    (event) => {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) {
        return;
      }
      const dx = event.clientX - drag.startClientX;
      const dy = event.clientY - drag.startClientY;
      if (!drag.moved) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) {
          return;
        }
        drag.moved = true;
        hideTabTip();
        drag.el.classList.add("is-drag-source");
        const strip = stripRef.current;
        if (strip) {
          strip.classList.add("is-reordering");
        }
        // The ghost lives outside the React tree.
        const rect = drag.el.getBoundingClientRect();
        const ghost = drag.el.cloneNode(true);
        ghost.classList.add("titlebar-tab-ghost", "is-active");
        ghost.classList.remove("is-drag-source");
        ghost.style.width = `${Math.round(rect.width)}px`;
        ghost.style.height = `${Math.round(rect.height)}px`;
        document.body.appendChild(ghost);
        drag.ghost = ghost;
        setDragTabId(drag.tabId);
      }
      if (drag.ghost) {
        const winLeft = window.screenX || window.screenLeft || 0;
        const winTop = window.screenY || window.screenTop || 0;
        const x = event.screenX - winLeft - drag.grabX;
        const y = event.screenY - winTop - drag.grabY;
        drag.ghost.style.transform = `translate(${x}px, ${y}px)`;
      }
      const index = targetIndex(event.clientX, drag.tabId);
      if (index >= 0) {
        applyOrder(drag.tabId, index);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [applyOrder, targetIndex]
  );

  const onPointerUp = useCallback(
    (event) => {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) {
        return;
      }
      endDrag();
    },
    [endDrag]
  );

  // The legacy implementation polled the cursor position of the window while
  // a drag was running, so the ghost kept following the pointer when it left
  // the shell view.
  useEffect(() => {
    const timer = window.setInterval(() => {
      const drag = dragRef.current;
      if (!drag || !drag.moved || !drag.ghost) {
        return;
      }
      bridge
        .windowCursorPos()
        .then((pos) => {
          const dragNow = dragRef.current;
          if (!dragNow || !dragNow.ghost || !pos) {
            return;
          }
          const sx = Number(pos.x);
          const sy = Number(pos.y);
          if (!Number.isFinite(sx) || !Number.isFinite(sy)) {
            return;
          }
          const winLeft = window.screenX || window.screenLeft || 0;
          const winTop = window.screenY || window.screenTop || 0;
          dragNow.ghost.style.transform = `translate(${sx - winLeft - dragNow.grabX}px, ${
            sy - winTop - dragNow.grabY
          }px)`;
          const index = targetIndex(sx - winLeft, dragNow.tabId);
          if (index >= 0) {
            applyOrder(dragNow.tabId, index);
          }
          if (pos.primaryDown === false) {
            endDrag();
          }
        })
        .catch(() => {});
    }, 16);
    return () => window.clearInterval(timer);
  }, [applyOrder, endDrag, targetIndex]);

  useEffect(() => () => removeGhost(), [removeGhost]);

  return (
    <div className="titlebar-left">
      <div
        className="titlebar-tabs"
        id="browser-tabs"
        role="tablist"
        aria-label="Browser tabs"
        ref={stripRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {withFavicon.map((tab) => (
          <TabItem
            key={tab.id}
            tab={tab}
            active={tab.id === activeId}
            dragSource={dragTabId === tab.id}
            onActivate={onActivate}
            onClose={onClose}
            onToggleMute={onToggleMute}
            onHover={(item, element) => showTabTip(element, item)}
            onLeave={hideTabTip}
          />
        ))}
      </div>
      <button
        type="button"
        className="titlebar-tab-new"
        id="browser-tab-new"
        aria-label="New Tab"
        onClick={() => onNewTab()}
      >
        <Icon name="plus" />
      </button>
    </div>
  );
}
