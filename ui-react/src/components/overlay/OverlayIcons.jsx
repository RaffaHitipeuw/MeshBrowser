// Inline SVG icons for the overlay panels.
//
// The legacy overlay (ui/js/overlay.js) inlined these SVGs as HTML strings.
// They are not part of the lucide set the shared Icon component knows, and
// their pixel sizes are part of the overlay layout (the media panel has no
// icon sizing rule in ui/css/overlay.css), so they are reproduced here as
// React elements with the exact same markup.

const base = {
  xmlns: "http://www.w3.org/2000/svg",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": "true",
};

export function VolumeIcon({ size = 14 }) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={2}>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}

export function VolumeOffIcon({ size = 14 }) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={2}>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="22" x2="16" y1="9" y2="15" />
      <line x1="16" x2="22" y1="9" y2="15" />
    </svg>
  );
}

export function GaugeIcon({ size = 14 }) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={2}>
      <path d="m12 14 4-4" />
      <path d="M3.34 19a10 10 0 1 1 17.32 0" />
    </svg>
  );
}

export function PlayIcon({ size = 20 }) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={2.1}>
      <polygon points="6 3 20 12 6 21 6 3" />
    </svg>
  );
}

export function PauseIcon({ size = 20 }) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={2.1}>
      <rect x="14" y="4" width="4" height="16" rx="1" />
      <rect x="6" y="4" width="4" height="16" rx="1" />
    </svg>
  );
}

export function PipIcon({ size = 16 }) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={1.85}>
      <path d="M21 9V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10c0 1.1.9 2 2 2h4" />
      <rect width="10" height="7" x="12" y="13" rx="2" />
    </svg>
  );
}

export function SkipBackIcon({ size = 17 }) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={1.85}>
      <polygon points="19 20 9 12 19 4 19 20" />
      <line x1="5" x2="5" y1="19" y2="5" />
    </svg>
  );
}

export function SkipForwardIcon({ size = 17 }) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={1.85}>
      <polygon points="5 4 15 12 5 20 5 4" />
      <line x1="19" x2="19" y1="5" y2="19" />
    </svg>
  );
}

export function Back10Icon({ size = 18 }) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={1.85}>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
      <text
        x="12"
        y="15.5"
        textAnchor="middle"
        fill="currentColor"
        stroke="none"
        fontSize="7.5"
        fontFamily="Segoe UI, sans-serif"
        fontWeight="650"
      >
        10
      </text>
    </svg>
  );
}

export function Forward10Icon({ size = 18 }) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={1.85}>
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <path d="M21 4v5h-5" />
      <text
        x="12"
        y="15.5"
        textAnchor="middle"
        fill="currentColor"
        stroke="none"
        fontSize="7.5"
        fontFamily="Segoe UI, sans-serif"
        fontWeight="650"
      >
        10
      </text>
    </svg>
  );
}

export function MusicIcon({ size = 22 }) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={1.85}>
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

export function GearIcon({ size = 16 }) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={1.85}>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function ChevronDownIcon({ size = 16 }) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={1.85}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
