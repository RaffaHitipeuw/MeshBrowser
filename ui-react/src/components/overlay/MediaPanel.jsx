// Global media controls (view "media").
//
// Port of the media panel of ui/js/overlay.js. The markup and the class names
// (.mesh-media-*) are the contract with ui/css/overlay.css.

import { useEffect, useRef, useState } from "react";

import { FALLBACK_FAVICON, mediaControl, setAudioMuted } from "../../services/overlayController.js";
import {
  Back10Icon,
  Forward10Icon,
  MusicIcon,
  PauseIcon,
  PipIcon,
  PlayIcon,
  SkipBackIcon,
  SkipForwardIcon,
  VolumeIcon,
  VolumeOffIcon,
} from "./OverlayIcons.jsx";

function faviconForMedia(origin, pageUrl) {
  const host = String(origin || "").trim();
  if (host) {
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=32`;
  }
  try {
    const u = new URL(pageUrl);
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(u.hostname)}&sz=32`;
  } catch (_) {
    return FALLBACK_FAVICON;
  }
}

/**
 * @param {{payload: object, panelRef?: React.Ref<HTMLDivElement>}} props
 */
export default function MediaPanel({ payload, panelRef }) {
  const data = payload || {};
  const tabId = String(data.tabId || "");
  const playing = Boolean(data.playing);
  const canPip = Boolean(data.canPip);
  const duration = Math.max(0, Number(data.duration) || 0);
  const current = Math.max(0, Number(data.currentTime) || 0);

  // The range input is owned by the user while it is being dragged: the host
  // keeps pushing the media position, but it must not fight the drag.
  const [scrubValue, setScrubValue] = useState(null);
  const scrubbingRef = useRef(false);

  useEffect(() => {
    if (!scrubbingRef.current) {
      setScrubValue(null);
    }
  }, [data]);

  const rangeMax = duration > 0 ? duration : 1;
  const rangeValue =
    scrubValue != null
      ? scrubValue
      : duration > 0
        ? Math.min(duration, current)
        : 0;

  const commitScrub = () => {
    if (!scrubbingRef.current) {
      return;
    }
    scrubbingRef.current = false;
    mediaControl("seek", Number(rangeValue) || 0, tabId);
  };

  const onToggle = (event) => {
    event.preventDefault();
    mediaControl("toggle", undefined, tabId);
  };

  const onPip = (event) => {
    event.preventDefault();
    mediaControl("pip", undefined, tabId);
  };

  const onSeekAction = (event, action, value) => {
    event.preventDefault();
    mediaControl(action, value, tabId);
  };

  // Optional mute button: the shell only sends "muted" when it knows the state
  // of the tab, so the button is hidden otherwise (legacy parity).
  const muted = typeof data.muted === "boolean" ? data.muted : null;

  return (
    <div
      className="mesh-media"
      role="dialog"
      aria-label="Media controls"
      ref={panelRef}
    >
      <div className="mesh-media-main">
        {String(data.artwork || "").trim() ? (
          <img
            className="mesh-media-art"
            alt=""
            referrerPolicy="no-referrer"
            src={String(data.artwork || "").trim()}
          />
        ) : (
          <div className="mesh-media-art-fallback">
            <MusicIcon />
          </div>
        )}

        <div className="mesh-media-meta">
          <div className="mesh-media-source">
            <img
              className="mesh-media-favicon"
              alt=""
              referrerPolicy="no-referrer"
              src={faviconForMedia(data.origin, data.pageUrl)}
            />
            <span className="mesh-media-origin">{data.origin || "Media"}</span>
          </div>
          <p className="mesh-media-title">{data.title || "Playing media"}</p>
          <p className="mesh-media-artist">{data.artist || ""}</p>
        </div>

        <div className="mesh-media-side">
          <button
            type="button"
            className="mesh-media-icon-btn"
            title="Picture in picture"
            aria-label="Picture in picture"
            hidden={!canPip}
            onClick={onPip}
          >
            <PipIcon />
          </button>
          <button
            type="button"
            className="mesh-media-play"
            aria-label={playing ? "Pause" : "Play"}
            onClick={onToggle}
          >
            {playing ? <PauseIcon /> : <PlayIcon />}
          </button>
          {muted != null ? (
            <button
              type="button"
              className="mesh-media-icon-btn"
              title={muted ? "Unmute" : "Mute"}
              aria-label={muted ? "Unmute" : "Mute"}
              onClick={(event) => {
                event.preventDefault();
                setAudioMuted(!muted, tabId);
              }}
            >
              {muted ? <VolumeOffIcon /> : <VolumeIcon />}
            </button>
          ) : null}
        </div>
      </div>

      <div className="mesh-media-seek">
        <button
          type="button"
          className="mesh-media-icon-btn"
          title="Seek to start"
          aria-label="Seek to start"
          onClick={(event) => onSeekAction(event, "seekStart", undefined)}
        >
          <SkipBackIcon />
        </button>
        <button
          type="button"
          className="mesh-media-icon-btn"
          title="Back 10 seconds"
          aria-label="Back 10 seconds"
          onClick={(event) => onSeekAction(event, "seekRelative", -10)}
        >
          <Back10Icon />
        </button>

        <input
          className="mesh-media-range"
          type="range"
          min="0"
          step="0.1"
          max={rangeMax}
          value={rangeValue}
          disabled={duration <= 0}
          aria-label="Seek"
          onPointerDown={() => {
            scrubbingRef.current = true;
          }}
          onChange={(event) => {
            scrubbingRef.current = true;
            setScrubValue(Number(event.target.value) || 0);
          }}
          onPointerUp={commitScrub}
          onKeyUp={commitScrub}
          onBlur={commitScrub}
        />

        <button
          type="button"
          className="mesh-media-icon-btn"
          title="Forward 10 seconds"
          aria-label="Forward 10 seconds"
          onClick={(event) => onSeekAction(event, "seekRelative", 10)}
        >
          <Forward10Icon />
        </button>
        <button
          type="button"
          className="mesh-media-icon-btn"
          title="Seek to end"
          aria-label="Seek to end"
          onClick={(event) => onSeekAction(event, "seekEnd", undefined)}
        >
          <SkipForwardIcon />
        </button>
      </div>
    </div>
  );
}
