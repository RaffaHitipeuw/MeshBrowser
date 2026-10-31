// Tab hover tip (view "tab-tip").
//
// Port of the tab-tip part of ui/js/overlay.js. The markup and the class names
// (.mesh-tab-tip*) are the contract with ui/css/overlay.css.

import { GaugeIcon, VolumeIcon, VolumeOffIcon } from "./OverlayIcons.jsx";

function memoryLabel(data) {
  if (typeof data.memoryMb === "number" && Number.isFinite(data.memoryMb)) {
    return `Memory usage: ${Math.max(0, Math.round(data.memoryMb))} MB`;
  }
  return "Memory usage: …";
}

/**
 * @param {{payload: object, panelRef?: React.Ref<HTMLDivElement>}} props
 */
export default function TabTip({ payload, panelRef }) {
  const data = payload || {};
  const audioPlaying = Boolean(data.audioPlaying);
  const audioMuted = Boolean(data.audioMuted);

  return (
    <div className="mesh-tab-tip" role="tooltip" ref={panelRef}>
      <div className="mesh-tab-tip-head">
        <div className="mesh-tab-tip-title">{data.title || "New Tab"}</div>
        {data.domain ? (
          <div className="mesh-tab-tip-domain">{data.domain}</div>
        ) : null}
      </div>
      <div className="mesh-tab-tip-meta">
        {audioPlaying ? (
          <div className="mesh-tab-tip-row">
            {audioMuted ? <VolumeOffIcon /> : <VolumeIcon />}
            <span>
              {audioMuted ? "This tab is muted" : "This tab is playing audio"}
            </span>
          </div>
        ) : null}
        <div className="mesh-tab-tip-row">
          <GaugeIcon />
          <span>{memoryLabel(data)}</span>
        </div>
      </div>
    </div>
  );
}
