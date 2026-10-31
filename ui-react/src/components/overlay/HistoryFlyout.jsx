// History flyout (view "history").
//
// The host builds the item list (native/src/app/mesh_handler.cpp:
// ShowHistoryFlyout) and the overlay turns an item into a button that sends
// the matching command back to the shell.

import { sendOverlayCommand } from "../../services/overlayController.js";
import FallbackImage from "./FallbackImage.jsx";

/**
 * Maps a flyout item to the command the shell understands.
 * @param {any} item
 */
export function historyCommandForItem(item) {
  if (!item || typeof item !== "object") {
    return null;
  }
  if (item.type === "action" && item.action) {
    return { action: item.action };
  }
  if (item.type === "closed" && item.closedId) {
    return { action: "restore-tab", closedId: item.closedId };
  }
  if (item.url) {
    return { action: "navigate", url: item.url };
  }
  return null;
}

/**
 * @param {{payload: object, panelRef?: React.Ref<HTMLDivElement>}} props
 */
export default function HistoryFlyout({ payload, panelRef }) {
  const items = Array.isArray(payload?.items) ? payload.items : [];

  return (
    <div className="mesh-history" role="menu" ref={panelRef}>
      {items.map((item, index) => {
        if (!item || typeof item !== "object") {
          return null;
        }
        if (item.type === "separator") {
          return <div className="mesh-history-sep" key={`sep-${index}`} />;
        }
        const command = historyCommandForItem(item);
        const isAction = item.type === "action";
        return (
          <button
            type="button"
            role="menuitem"
            className="mesh-history-item"
            key={`item-${index}`}
            disabled={!command}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (command) {
                sendOverlayCommand(command);
              }
            }}
          >
            {isAction ? (
              <img
                className="mesh-history-favicon is-action"
                alt=""
                draggable={false}
                hidden
              />
            ) : (
              <FallbackImage
                className="mesh-history-favicon"
                alt=""
                draggable={false}
                sources={item.favicons}
              />
            )}
            <span className="mesh-history-label">
              {item.title || item.url || ""}
            </span>
            {item.shortcut ? (
              <span className="mesh-history-shortcut">{item.shortcut}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
